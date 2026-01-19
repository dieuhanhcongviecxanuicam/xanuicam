const jwt = require('jsonwebtoken');
const pool = require('../src/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    const username = 'export_tester';
    const client = await pool.connect();
    let user;
    try{
      const ures = await client.query('SELECT id, username, role_id FROM users WHERE username = $1', [username]);
      if (ures.rows.length === 0) throw new Error('User not found');
      user = ures.rows[0];
      const permsRes = await client.query('SELECT p.permission_name FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = $1', [user.role_id]);
      const perms = permsRes.rows.map(r=>r.permission_name);
      user.permissions = perms;
    } finally { client.release(); }
    const jwtHelper = require('../src/utils/jwtHelper');
    const payload = { user: user, sid: 'script-' + Date.now() };
    const token = jwtHelper.sign(payload, { expiresIn: '2h' });
    console.log('Signed token for user', user.id, 'perms', user.permissions);
    const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
    // use real password for confirmation
    const res = await axios.post(`${API_BASE}/tasks/export`, { format: 'xlsx', filters: {}, password: 'TestExport123!' }, { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' });
    const ts = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    const fnameTs = `${pad(ts.getDate())}${pad(ts.getMonth()+1)}${ts.getFullYear()}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
    const filename = `tasks_export_token_${fnameTs}.xlsx`;
    fs.writeFileSync(filename, res.data);
    console.log('Wrote', filename);
  }catch(e){
    // Decode response body when possible for clearer debugging
    try {
      if (e.response && e.response.data) {
        const d = e.response.data;
        if (Buffer.isBuffer(d)) {
          try { console.error('Error response body:', d.toString('utf8')); } catch(_) { console.error('Error response (buffer) length', d.length); }
        } else {
          console.error('Error response body:', JSON.stringify(d));
        }
      } else {
        console.error('Error', e.message || e);
      }
    } catch(inner) {
      console.error('Error (failed to pretty-print):', e && e.message ? e.message : e);
    }
    try{ console.error(e.stack); }catch(_){}
    process.exitCode = 1;
  } finally { try { await pool.end(); } catch(_){} }
})();
