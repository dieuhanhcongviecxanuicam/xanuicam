const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const results = [];
  const routes = ['/', '/tasks', '/settings/profile', '/audit-log'];
  const outDir = path.join(__dirname);
  const shotsDir = path.join(outDir, 'screenshots');
  if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  for (const route of routes) {
    const url = `http://localhost:5000${route}`;
    const consoleMessages = [];
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {}
    });

    let navError = null;
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      // Compatible delay: avoid Puppeteer API differences across versions
      await new Promise((res) => setTimeout(res, 1000));
      const screenshotPath = path.join(shotsDir, (route === '/' ? 'root' : route.replace(/[^a-z0-9_-]/gi, '_')) + '.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.push({ route, url, ok: true, screenshot: screenshotPath, console: consoleMessages });
    } catch (e) {
      navError = String(e);
      const screenshotPath = path.join(shotsDir, (route === '/' ? 'root_error' : route.replace(/[^a-z0-9_-]/gi, '_') + '_error') + '.png');
      try { await page.screenshot({ path: screenshotPath, fullPage: true }); } catch (er) {}
      results.push({ route, url, ok: false, error: navError, screenshot: screenshotPath, console: consoleMessages });
    }

    // remove listeners to avoid duplication
    page.removeAllListeners('console');
  }

  await browser.close();
  const outPath = path.join(outDir, 'headless_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('Headless test completed. Results written to', outPath);
  process.exit(0);
})();
