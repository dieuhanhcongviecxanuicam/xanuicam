const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    const login = await axios.post('http://localhost:5000/api/auth/login',{identifier:'admin',password:'3pxQdHBGfXkgGYCviiPxGBBA',device:{userAgent:'node-test'}});
    const token = login.data.token;
    const res = await axios.get('http://localhost:5000/api/audit-logs/export-decrypted',{headers:{Authorization:`Bearer ${token}`}, responseType:'arraybuffer'});
    fs.writeFileSync('export_decrypted_test.csv', res.data);
    console.log('Wrote export_decrypted_test.csv');
  }catch(e){console.error(e.response?.status, e.response?.data || e.message)}
})();
