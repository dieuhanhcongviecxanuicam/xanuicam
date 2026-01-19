const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const url = process.env.URL || 'http://localhost:3001/computer-configs';
  console.log('E2E: opening', url);
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setViewport({ width: 1200, height: 900 });
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('HTTP status:', resp && resp.status());
    await page.waitForTimeout(800);
    const title = await page.$eval('h2', el => el.innerText).catch(() => null);
    console.log('Page H2:', title);

    // try to click first "Sửa cấu hình" button
    const editBtn = await page.$x("//button[contains(., 'Sửa cấu hình')]");
    if (editBtn && editBtn.length > 0) {
      console.log('Clicking first Sửa cấu hình');
      await editBtn[0].click();
      await page.waitForTimeout(600);
      // screenshot modal
      await page.screenshot({ path: 'e2e_computer_configs_modal.png', fullPage: false });
      console.log('Saved screenshot e2e_computer_configs_modal.png');
    } else {
      console.log('No edit button found');
      await page.screenshot({ path: 'e2e_computer_configs_list.png', fullPage: true });
      console.log('Saved screenshot e2e_computer_configs_list.png');
    }

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('E2E error', err && err.message);
    try { await page.screenshot({ path: 'e2e_error.png' }); } catch (e) {}
    await browser.close();
    process.exit(2);
  }
})();
