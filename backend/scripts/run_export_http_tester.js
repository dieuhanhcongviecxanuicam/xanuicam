const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    const API_BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 5001}/api`;
    const username = 'export_tester';
    const password = 'TestExport123!';
    const login = await axios.post(`${API_BASE}/auth/login`, { identifier: username, password, device: { userAgent: 'node-http-test' } });
    const token = login.data && (login.data.token || (login.data.data && login.data.data.token));
    if (!token) throw new Error('No token from login');
    console.log('Logged in; token length', String(token).length);
    const res = await axios.post(`${API_BASE}/tasks/export`, { format: 'xlsx', filters: {}, password }, { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' });
    const fname = `tasks_export_http_tester_${Date.now()}.xlsx`;
    fs.writeFileSync(fname, res.data);
    console.log('Wrote', fname);
  } catch (e) {
    console.error('Error', e.response && e.response.status, e.response && e.response.data ? JSON.stringify(e.response.data) : (e.message || e));
    try{ console.error(e.stack); }catch(_){}
    process.exitCode = 1;
  }
})();
