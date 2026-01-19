const http = require('http');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
function postLogin(identifier, password){
  return new Promise((resolve,reject)=>{
    const data = JSON.stringify({ identifier, password });
    const options = { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(options, (res)=>{
      let body=''; res.on('data', c=>body+=c); res.on('end', ()=>{ try{ const j = JSON.parse(body); resolve({status:res.statusCode, body:j}); }catch(e){ resolve({status:res.statusCode, body:body}); } });
    });
    req.on('error', e=>reject(e)); req.write(data); req.end();
  });
}
(async()=>{
  const out = path.resolve(__dirname,'output'); if(!fs.existsSync(out)) fs.mkdirSync(out,{recursive:true});
  const login = await postLogin('000000000001','password');
  console.log('login result', login.status);
  if (!login.body || !login.body.token) { console.error('no token', login.body); process.exit(1); }
  const token = login.body.token;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage(); page.setViewport({width:1280,height:900});
  try{
    await page.goto('http://localhost:3000/settings/profile',{waitUntil:'networkidle2', timeout:60000}).catch(()=>{});
    // set token and reload
    await page.evaluate((t)=>{ try{ localStorage.setItem('token', t);}catch(e){} }, token);
    await page.goto('http://localhost:3000/settings/profile',{waitUntil:'networkidle2', timeout:60000});
    await page.screenshot({path:path.join(out,'dbg_profile_with_token.png')});
    const html = await page.content(); fs.writeFileSync(path.join(out,'dbg_profile_with_token.html'), html, 'utf8');
    console.log('Saved profile with token');
  } catch(e){ console.error('err', e && e.stack?e.stack:e); }
  await browser.close(); process.exit(0);
})();
