const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
    const USER = process.env.E2E_USER || 'admin';
    const PASS = process.env.E2E_PASS || 'password';

    console.log('Logging in as', USER);
    const login = await axios.post(`${API_BASE}/auth/login`, { identifier: USER, password: PASS, device: { userAgent: 'e2e-export-test' } });
    const token = login.data && login.data.token ? login.data.token : (login.data && login.data.data && login.data.data.token ? login.data.data.token : null);
    if (!token) throw new Error('No token from login');
    const headers = { Authorization: `Bearer ${token}`, Accept: '*/*' };

    console.log('Checking export quota (before)');
    const q1 = await axios.get(`${API_BASE}/users/export/quota?module=tasks`, { headers });
    console.log('Quota before:', q1.data);

    const outFormat = process.env.OUT_FORMAT || 'xlsx';
    const body = { format: outFormat, filters: {}, password: PASS, filename: `xanuicam_dashboard_test_${Date.now()}`, sheet_name: `xanuicam_dashboard_${(new Date()).toISOString().slice(0,10).replace(/-/g,'')}` };
    console.log('Requesting export with format', outFormat);
    const res = await axios.post(`${API_BASE}/tasks/export`, body, { headers, responseType: 'arraybuffer' });
    const ext = outFormat === 'xlsx' ? 'xlsx' : (outFormat === 'pdf' ? 'pdf' : 'csv');
    const filename = `e2e_tasks_export_test.${ext}`;
    fs.writeFileSync(filename, res.data);
    console.log('Wrote', filename);

    console.log('Checking export quota (after)');
    const q2 = await axios.get(`${API_BASE}/users/export/quota?module=tasks`, { headers });
    console.log('Quota after:', q2.data);

    console.log('E2E export test completed successfully');
  }catch(e){
    console.error('E2E export error', e.response && e.response.status, e.response && e.response.data ? e.response.data : (e.message || e));
    try{ console.error(e.stack || e); }catch(e2){}
    process.exit(1);
  }
})();
