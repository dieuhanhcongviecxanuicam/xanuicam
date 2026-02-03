const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
(async()=>{
  const out = path.resolve(__dirname,'output'); if(!fs.existsSync(out)) fs.mkdirSync(out,{recursive:true});
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setViewport({width:1280,height:900});
  try{
    await page.goto('http://localhost:3000/login',{waitUntil:'networkidle2', timeout:60000});
    await page.screenshot({path:path.join(out,'dbg_login_page.png')});
    await page.type('input[name="username"], input[name="email"], input#username, input#email, input#identifier','000000000001');
    await page.type('input[name="password"], input#password','password');
    await Promise.all([
      page.click('button[type="submit"], button.btn-primary, button.btn'),
      page.waitForNavigation({waitUntil:'networkidle2', timeout:20000}).catch(()=>{}),
    ]);
    await page.screenshot({path:path.join(out,'dbg_after_login.png')});
    await page.goto('http://localhost:3000/settings/profile',{waitUntil:'networkidle2', timeout:60000});
    await page.screenshot({path:path.join(out,'dbg_profile_page.png')});
    const html = await page.content();
    fs.writeFileSync(path.join(out,'dbg_profile_page.html'), html, 'utf8');
    console.log('Saved debug artifacts to e2e/output');
  } catch(e){
    console.error('Debug script error', e && e.stack ? e.stack : e);
  } finally{
    await browser.close();
    process.exit(0);
  }
})();
