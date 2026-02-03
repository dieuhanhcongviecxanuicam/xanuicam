require('dotenv').config();
const pool = require('../src/db');
const logActivity = require('../src/utils/auditLogger');
(async()=>{
  try{
    await logActivity(pool, { userId: 7, username: 'e2e_test_user', status: 'success', module: 'Test', action: 'ManualLog', userAgent: 'test-agent', ip: '127.0.0.1', deviceType: 'Desktop', os: 'TestOS', details: JSON.stringify({ note: 'logger test' }) });
    const r = await pool.query('SELECT id, username, user_id, action, module, created_at, details FROM audit_logs WHERE username=$1 ORDER BY created_at DESC LIMIT 5',['e2e_test_user']);
    console.dir(r.rows);
  }catch(e){ console.error('test_log_activity error', e); } finally{ await pool.end(); }
})();
