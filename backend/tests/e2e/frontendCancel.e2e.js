const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.goto('http://localhost:4001/cancel_test.html');
    // obtain a test token from backend dev helper and inject into page
    try {
      const tkRes = await fetch('http://localhost:3000/internal/test/token');
      if (tkRes.ok) {
        const token = await tkRes.text();
        await page.evaluate((t) => { window.__TEST_TOKEN__ = t; }, token);
      } else {
        console.warn('Could not obtain test token, proceeding without it');
      }
    } catch (e) {
      console.warn('Error fetching test token', e && e.message);
    }
    await page.click('#create');
    await page.waitForSelector('#cancel:not([disabled])', { timeout: 20000 });
    await page.click('#cancel');
    // wait for output to include 'Patch result' or timeout longer
    try {
      await page.waitForFunction(() => document.getElementById('out') && document.getElementById('out').textContent.includes('Patch result'), { timeout: 20000 });
    } catch (e) {
      const outErr = await page.$eval('#out', el => el.textContent).catch(() => '<<no output>>');
      console.error('Timeout waiting for Patch result. Current output:\n', outErr);
      await browser.close();
      process.exit(2);
    }
    const out = await page.$eval('#out', el => el.textContent);
    console.log('UI out:\n', out);
    const ok = out.includes('Patch result') && out.includes('Đã hủy');
    if (!ok) {
      console.error('UI E2E failed, output:', out);
      process.exit(2);
    }
    console.log('UI E2E success');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('E2E error', e);
    await browser.close();
    process.exit(3);
  }
})();
