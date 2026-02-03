const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function run() {
  const argv = require('minimist')(process.argv.slice(2));
  const user = process.env.E2E_USER || argv.user;
  const pass = process.env.E2E_PASS || argv.pass;
  const base = process.env.E2E_BASE || 'http://localhost:5000';

  if (!user || !pass) {
    console.error('Missing credentials. Provide credentials using E2E_USER/E2E_PASS env vars or --user/--pass args.');
    console.error('Example: E2E_USER=admin E2E_PASS=secret node e2e/run_mfa_flow.js');
    process.exit(2);
  }

  const outDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const headful = (process.env.HEADFUL === '1') || argv.headful || argv.headful === 'true';
  const browser = await puppeteer.launch({ headless: !headful });
  const page = await browser.newPage();
  const logs = [];
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  page.on('console', msg => {
    const text = `${msg.type().toUpperCase()}: ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });
  page.on('pageerror', err => {
    const e = `PAGEERROR: ${err.toString()}`;
    logs.push(e);
    console.error(e);
  });
  page.on('requestfinished', async (req) => {
    try {
      const url = req.url();
      if (url.includes('/auth/mfa/disable') || url.includes('/auth/mfa/info') || url.includes('/auth/login')) {
        const res = req.response();
        const status = res ? res.status() : 'N/A';
        let respText = '';
        try { respText = res ? await res.text() : ''; } catch(e) { respText = ''; }
        const reqBody = req.postData ? req.postData() : '';
        const text = `[NETWORK] ${status} ${url} REQ=>${reqBody} RESP=>${respText}`;
        logs.push(text);
        console.log(text);
      }
    } catch (e) {}
  });

  try {
    await page.setViewport({ width: 1280, height: 900 });

    // Go to login page
    await page.goto(`${base}/login`, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(outDir, '01_login_page.png') });

    // attempt to fill login form
    // Common selectors: input[name=username], input[name=password] or #username, #password
    const usernameSelector = 'input[name="username"], input[name="email"], input#username, input#email, input#identifier, input[id="identifier"]';
    const passwordSelector = 'input[name="password"], input#password, input#identifier ~ input#password, input#password, input[id="password"]';
    const submitSelector = 'button[type="submit"], button.btn, button.login, input[type="submit"]';

    await sleep(500);
    const uEl = await page.$(usernameSelector);
    const pEl = await page.$(passwordSelector);
    if (!uEl || !pEl) {
      console.error('Could not find login form fields; adjust selectors.');
      await page.screenshot({ path: path.join(outDir, 'login_form_missing.png') });
      await browser.close();
      process.exit(3);
    }

    await uEl.click({ clickCount: 3 });
    await uEl.type(user);
    await pEl.click({ clickCount: 3 });
    await pEl.type(pass);

    // submit
    await Promise.all([
      page.click(submitSelector).catch(()=>{}),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(()=>{}),
    ]);
    await page.screenshot({ path: path.join(outDir, '02_after_login.png') });

    // Navigate to /settings/mfa
    await page.goto(`${base}/settings/mfa`, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(outDir, '03_mfa_page.png') });

    // Capture console logs and check for presence of "Tắt MFA" or "Bật MFA" button
    const allButtons = await page.$$('button');
    let foundDisable = null;
    let foundEnable = null;
    for (const b of allButtons) {
      const txt = (await page.evaluate(el => el.innerText || el.textContent, b)).trim();
      if (!foundDisable && txt.includes('Tắt MFA')) foundDisable = b;
      if (!foundEnable && txt.includes('Bật MFA')) foundEnable = b;
    }

    if (foundDisable) {
      // Click disable, confirm modal
      await foundDisable.click();
      await sleep(500);
      await page.screenshot({ path: path.join(outDir, '04_disable_clicked.png') });

      // If a password modal appears, try to input password
      // Prefer modal-scoped password input (role=dialog) to avoid typing into the page login form
      const pwInput = await page.$('div[role="dialog"] input[type="password"], div[role="dialog"] input[name="password"]');
      if (pwInput) {
        // Ensure full password is set directly to avoid typing issues in headless env
        await page.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, pwInput, pass);
        // confirm button in modal — find by text inside the dialog
        const modalConfirm = await page.$('div[role="dialog"] button');
        if (modalConfirm) {
          await Promise.all([
            modalConfirm.click().catch(()=>{}),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(()=>{}),
          ]);
        }
      }

      await sleep(1000);
      await page.screenshot({ path: path.join(outDir, '05_after_disable.png') });
    } else if (foundEnable) {
      console.log('MFA not enabled; found Bật MFA button.');
    } else {
      console.log('Could not find MFA enable/disable buttons.');
    }

      // Attempt to login again and verify the MFA page shows the expected button state
      await page.goto(`${base}/login`, { waitUntil: 'networkidle2' });
      await sleep(500);
      const uEl2 = await page.$(usernameSelector);
      const pEl2 = await page.$(passwordSelector);
      if (uEl2 && pEl2) {
        await uEl2.click({ clickCount: 3 }).catch(()=>{});
        await uEl2.type(user).catch(()=>{});
        await pEl2.click({ clickCount: 3 }).catch(()=>{});
        await pEl2.type(pass).catch(()=>{});
        await Promise.all([
          page.click(submitSelector).catch(()=>{}),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(()=>{}),
        ]);
        await page.screenshot({ path: path.join(outDir, '06_after_relogin.png') });
        await page.goto(`${base}/settings/mfa`, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(outDir, '07_mfa_after_relogin.png') });
        // scan buttons again
        const allButtons2 = await page.$$('button');
        let foundEnableAfter = false;
        for (const b of allButtons2) {
          const txt = (await page.evaluate(el => el.innerText || el.textContent, b)).trim();
          if (txt.includes('Bật MFA')) { foundEnableAfter = true; break; }
        }
        logs.push('FOUND_ENABLE_AFTER=' + (foundEnableAfter ? '1' : '0'));
        console.log('FOUND_ENABLE_AFTER=' + (foundEnableAfter ? '1' : '0'));
      } else {
        console.log('Could not re-find login inputs for relogin.');
      }

    // Save logs
    fs.writeFileSync(path.join(outDir, 'console.log.txt'), logs.join('\n'));
    console.log('Saved screenshots and console logs to', outDir);

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('E2E script error:', err);
    fs.writeFileSync(path.join(outDir, 'console.log.txt'), logs.join('\n'));
    await browser.close();
    process.exit(4);
  }
}

run();
