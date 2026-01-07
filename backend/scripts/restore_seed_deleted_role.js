const fs = require('fs');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

async function pickSeed() {
  const r = await pool.query("SELECT id, role_name FROM deleted_roles WHERE role_name LIKE '__seed_deleted_role_%' ORDER BY id LIMIT 1");
  if (r.rows.length) return r.rows[0];
  const any = await pool.query('SELECT id, role_name FROM deleted_roles ORDER BY deleted_at DESC LIMIT 1');
  return any.rows[0];
}

async function run(){
  try{
    const row = await pickSeed();
    if(!row) { console.error('No deleted role found to restore'); process.exit(2); }
    console.log('Restoring deleted role:', row);

    const secret = process.env.JWT_SECRET;
    if(!secret) throw new Error('JWT_SECRET missing in .env');
    const jwtHelper = require('../src/utils/jwtHelper');
    // Provide permissions in token so middleware grants access
    const payload = { user: { id: 1, username: 'dev', permissions: ['role_management','full_access'] }, sid: 'script-restore' };
    const token = jwtHelper.sign(payload, { expiresIn: '1h' });

    const body = JSON.stringify({});
    const opts = {
      hostname: process.env.RESTORE_HOST || '127.0.0.1',
      port: process.env.RESTORE_PORT ? parseInt(process.env.RESTORE_PORT,10) : 5000,
      path: `/api/roles/deleted/${row.id}/restore`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Authorization': 'Bearer ' + token }
    };

    await new Promise((resolve,reject)=>{
      const req = http.request(opts, res=>{
        let buf=''; res.on('data',d=>buf+=d); res.on('end',()=>{ console.log('STATUS',res.statusCode); console.log('BODY',buf); resolve(); });
      });
      req.on('error', err=>{ console.error('Request error', err); reject(err); });
      req.write(body); req.end();
    });
  }catch(e){ console.error('Restore failed', e && e.stack || e); process.exit(1); }
  finally{ process.exit(0); }
}

run();
