const pool = require('../src/db');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const fs = require('fs');
(async ()=>{
  const username = 'export_tester';
  const password = 'TestExport123!';
  try{
    const client = await pool.connect();
    try{
      await client.query('BEGIN');
      // ensure role_id 1 exists
      const r = await client.query('SELECT id FROM roles WHERE id = 1');
      const roleId = (r.rows.length > 0) ? 1 : (r.rows.length === 0 ? null : 1);
      if (!roleId) {
        // fallback: pick any role
        const r2 = await client.query('SELECT id FROM roles LIMIT 1');
        if (r2.rows.length === 0) throw new Error('No roles available in DB');
      }
      // create user if not exists
      const ures = await client.query('SELECT id FROM users WHERE username = $1', [username]);
      let userId;
      const hash = await bcrypt.hash(password, 10);
      if (ures.rows.length === 0) {
        const ins = await client.query('INSERT INTO users (username, password_hash, full_name, role_id, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING id', [username, hash, 'Export Tester', 1, true]);
        userId = ins.rows[0].id;
        console.log('Created user', username, 'id', userId);
      } else {
        userId = ures.rows[0].id;
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
        console.log('User exists, updated password for', username);
      }
      await client.query('COMMIT');

      // ensure permission mapping: assign export_tasks to role 1
      try{
        const perm = await client.query('SELECT id FROM permissions WHERE permission_name = $1', ['export_tasks']);
        if (perm.rows.length > 0) {
          const permId = perm.rows[0].id;
          await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [1, permId]);
        }
      } catch(e){ console.warn('Could not ensure role_permission mapping', e && e.message); }

    } finally { client.release(); }

    // login via API and call export
    const API_BASE = 'http://localhost:5000/api';
    console.log('Logging in as', username);
    const login = await axios.post(`${API_BASE}/auth/login`, { identifier: username, password, device: { userAgent: 'node-export-tester' } });
    const token = login.data && (login.data.token || (login.data.data && login.data.data.token));
    if (!token) throw new Error('No token from login');
    console.log('Logged in, token length:', String(token).length);
    const outFormat = 'xlsx';
    const body = { format: outFormat, filters: {}, password };
    const res = await axios.post(`${API_BASE}/tasks/export`, body, { headers: { Authorization: `Bearer ${token}`, Accept: '*/*' }, responseType: 'arraybuffer' });
    const ts = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    const fnameTs = `${pad(ts.getDate())}${pad(ts.getMonth()+1)}${ts.getFullYear()}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
    const filename = `tasks_export_tester_${fnameTs}.xlsx`;
    fs.writeFileSync(filename, res.data);
    console.log('Wrote', filename);
  }catch(e){
    console.error('Error', e && (e.response && e.response.data ? JSON.stringify(e.response.data) : (e.message || e)));
    try{ console.error(e.stack); }catch(_){}
    process.exitCode = 1;
  } finally {
    try{ await pool.end(); }catch(_){}
  }
})();
