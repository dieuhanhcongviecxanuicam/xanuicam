const fs = require('fs');
const path = require('path');
(async () => {
  try {
    const puppeteer = require('puppeteer');
    const outDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const url = process.env.SCREENSHOT_URL || 'http://localhost:3002/roles/deleted';
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // wait for table or heading
    await page.waitForSelector('table, h1', { timeout: 10000 });
    const outPath = path.join(outDir, 'roles_deleted_screenshot.png');
    await page.screenshot({ path: outPath, fullPage: true });
    console.log('Screenshot saved to', outPath);
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('Screenshot failed:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
