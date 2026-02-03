const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    process.env.PORT = process.env.PORT || '5001';
    process.env.SKIP_EXPORT_PASSWORD = '1';
    // Start server in-process
    const srv = require('../server');
    const server = srv.startServer(Number(process.env.PORT));
    // Wait briefly for server to be fully ready
    await new Promise(r => setTimeout(r, 1200));

    const API_BASE = process.env.API_BASE || `http://localhost:${process.env.PORT}/api`;
    const username = 'export_tester';
    const password = 'TestExport123!';

    console.log('Logging in to', API_BASE);
    const login = await axios.post(`${API_BASE}/auth/login`, { identifier: username, password, device: { userAgent: 'node-inproc-test' } });
    const token = login.data && (login.data.token || (login.data.data && login.data.data.token));
    if (!token) throw new Error('No token from login');
    console.log('Logged in; token length', String(token).length);

    const res = await axios.post(`${API_BASE}/tasks/export`, { format: 'xlsx', filters: {}, password }, { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' });
    const fname = `tasks_export_inproc_${Date.now()}.xlsx`;
    fs.writeFileSync(fname, res.data);
    console.log('Wrote', fname);

    // Clean up
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (e) {
    console.error('Error', e.response && e.response.status, e.response && e.response.data ? JSON.stringify(e.response.data) : (e.message || e));
    try{ console.error(e.stack); }catch(_){}
    process.exitCode = 1;
  }
})();
