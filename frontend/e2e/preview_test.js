const puppeteer = require('puppeteer');

(async () => {
  const headlessEnv = (process.env.E2E_HEADLESS || 'true').toLowerCase();
  const headless = !(headlessEnv === 'false' || headlessEnv === '0');
  const browser = await puppeteer.launch({ headless, defaultViewport: { width: 1200, height: 900 }, args: ['--no-sandbox'], devtools: !headless, slowMo: headless ? 0 : 50 });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  // allow passing a token for authenticated routes (set E2E_TOKEN env var)
  const E2E_TOKEN = process.env.E2E_TOKEN || '';
  const fs = require('fs');
  try {
    // capture console logs to file for debugging
    page.on('console', msg => {
      try { require('fs').appendFileSync('e2e/puppeteer_console.log', String(msg.text()) + '\n'); } catch(e){}
    });
    // If a token is provided, set it in localStorage so private routes are accessible
    if (E2E_TOKEN) {
      await page.goto('about:blank');
      await page.evaluate((t) => { try { localStorage.setItem('token', t); } catch (e) {} }, E2E_TOKEN);
    }
    // Try common dev ports (3000 default CRA, 3001 if 3000 occupied)
    const urls = ['http://localhost:3000/meetings', 'http://localhost:3001/meetings'];
    let loaded = false;
    for (const u of urls) {
      try {
        await page.goto(u, { waitUntil: 'networkidle2' });
        loaded = true;
        break;
      } catch (e) {
        // try next
      }
    }
    if (!loaded) throw new Error('Could not load /meetings on localhost:3000 or 3001');
    // Navigate to dev preview page to reliably test preview UI
    const devUrls = ['http://localhost:3000/dev/preview', 'http://localhost:3001/dev/preview'];
    let devLoaded = false;
    for (const v of devUrls) {
      try { await page.goto(v, { waitUntil: 'networkidle2' }); devLoaded = true; break; } catch(e){}
    }
    if (!devLoaded) throw new Error('Could not load /dev/preview on localhost:3000 or 3001');
    await page.waitForSelector('input#dev-url', { timeout: 5000 });
    await page.type('#dev-url', '/logo192.png');
    // Click the first button with class 'btn' (Preview)
    await page.click('button.btn');
    // Give the UI a moment to render the modal
    await new Promise(r => setTimeout(r, 1000));
    // Save a screenshot and page HTML to help debugging if modal doesn't appear
    try { await page.screenshot({ path: 'e2e/preview_screenshot.png', fullPage: true }); } catch (e) {}
    try { const html = await page.content(); fs.writeFileSync('e2e/preview_page.html', html); } catch (e) {}
    // Wait for modal close button 'Đóng' by checking button texts
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent && b.textContent.includes('Đóng')), { timeout: 30000 });
    console.log('Preview modal appeared (dev preview flow)');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('E2E preview test failed:', err);
    await browser.close();
    process.exit(2);
  }
})();
