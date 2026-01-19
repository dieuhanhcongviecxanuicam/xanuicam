const pool = require('../db');

// This worker expires sessions older than 30 days and runs daily.
const pruneOldSessions = async () => {
  try {
    const res = await pool.query("UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE created_at < NOW() - INTERVAL '30 days' AND is_active = TRUE RETURNING session_id");
    if (res && res.rowCount) {
      console.log(`Pruned ${res.rowCount} sessions older than 30 days.`);
    } else {
      console.log('No old sessions to prune.');
    }
  } catch (e) {
    console.error('sessionPruner: failed to prune sessions:', e && (e.stack || e));
  }
};

// Run once immediately, then schedule every 24 hours
const start = () => {
  try {
    pruneOldSessions();
    // 24 hours
    const DAY_MS = 24 * 60 * 60 * 1000;
    setInterval(pruneOldSessions, DAY_MS);
    console.log('Session pruner started: will run daily.');
  } catch (e) {
    console.error('sessionPruner: start failed', e && (e.stack || e));
  }
};

module.exports = { start, pruneOldSessions };
