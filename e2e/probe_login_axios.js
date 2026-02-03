const axios = require('axios');
(async()=>{
  const id = process.env.E2E_USER || '000000000001';
  const pw = process.env.E2E_PASS || 'password';
  try{
    const resp = await axios.post('http://localhost:5000/api/auth/login', { identifier: id, password: pw, device: { userAgent: 'node-e2e-probe' } }, { timeout: 10000, validateStatus: () => true });
    console.log('STATUS', resp.status);
    console.log('DATA', JSON.stringify(resp.data));
  }catch(e){ console.error('ERR', e && e.message ? e.message : e); }
})();
