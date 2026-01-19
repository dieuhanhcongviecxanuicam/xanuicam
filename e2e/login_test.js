const fetch = require('node-fetch');
(async ()=>{
  try{
    const resp = await fetch('http://localhost:5000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'000000000001', password:'password'})});
    const text = await resp.text();
    console.log('status', resp.status);
    console.log(text);
  }catch(e){ console.error('ERR', e && e.stack?e.stack:e); }
})();
