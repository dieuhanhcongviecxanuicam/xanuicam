(async ()=>{
  try{
    const axios = require('axios');
    const fs = require('fs');
    const FormData = require('form-data');
    const base = 'http://localhost:3000/api';
    // login endpoint is available at /auth/login (alias) as well as /api/auth/login
    const login = await axios.post('http://localhost:3000/auth/login',{ identifier: 'auto_e2e_admin', password: 'AutoE2E!234' });
    const token = login.data.token;
    const auth = { headers: { Authorization: 'Bearer ' + token } };
    const fd = new FormData();
    const start = new Date(Date.now()+3600*1000).toISOString();
    const end = new Date(Date.now()+2*3600*1000).toISOString();
    fd.append('room_name','Phòng A');
    fd.append('title','Basis Test ' + Date.now());
    fd.append('start_time', start);
    fd.append('end_time', end);
    fd.append('leader_in_charge', '');
    fd.append('basis_super', 'Quyết định Số 123/QĐ');
    fd.append('basis_commune', 'Quyết định Xã ABC');
    fd.append('attachments', fs.createReadStream('tmp/test_upload.pdf'));
    const create = await axios.post(base + '/room-bookings', fd, Object.assign({ headers: Object.assign({}, fd.getHeaders(), { Authorization: 'Bearer ' + token }) }, { maxContentLength: Infinity, maxBodyLength: Infinity }));
    console.log('created', create.data);
    const id = create.data.id;
    const get = await axios.get(base + '/room-bookings', { params: { start: new Date().toISOString(), end: new Date(Date.now()+24*3600*1000).toISOString() }, headers: { Authorization: 'Bearer ' + token } });
    console.log('bookings sample', get.data.slice(0,5));
    process.exit(0);
  }catch(e){ console.error('Error stack:', e && (e.stack || e)); process.exit(2); }
})();