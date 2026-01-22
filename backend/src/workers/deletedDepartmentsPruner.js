const pool = require('../db');
const fs = require('fs');
const path = require('path');

const DEFAULT_RETENTION_DAYS = 7;

const deleteFile = (filePath) => {
  if (!filePath) return;
  try {
    const fullPath = path.join(__dirname, '..', '..', filePath);
    fs.unlink(fullPath, (err) => {
      if (err) console.error('[deletedDepartmentsPruner] Error deleting file', fullPath, err);
    });
  } catch (e) {
    console.error('[deletedDepartmentsPruner] deleteFile error', e);
  }
};

async function pruneDeletedDepartments(retentionDays = DEFAULT_RETENTION_DAYS) {
  try {
    // Defensive check: ensure the optional 'avatar' column exists before selecting it.
    try {
      const colCheck = await pool.query("SELECT count(*) AS cnt FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", ['deleted_departments', 'avatar']);
      const hasAvatar = parseInt(colCheck.rows[0].cnt, 10) > 0;
      if (!hasAvatar) {
        // If the column doesn't exist, avoid running the main query which would error.
        return console.warn('[deletedDepartmentsPruner] Skipping prune: optional column "avatar" not present.');
      }
    } catch (colErr) {
      console.error('[deletedDepartmentsPruner] Could not verify columns, aborting prune:', colErr && colErr.message ? colErr.message : colErr);
      return;
    }

    const res = await pool.query("SELECT id, avatar FROM deleted_departments WHERE deleted_at <= NOW() - ($1::interval)", [`${retentionDays} days`]);
    const rows = res.rows;
    if (!rows || rows.length === 0) return console.log('[deletedDepartmentsPruner] No old deleted departments to purge.');

    const ids = rows.map(r => r.id);
    // delete files
    rows.forEach(r => {
      if (r.avatar) deleteFile(r.avatar);
    });

    const del = await pool.query(`DELETE FROM deleted_departments WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
    console.log('[deletedDepartmentsPruner] Permanently removed deleted_departments ids:', del.rows.map(r=>r.id));
  } catch (e) {
    console.error('[deletedDepartmentsPruner] Error during prune:', e && e.message ? e.message : e);
  }
}

function start() {
  const intervalMs = 3600000; // run hourly
  setInterval(() => pruneDeletedDepartments(DEFAULT_RETENTION_DAYS).catch(e=>console.error(e)), intervalMs);
  console.log('[deletedDepartmentsPruner] Started: will prune deleted departments older than', DEFAULT_RETENTION_DAYS, 'days every', intervalMs, 'ms');
}

module.exports = { pruneDeletedDepartments, start };