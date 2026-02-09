const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    // Try dev server first, fallback to backend-served build
    const tryGoto = async (url) => {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return true;
      } catch (e) {
        return false;
      }
    };

    let ok = await tryGoto('http://127.0.0.1:3000/#/login');
    if (!ok) {
      console.log('FALLBACK_TO_5000');
      await tryGoto('http://127.0.0.1:5000/#/login');
    }

    await page.waitForSelector('#identifier', { timeout: 120000 });
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
      // retry login
      await page.click('button[type=submit]');
      try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }); } catch (e) { }
    }

    // Attempt API create of a user via page context (requires token)
    const unique = Date.now();
    const username = `smoketestuser${unique}`;
    await page.goto('http://127.0.0.1:5000/#/users', { waitUntil: 'networkidle2' }).catch(() => {});
    const apiCreate = await page.evaluate(async (username) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return { ok: false, reason: 'no-token' };
        const rolesRes = await fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } });
        const roles = rolesRes.ok ? await rolesRes.json() : null;
        const roleId = roles && roles.length ? roles[0].id : 4;
        const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ username, password: 'secret123', fullName: 'Smoke Test User', role_id: roleId }) });
        const txt = await r.text();
        return { ok: r.ok, status: r.status, body: txt };
      } catch (e) { return { ok: false, reason: e && e.message }; }
    }, username);
    console.log('API_CREATE_USER', apiCreate);

    // Go to profile and attempt update
    await page.goto('http://127.0.0.1:5000/#/settings/profile', { waitUntil: 'networkidle2' }).catch(() => {});
    await page.waitForSelector('input[name="fullName"]', { timeout: 120000 });
    const newName = `Updated Smoke ${unique}`;
    await page.click('input[name="fullName"]', { clickCount: 3 });
    await page.type('input[name="fullName"]', newName);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x=>x.textContent && x.textContent.includes('Cập nhật thông tin')); if (b) b.click(); });
    await sleep(1000);
    const notif = await page.evaluate(() => { const el = document.querySelector('div.fixed p'); return (el && el.innerText) || ''; });
    console.log('PROFILE_UPDATE_NOTIFICATION', notif);

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
