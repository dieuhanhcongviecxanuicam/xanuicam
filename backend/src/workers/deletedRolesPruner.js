const pool = require('../db');

const DEFAULT_RETENTION_DAYS = 7;

async function pruneDeletedRoles(retentionDays = DEFAULT_RETENTION_DAYS) {
  try {
    const res = await pool.query("SELECT id FROM deleted_roles WHERE deleted_at <= NOW() - ($1::interval)", [`${retentionDays} days`]);
    const ids = res.rows.map(r => r.id);
    if (ids.length === 0) return console.log('[deletedRolesPruner] No old deleted roles to purge.');

    const del = await pool.query(`DELETE FROM deleted_roles WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
    console.log('[deletedRolesPruner] Permanently removed deleted_roles ids:', del.rows.map(r=>r.id));
  } catch (e) {
    console.error('[deletedRolesPruner] Error during prune:', e && e.message ? e.message : e);
  }
}

function start() {
  const intervalMs = 3600000; // run hourly
  setInterval(() => pruneDeletedRoles(DEFAULT_RETENTION_DAYS).catch(e=>console.error(e)), intervalMs);
  console.log('[deletedRolesPruner] Started: will prune deleted roles older than', DEFAULT_RETENTION_DAYS, 'days every', intervalMs, 'ms');
}

module.exports = { pruneDeletedRoles, start };
