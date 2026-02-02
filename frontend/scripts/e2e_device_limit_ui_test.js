const puppeteer = require('puppeteer');

(async () => {
  const BASE = process.env.BASE_URL || 'http://localhost:3000';
  const username = process.env.TEST_USER || 'temp_admin_auto';
  const password = process.env.TEST_PASS || 'TempAdmin!234';

  console.log('Launching headful browser (for reliable UI rendering and tracing)...');
  const fs = require('fs');
  const videosDir = 'frontend/scripts/videos';
  try { fs.mkdirSync(videosDir, { recursive: true }); } catch (e) {}
  const tracePath = `${videosDir}/trace-${Date.now()}.json`;
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox','--disable-setuid-sandbox'], defaultViewport: null, slowMo: 40 });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.tracing.start({ path: tracePath, screenshots: true });
  // Log responses for auth endpoints for debugging
  page.on('response', async (res) => {
    try {
      const url = res.url() || '';
      if (url.includes('/auth/login') || url.includes('/auth/sessions')) {
        const status = res.status();
        let text = '';
        try { text = await res.text(); } catch (e) { text = '<no-body>'; }
        console.log('[network]', url, 'status', status, 'body', text.slice(0, 1000));
      }
    } catch (e) {}
  });
  // Mirror page console to terminal for client-side errors
  page.on('console', msg => {
    try { console.log('[page]', msg.text()); } catch (e) {}
  });

  try {
    console.log('Navigating to login page...');
    await page.goto(BASE, { waitUntil: 'networkidle2' });

    // Wait for identifier input
    await page.waitForSelector('#identifier');
    await page.type('#identifier', username, { delay: 50 });
    await page.type('#password', password, { delay: 50 });

    console.log('Submitting login form...');
      const submitInfo = await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        const id = document.querySelector('#identifier');
        const pw = document.querySelector('#password');
        return {
          btnText: btn ? btn.innerText : null,
          btnDisabled: btn ? btn.disabled : null,
          identifierValue: id ? id.value : null,
          passwordValuePresent: !!(pw && pw.value),
        };
      });
      console.log('Submit button info:', submitInfo);
      await page.click('button[type="submit"]');
    // give the client some time to perform async work and send requests
    await new Promise(r => setTimeout(r, 2500));

    // After submit, the login page may show an error and auto-open the Device Manager modal.
    // Wait for either the modal header text or an error message that includes device-limit text.
    const modalSelector = 'div[role="dialog"]';

    console.log('Waiting for device manager modal or device-limit message...');
    let found = false;

    try {
      await page.waitForFunction(() => {
        const text = document.body.innerText || '';
        return /Quản lý thiết bị/.test(text) || /Bạn đã đăng nhập trên .* thiết bị/i.test(text);
      }, { timeout: 8000 });
      found = true;
    } catch (e) {
      found = false;
    }

    if (found) {
      console.log('Device manager UI detected (modal opened or message shown).');
      // Try to click the "Đăng xuất tất cả thiết bị khác" button if present
      const logoutAllBtn = await page.$x("//button[contains(., 'Đăng xuất tất cả thiết bị khác')]");
      if (logoutAllBtn && logoutAllBtn.length) {
        console.log('Found logout-all button, clicking it...');
        await logoutAllBtn[0].click();
        // wait a bit for any response
        await page.waitForTimeout(1500);
        console.log('Clicked logout-all button.');
      } else {
        console.log('Logout-all button not found in modal (it may require entering password first).');
      }
    } else {
      console.log('Device manager UI NOT detected.');
        // Capture page body text and a screenshot for debugging
        const bodyText = await page.evaluate(() => (document && document.body) ? document.body.innerText : '');
        console.log('--- PAGE BODY START ---');
        console.log(bodyText.slice(0, 2000));
        console.log('--- PAGE BODY END ---');
        const ssPath = `${videosDir}/login_flow_debug-${Date.now()}.png`;
        await page.screenshot({ path: ssPath, fullPage: true });
        console.log('Saved screenshot to', ssPath);
    }

    // stop tracing and save artifacts
    try {
      await page.tracing.stop();
      console.log('Saved chrome trace to', tracePath);
    } catch (e) { console.warn('Could not save trace:', e && e.message ? e.message : e); }

    await browser.close();
    process.exit(found ? 0 : 2);
  } catch (err) {
    console.error('E2E test error:', err && err.stack ? err.stack : err);
    try { await browser.close(); } catch (e) {}
    process.exit(3);
  }
})();
