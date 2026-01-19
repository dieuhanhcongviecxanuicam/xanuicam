const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');

(async ()=>{
  const FRONTEND = process.env.FRONTEND_BASE || 'http://localhost:3000';
  const USER = process.env.E2E_USER || 'admin';
  const PASS = process.env.E2E_PASS || 'password';
  const timeout = 120000;

  const tmpDir = path.join(os.tmpdir(), `e2e_export_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  console.log('Download dir:', tmpDir);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: tmpDir });

    page.setDefaultTimeout(timeout);
    console.log('Navigating to', FRONTEND);
    await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });

    // login
    await page.waitForSelector('#identifier');
    await page.type('#identifier', USER, { delay: 50 });
    await page.waitForSelector('#password');
    await page.type('#password', PASS, { delay: 50 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout }).catch(()=>{})
    ]);
    console.log('Logged in (UI)');

    // wait for dashboard title
    await page.waitForFunction(() => {
      const h = document.querySelector('h1');
      return h && /Bảng điều khiển|Dashboard|Báo cáo nhanh/.test(h.innerText);
    }, { timeout: timeout });
    console.log('Dashboard loaded');

    // open export dropdown via data-testid
    await page.waitForSelector('[data-testid="export-dropdown-button"]', { timeout });
    await page.click('[data-testid="export-dropdown-button"]');
    await page.waitForTimeout(300);

    // click Xuất Excel
    await page.waitForSelector('[data-testid="export-excel"]', { timeout });
    await page.click('[data-testid="export-excel"]');

    // wait for password modal to appear
    await page.waitForFunction(() => !!document.querySelector('div[role="dialog"]') || !!document.querySelector('input[type="password"]'), { timeout });

    // use data-testid for password input
    await page.waitForSelector('[data-testid="export-password-input"]', { timeout });
    await page.type('[data-testid="export-password-input"]', PASS, { delay: 50 });

    // click confirm button (text contains 'Xác nhận & Xuất')
    await page.waitForSelector('[data-testid="export-confirm-button"]', { timeout });
    // remove any existing files in tmpDir before clicking
    const before = fs.readdirSync(tmpDir);
    await page.click('[data-testid="export-confirm-button"]');

    // wait for a new file to appear
    const waitForFile = (dir, beforeSet, timeoutMs) => new Promise((resolve, reject) => {
      const start = Date.now();
      const iv = setInterval(() => {
        const now = Date.now();
        const files = fs.readdirSync(dir).filter(f => !beforeSet.includes(f));
        if (files.length > 0) { clearInterval(iv); resolve(files[0]); }
        if (now - start > timeoutMs) { clearInterval(iv); reject(new Error('Timed out waiting for download')); }
      }, 500);
    });

    console.log('Waiting for download...');
    const newFile = await waitForFile(tmpDir, before, 60000);
    const downloaded = path.join(tmpDir, newFile);
    console.log('Downloaded file:', downloaded);

    // Validate xlsx using exceljs
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(downloaded);
    const sheet = workbook.worksheets[0];
    console.log('Sheet name:', sheet.name);

    // expected sheet name pattern: xanuicam_dashboard_DDMMYYYY
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const expectedDay = `${pad(today.getDate())}${pad(today.getMonth()+1)}${today.getFullYear()}`;
    if (!sheet.name.includes('xanuicam_dashboard') || !sheet.name.includes(expectedDay)) {
      throw new Error(`Sheet name mismatch: got "${sheet.name}", expected to include "xanuicam_dashboard_${expectedDay}"`);
    }

    // check header row contains "Tiêu đề" and "Người thực hiện"
    const headerRow = sheet.getRow(1).values.map(v => v && typeof v === 'string' ? v.trim() : v);
    const hasTitle = headerRow.find(v => v && v.toString().includes('Tiêu đề'));
    const hasAssignee = headerRow.find(v => v && v.toString().includes('Người thực hiện')) || headerRow.find(v => v && v.toString().includes('Người thực hiện'));
    if (!hasTitle || !hasAssignee) {
      throw new Error('Expected headers not found in exported sheet');
    }

    console.log('E2E Puppeteer export validation succeeded');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('E2E Puppeteer export failed:', e && (e.stack || e));
    try { await browser.close(); } catch (er) {}
    process.exit(1);
  }
})();
