const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    const API_BASE = 'http://localhost:5000/api';
    const login = await axios.post(`${API_BASE}/auth/login`, { identifier: '000000000001', password: 'password', device: { userAgent: 'node-test' } });
    const token = login.data && login.data.token ? login.data.token : (login.data && login.data.data && login.data.data.token ? login.data.data.token : null);
    if (!token) throw new Error('No token from login');
    console.log('Logged in, token length:', String(token).length);
    const outFormat = 'xlsx';
    const res = await axios.post(`${API_BASE}/audit-logs/export`, { format: outFormat, page: 1, limit: 100, password: 'password' }, { headers: { Authorization: `Bearer ${token}`, Accept: '*/*' }, responseType: 'arraybuffer' });
    const filename = `audit_export_test.${outFormat === 'xlsx' ? 'xlsx' : (outFormat === 'pdf' ? 'pdf' : 'csv')}`;
    fs.writeFileSync(filename, res.data);
    console.log('Wrote', filename);
  }catch(e){
    console.error('Error', e.response && e.response.status, e.response && e.response.data ? e.response.data : (e.message || e));
    try { console.error(e.stack || e); } catch (ee) {}
  }
})();
