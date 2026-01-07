const axios = require('axios');
const fs = require('fs');
const jwt = require('jsonwebtoken');
(async ()=>{
  try{
    process.env.PORT = process.env.PORT || '5001';
    process.env.SKIP_EXPORT_PASSWORD = '1';
    const srv = require('../server');
    const server = srv.startServer(Number(process.env.PORT));
    await new Promise(r => setTimeout(r, 1200));
    const pool = require('../src/db');
    const userRes = await pool.query("SELECT id, username, full_name, avatar, role_id FROM users WHERE username = $1", ['export_tester']);
    if (!userRes.rows.length) throw new Error('export_tester not found');
    const user = userRes.rows[0];
    // Craft token payload matching authController shape
    const payload = {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        avatar: user.avatar,
        role: 'Admin',
        department: null,
        permissions: ['export_tasks']
      },
      sid: 'internal-test-session'
    };
    const jwtHelper = require('../src/utils/jwtHelper');
    const token = jwtHelper.sign(payload, { expiresIn: '24h' });
    const API_BASE = `http://localhost:${process.env.PORT}/api`;
    console.log('Calling export with token length', token.length);
    const res = await axios.post(`${API_BASE}/tasks/export`, { format: 'xlsx', filters: {}, password: '' }, { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' });
    const fname = `tasks_export_token_inproc_${Date.now()}.xlsx`;
    fs.writeFileSync(fname, res.data);
    console.log('Wrote', fname);
    server.close(() => { console.log('Server closed'); process.exit(0); });
  } catch (e) {
    console.error('Error', e.response && e.response.status, e.response && e.response.data ? JSON.stringify(e.response.data) : (e.message || e));
    try{ console.error(e.stack); }catch(_){}
    process.exitCode = 1;
  }
})();
