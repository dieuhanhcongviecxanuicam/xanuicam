const puppeteer = require('puppeteer');

(async () => {
  const headlessEnv = (process.env.E2E_HEADLESS || 'true').toLowerCase();
  const headless = !(headlessEnv === 'false' || headlessEnv === '0');
  const browser = await puppeteer.launch({ headless, defaultViewport: { width: 1400, height: 900 }, args: ['--no-sandbox'], slowMo: headless ? 0 : 30 });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    const urls = ['http://localhost:3000/login', 'http://localhost:3001/login'];
    let loaded = false;
    for (const u of urls) {
      try { await page.goto(u, { waitUntil: 'networkidle2' }); loaded = true; break; } catch (e) {}
    }
    if (!loaded) throw new Error('Could not load /login on localhost:3000 or 3001');

    // Wait for the main login input to appear as a sign the page loaded
    await page.waitForSelector('#identifier, input[aria-label="Tên đăng nhập"]', { timeout: 10000 });

    // Take a screenshot for visual inspection
    await page.screenshot({ path: 'e2e/login_screenshot.png', fullPage: true });
    console.log('Saved screenshot to e2e/login_screenshot.png');

    // Basic sanity checks: ensure login button exists
    const hasLoginButton = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /đăng nhập/i.test(b.textContent || ''));
      return !!btn;
    });

    if (!hasLoginButton) {
      console.error('Login button not found on page');
      await browser.close();
      process.exit(4);
    }

    console.log('Login page loaded and login button present.');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('E2E login screenshot test failed:', err);
    try { await page.screenshot({ path: 'e2e/toggle_decor_error.png', fullPage: true }); } catch(e){}
    await browser.close();
    process.exit(2);
  }
})();
