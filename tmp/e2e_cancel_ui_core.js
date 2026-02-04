const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

(async ()=>{
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

(async ()=>{
  try{
    const tokenPath = '/tmp/admin_token.txt';
    const outDir = path.resolve(__dirname);
    const dbg = p=>{ try{ fs.appendFileSync(path.join(outDir,'e2e_debug_core.log'), p+'\n', 'utf8'); }catch(e){} };
    dbg('START');
    let token = '';
    try { token = fs.readFileSync(tokenPath,'utf8').trim(); } catch(_) { dbg('no token file at '+tokenPath); }
    const tmpDir = path.join(outDir, 'puppeteer_tmp');
    try { fs.mkdirSync(tmpDir, { recursive: true }); } catch(_) {}
    const candidates = [process.env.PUPPETEER_EXECUTABLE_PATH, '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean);
    let exe = candidates.find(p => { try { return fs.existsSync(p); } catch(e){ return false; } }) || (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser');
    dbg('launching browser, tmpDir='+tmpDir+' exe='+exe+' candidates='+JSON.stringify(candidates));
    let browser = null;
    const launchArgs = ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'];
    for (const candidate of [exe].concat(candidates)) {
      try {
        dbg('attempt launch with ' + candidate);
        browser = await puppeteer.launch({ args: launchArgs, userDataDir: tmpDir, executablePath: candidate, timeout: 60000, headless: true });
        dbg('browser launched with ' + candidate);
        break;
      } catch (e) {
        dbg('launch failed for ' + candidate + ' : ' + (e && e.message));
      }
    }
    if (!browser) throw new Error('Failed to launch Chromium with any candidate: ' + JSON.stringify(candidates));
    dbg('browser launched');
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.on('console', msg => dbg('PAGE_CONSOLE: ' + msg.text()));
    page.on('requestfailed', req => { try{ const f = req.failure() || {}; dbg('REQ_FAILED: '+req.url()+' - '+(f.errorText||f)); }catch(e){} });
    page.on('response', resp => { try{ dbg('RESP: '+resp.status()+' '+resp.url()); }catch(e){} });
    page.on('response', async resp => { try{ dbg('RESP: '+resp.status()+' '+resp.url()); if (resp.url().includes('/api/tasks')) { try{ const t = await resp.text(); dbg('RESP_BODY: '+resp.status()+' '+resp.url()+' => '+String(t).slice(0,2000)); }catch(e){ dbg('RESP_BODY_ERR: '+(e&&e.message)); } } }catch(e){} });
    const url = 'http://localhost:4001/cancel_test.html?_cb=' + Date.now();
    dbg('goto '+url);
    await page.setCacheEnabled(false);
    await page.goto(url, { waitUntil: 'networkidle2' });
    dbg('page loaded');
    if (!token) {
      try {
        const http = require('http');
        token = await new Promise((resolve, reject)=>{
          http.get('http://localhost:5001/internal/test/token', (res)=>{
            let b=''; res.setEncoding('utf8'); res.on('data', c=>b+=c); res.on('end', ()=> resolve(String(b).trim()));
          }).on('error', (e)=> reject(e));
        });
        dbg('fetched internal test token len=' + String((token||'').length));
      } catch (e) { dbg('no internal token: '+(e && e.message || e)); }
    }
    if (token) {
      // sanitize token and ensure header values are strings
      try {
        token = String(token).replace(/\r?\n/g, '').trim();
        const headers = { authorization: String('Bearer ' + token) };
        await page.setExtraHTTPHeaders(headers);
      } catch (e) {
        dbg('WARN: setExtraHTTPHeaders failed: ' + (e && e.message));
      }
      try { await page.evaluate(t=>{ window.__TEST_TOKEN__ = t; }, token); } catch(e) { dbg('WARN: evaluate token failed: '+(e&&e.message)); }
      dbg('token injected and extra headers set');
    } else {
      dbg('no token for injection');
    }
    dbg('click create');
    await page.click('#create');
    const WAIT_MS = 45000;
    try {
      await page.waitForFunction(()=>{
        const el = document.getElementById('out');
        if (!el) return false;
        const t = el.textContent || '';
        return /Created id=\d+/.test(t) || /Create error:/.test(t) || /Failed to fetch/.test(t);
      }, { timeout: WAIT_MS });
    } catch (e) {
      try { await page.screenshot({ path: path.join(__dirname,'e2e_ui_create_timeout_core.png'), fullPage: true }); }catch(_){}
      try { const outHtml = await page.evaluate(()=>document.documentElement.outerHTML); fs.writeFileSync(path.join(__dirname,'e2e_ui_create_timeout_core.html'), outHtml, 'utf8'); }catch(_){}
      throw e;
    }
    const createdText = await page.$eval('#out', el => el.textContent);
    const idMatch = createdText.match(/Created id=(\d+)/);
    if (!idMatch) {
      const res = { created: createdText, after: null };
      fs.writeFileSync(path.join(outDir, 'e2e_ui_result_core.json'), JSON.stringify(res, null, 2), 'utf8');
      await browser.close();
      console.error('E2E_ABORT creation failed:', createdText);
      process.exit(3);
    }
    const beforeShot = path.join(outDir, 'e2e_ui_before_core.png');
    await page.screenshot({ path: beforeShot, fullPage: true });
    dbg('click cancel');
    await page.click('#cancel');
    try {
      await page.waitForFunction(()=>document.getElementById('out') && /Patch result:/.test(document.getElementById('out').textContent), { timeout: WAIT_MS });
    } catch (e) {
      try { await page.screenshot({ path: path.join(__dirname,'e2e_ui_patch_timeout_core.png'), fullPage: true }); }catch(_){}
      try { const outHtml = await page.evaluate(()=>document.documentElement.outerHTML); fs.writeFileSync(path.join(__dirname,'e2e_ui_patch_timeout_core.html'), outHtml, 'utf8'); }catch(_){}
      throw e;
    }
    const afterText = await page.$eval('#out', el => el.textContent);
    const afterShot = path.join(outDir, 'e2e_ui_after_core.png');
    await page.screenshot({ path: afterShot, fullPage: true });
    const res = { created: createdText, after: afterText };
    fs.writeFileSync(path.join(outDir, 'e2e_ui_result_core.json'), JSON.stringify(res, null, 2), 'utf8');
    await browser.close();
    console.log('E2E_OK_CORE', JSON.stringify(res));
    process.exit(0);
  } catch (err) {
    console.error('E2E_ERR_CORE', err && err.stack || err);
    try{ fs.writeFileSync(path.join(__dirname,'e2e_ui_error_core.log'), String(err.stack||err), 'utf8'); }catch(e){}
    try{ fs.writeFileSync(path.join(__dirname,'e2e_ui_result_core.json'), JSON.stringify({ error: String(err.stack||err) }, null, 2), 'utf8'); }catch(e){}
    try{ fs.appendFileSync(path.join(__dirname,'e2e_debug_core.log'), 'ERROR: '+String(err.stack||err)+'\n', 'utf8'); }catch(e){}
    process.exit(2);
  }
})();
