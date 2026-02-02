const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    // Try dev server first, fallback to backend-served build
    const tryGoto = async (url) => {
      console.log('TRY_GOTO', url);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        console.log('GOTO_OK', url);
        return true;
      } catch (e) {
        console.log('GOTO_FAIL', url, e && e.message ? e.message : e);
        return false;
      }
    };

    let ok = await tryGoto('http://127.0.0.1:3000/#/login');
    if (ok) console.log('USING_DEV_SERVER_3000');
    if (!ok) {
      console.log('FALLBACK_TO_5000');
      await tryGoto('http://127.0.0.1:5000/#/login');
    }

    console.log('WAITING_FOR_IDENTIFIER_SELECTOR');
    await page.waitForSelector('#identifier', { timeout: 180000 });
    await page.type('#identifier', 'admin');
    await page.type('#password', 'password');
    await page.click('button[type=submit]');

    // Wait briefly for either navigation or error UI
    try { await Promise.race([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }), page.waitForSelector('div.mt-3.p-3.border.rounded.bg-yellow-50', { timeout: 120000 })]); } catch (e) {}

    // Handle device-limit modal if present
    const device = await page.$('div.mt-3.p-3.border.rounded.bg-yellow-50');
    if (device) {
      console.log('DEVICE_LIMIT_FOUND');
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Đăng xuất các thiết bị khác'));
        if (btn) btn.click();
      });
      await page.waitForSelector('input[name="logout-password"]', { timeout: 120000 });
      await page.type('input[name="logout-password"]', 'password');
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x=>x.textContent && x.textContent.includes('Xác nhận')); if (b) b.click(); });
      await sleep(800);
      // retry login: re-type credentials and click submit by multiple strategies
      try {
        await page.evaluate(() => { const id = document.querySelector('#identifier'); if (id) id.value = ''; const pw = document.querySelector('#password'); if (pw) pw.value = ''; });
        await page.type('#identifier', 'admin').catch(() => {});
        await page.type('#password', 'password').catch(() => {});
      } catch (e) {}

      const clicked = await page.evaluate(() => {
        const sel = document.querySelector('button[type=submit]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Đăng nhập')) || document.querySelector('input[type=submit]');
        if (sel) { sel.click(); return true; }
        return false;
      });
      if (!clicked) {
        await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /đăng nhập|login|xác nhận/i.test(x.textContent || '')); if (b) b.click(); });
      }
      try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }); } catch (e) { }
    }

    // Ensure we're logged in (token in localStorage). If missing, try a manual login.
    let token = null;
    for (let i = 0; i < 30; i++) {
      token = await page.evaluate(() => localStorage.getItem('token'));
      if (token) break;
      await sleep(1000);
    }
    console.log('TOKEN_PRESENCE_AFTER_LOGIN_CHECK', !!token);
    if (!token) {
      console.log('TOKEN_NOT_FOUND, attempting manual login');
      await page.goto('http://127.0.0.1:5000/#/login').catch(() => {});
      try { await page.waitForSelector('#identifier', { timeout: 30000 }); } catch (e) {}
      try { await page.type('#identifier', 'admin'); await page.type('#password', 'password'); } catch (e) {}
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent && x.textContent.includes('Đăng nhập')); if (b) b.click(); });
      for (let i = 0; i < 30; i++) {
        token = await page.evaluate(() => localStorage.getItem('token'));
        if (token) break;
        await sleep(1000);
      }
      console.log('TOKEN_AFTER_MANUAL_LOGIN', !!token);
    }

    // Attempt API create of a user via page context (requires token)
    const unique = Date.now();
    const username = `smoketestuser${unique}`;
    // Capture token in current origin (may be 3000) and call backend API directly with absolute URL
    const tokenNow = await page.evaluate(() => localStorage.getItem('token'));
    const apiCreate = await page.evaluate(async (username, token) => {
      try {
        if (!token) return { ok: false, reason: 'no-token' };
        const rolesRes = await fetch('http://127.0.0.1:5000/api/roles', { headers: { Authorization: `Bearer ${token}` } });
        const roles = rolesRes.ok ? await rolesRes.json() : null;
        const roleId = roles && roles.length ? roles[0].id : 4;
        const r = await fetch('http://127.0.0.1:5000/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ username, password: 'secret123', fullName: 'Smoke Test User', role_id: roleId }) });
        const txt = await r.text();
        return { ok: r.ok, status: r.status, body: txt };
      } catch (e) { return { ok: false, reason: e && e.message }; }
    }, username, tokenNow);
    console.log('API_CREATE_USER', apiCreate);

    // Go to profile and attempt update. Click the left-nav link to ensure client routing handles state.
    try {
      await page.waitForSelector('a[href="/settings/profile"]', { timeout: 5000 });
      await page.click('a[href="/settings/profile"]');
    } catch (e) {
      // fallback to direct navigation to common routes
      const profileRoutes = ['http://127.0.0.1:5000/#/settings/profile', 'http://127.0.0.1:5000/settings/profile', 'http://127.0.0.1:5000/#/profile', 'http://127.0.0.1:5000/profile'];
      let navigated = false;
      for (const r of profileRoutes) {
        try {
          await page.goto(r, { waitUntil: 'networkidle2' });
          navigated = true;
          break;
        } catch (err) {}
      }
      if (!navigated) await page.goto('http://127.0.0.1:5000/#/settings/profile', { waitUntil: 'networkidle2' }).catch(() => {});
    }
    // Poll for profile input to be present (resilient to slow renders)
    let found = false;
    for (let i = 0; i < 120; i++) {
      const el = await page.$('input[name="fullName"]');
      if (el) { found = true; break; }
      await sleep(1000);
    }
    if (!found) throw new Error('Waiting for selector `input[name="fullName"]` failed');
    const newName = `Updated Smoke ${unique}`;
    await page.click('input[name="fullName"]', { clickCount: 3 });
    await page.type('input[name="fullName"]', newName);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x=>x.textContent && x.textContent.includes('Cập nhật thông tin')); if (b) b.click(); });
    await sleep(1000);
    const notif = await page.evaluate(() => { const el = document.querySelector('div.fixed p'); return (el && el.innerText) || ''; });
    console.log('PROFILE_UPDATE_NOTIFICATION', notif);

    // Meeting docs smoke test removed

    console.log('SMOKE_DONE', { username, apiCreateOk: apiCreate.ok });

  } catch (err) {
    console.error('TEST_ERROR', err && err.message);
    try {
      const stamp = Date.now();
      const shot = path.join(tmpDir, `smoke-error-${stamp}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const html = await page.content();
      fs.writeFileSync(path.join(tmpDir, `smoke-error-${stamp}.html`), html, 'utf8');
      console.log('WROTE_ARTIFACTS', shot);
    } catch (e) { console.error('ARTIFACT_ERR', e && e.message); }
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
