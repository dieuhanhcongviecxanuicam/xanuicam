const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    const API_BASE = 'http://localhost:5000/api';
    // Superadmin user seeded by scripts/seed.js: username 'superadmin', password 'superpassword'
    const login = await axios.post(`${API_BASE}/auth/login`, { identifier: 'superadmin', password: 'superpassword', device: { userAgent: 'node-e2e' } });
    const token = login.data && (login.data.token || (login.data.data && login.data.data.token));
    if (!token) throw new Error('No token from login');
    console.log('Logged in as superadmin, token length:', String(token).length);

    const outFormat = 'xlsx';
    const body = { format: outFormat, filters: {}, password: 'superpassword' };
    const res = await axios.post(`${API_BASE}/tasks/export`, body, { headers: { Authorization: `Bearer ${token}`, Accept: '*/*' }, responseType: 'arraybuffer' });
    const ts = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    const fnameTs = `${pad(ts.getDate())}${pad(ts.getMonth()+1)}${ts.getFullYear()}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
    const filename = `tasks_export_e2e_super_${fnameTs}.${outFormat === 'xlsx' ? 'xlsx' : (outFormat === 'pdf' ? 'pdf' : 'csv')}`;
    fs.writeFileSync(filename, res.data);
    console.log('Wrote', filename);
  }catch(e){
    console.error('Error', e.response && e.response.status, e.response && e.response.data ? JSON.stringify(e.response.data) : (e.message || e));
    try{ console.error(e.stack); }catch(_){}
    process.exitCode = 1;
  }
})();
