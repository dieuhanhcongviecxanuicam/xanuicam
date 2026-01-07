const pool = require('../db');
const path = require('path');
const fs = require('fs');

const deleteFileSafe = (filePath) => {
  if (!filePath) return;
  try {
    const full = path.join(__dirname, '..', '..', filePath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) {
    console.warn('deletedUsersPruner: could not delete file', filePath, e && e.message ? e.message : e);
  }
};

// Permanently remove archived users older than retentionDays (default 7)
const pruneDeletedUsers = async () => {
  const retentionDays = Number(process.env.DELETED_USER_RETENTION_DAYS || 7);
  try {
    // Ensure table exists
    await pool.query(`CREATE TABLE IF NOT EXISTS deleted_users (
      id SERIAL PRIMARY KEY,
      orig_user_id INTEGER,
      username TEXT,
      cccd TEXT,
      ma_cong_chuc TEXT,
      full_name TEXT,
      email TEXT,
      phone_number TEXT,
      birth_date TIMESTAMPTZ,
      avatar TEXT,
      note TEXT,
      is_active BOOLEAN,
      role_id INTEGER,
      department_id INTEGER,
      password_hash TEXT,
      deleted_by INTEGER,
      deleted_at TIMESTAMPTZ DEFAULT NOW(),
      extra JSONB
    )`);
  } catch (e) {}

  try {
    const res = await pool.query("SELECT id, avatar, deleted_at FROM deleted_users WHERE deleted_at <= NOW() - ($1::interval)", [`${retentionDays} days`]);
    if (!res || !res.rows || res.rows.length === 0) {
      console.log('deletedUsersPruner: no archived users to purge.');
      return;
    }
    for (const row of res.rows) {
      try {
        // delete avatar file if present
        if (row.avatar) deleteFileSafe(row.avatar);
        await pool.query('DELETE FROM deleted_users WHERE id = $1', [row.id]);
        console.log(`deletedUsersPruner: permanently deleted archived user id=${row.id}`);
      } catch (e) {
        console.error('deletedUsersPruner: failed to permanently delete archived user', row.id, e && (e.stack || e));
      }
    }
  } catch (e) {
    console.error('deletedUsersPruner: pruning failed', e && (e.stack || e));
  }
};

const start = () => {
  try {
    pruneDeletedUsers();
    const DAY_MS = 24 * 60 * 60 * 1000;
    setInterval(pruneDeletedUsers, DAY_MS);
    console.log('deletedUsersPruner started: will run daily and purge archived users older than retention period.');
  } catch (e) {
    console.error('deletedUsersPruner: start failed', e && (e.stack || e));
  }
};

module.exports = { start, pruneDeletedUsers };
