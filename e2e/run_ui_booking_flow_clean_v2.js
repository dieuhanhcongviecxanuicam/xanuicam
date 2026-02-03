const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

(async () => {
  const BASE = process.env.E2E_BASE || 'http://localhost:3001';
  const API_BASE = 'http://localhost:5000/api';
  const ADMIN = process.env.E2E_USER || 'auto_e2e_admin';
  const ADMIN_PASS = process.env.E2E_PASS || 'AutoE2E!234';
  const TMP_PDF = path.resolve(__dirname, '..', 'tmp', 'test_upload.pdf');

  if (!fs.existsSync(TMP_PDF)) {
    fs.mkdirSync(path.dirname(TMP_PDF), { recursive: true });
    fs.writeFileSync(TMP_PDF, '%PDF-1.1\n%clean');
  }

  const login = await axios.post(API_BASE + '/auth/login', { identifier: ADMIN, password: ADMIN_PASS }).catch(e=>null);
  if (!login || !login.data || !login.data.token) {
    console.error('Could not login to API'); process.exit(2);
  }
  const token = login.data.token;

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(t => localStorage.setItem('token', t), token);
  await page.goto(BASE + '/meeting-room', { waitUntil: 'networkidle2' });

  // click first calendar cell
  const cell = await page.$('div.relative.cursor-pointer');
  if (!cell) { console.error('Calendar cell not found'); await browser.close(); process.exit(3); }
  await cell.click();

  await page.waitForSelector('input[name="title"]', { timeout: 5000 });
  const title = 'UI E2E Booking ' + Date.now();
  await page.type('input[name="title"]', title);
  const fileInput = await page.$('input[type=file]');
  if (fileInput) await fileInput.uploadFile(TMP_PDF);
  await page.click('button[type="submit"]');

  // wait and poll for booking via API
  for (let i=0;i<10;i++) {
    const resp = await axios.get(API_BASE + '/room-bookings', { headers: { Authorization: 'Bearer ' + token } }).catch(()=>null);
    const list = resp && resp.data ? resp.data : [];
    if (Array.isArray(list) && list.find(b=> (b.title||'').includes(title))) { console.log('Created booking found'); break; }
    await new Promise(r=>setTimeout(r,500));
  }

  await page.goto(BASE + '/meeting-room/deleted-attachments', { waitUntil: 'networkidle2' });
  const filename = path.basename(TMP_PDF);
  const found = await page.evaluate(fn => Array.from(document.querySelectorAll('td')).some(td=> (td.innerText||'').includes(fn)), filename);
  if (found) { console.log('Success: deleted attachment found', filename); await browser.close(); process.exit(0); }
  console.error('Deleted attachment not found');
  await browser.close();
  process.exit(1);

})();
