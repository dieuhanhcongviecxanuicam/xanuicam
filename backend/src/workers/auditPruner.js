// backend/src/workers/auditPruner.js
// Worker to prune audit_logs table and keep only the most recent N entries.

const pool = require('../db');

const DEFAULT_MAX = process.env.AUDIT_LOG_MAX ? parseInt(process.env.AUDIT_LOG_MAX, 10) : 1000;
const INTERVAL_MS = process.env.AUDIT_LOG_PRUNE_INTERVAL_MS ? parseInt(process.env.AUDIT_LOG_PRUNE_INTERVAL_MS, 10) : (1000 * 60 * 60); // 1 hour

async function pruneOnce() {
  try {
    // Use a CTE to delete all rows beyond the most recent DEFAULT_MAX entries
    const sql = `WITH to_delete AS (
      SELECT id FROM audit_logs ORDER BY created_at DESC OFFSET $1
    ) DELETE FROM audit_logs WHERE id IN (SELECT id FROM to_delete)`;
    const res = await pool.query(sql, [DEFAULT_MAX]);
    if (res && typeof res.rowCount === 'number') {
      console.log(`[auditPruner] Removed ${res.rowCount} old audit log rows (keeping ${DEFAULT_MAX}).`);
    } else {
      console.log('[auditPruner] Prune executed.');
    }
  } catch (e) {
    console.error('[auditPruner] Error pruning audit logs:', e && (e.stack || e));
  }
}

function start() {
  console.log(`[auditPruner] Starting audit pruner: keep ${DEFAULT_MAX} rows, interval ${INTERVAL_MS}ms`);
  // Run immediately
  pruneOnce();
  // Schedule
  const id = setInterval(pruneOnce, INTERVAL_MS);
  // expose stop method if needed
  return { stop: () => clearInterval(id) };
}

module.exports = { start, pruneOnce };
