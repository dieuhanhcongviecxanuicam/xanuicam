const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
  const IDENTIFIER = process.env.LOGIN_IDENTIFIER || process.env.IDENTIFIER || '';
  const PASSWORD = process.env.LOGIN_PASSWORD || process.env.PASSWORD || '';

  const outDir = path.resolve(__dirname, 'output');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}

  const networkEvents = [];
  const consoleEvents = [];

  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('request', (req) => {
    try {
      networkEvents.push({ type: 'request', method: req.method(), url: req.url(), headers: req.headers(), postData: req.postData(), timestamp: Date.now() });
    } catch (e) {}
  });

  page.on('response', async (res) => {
    try {
      const url = res.url();
      const status = res.status();
      let text = '';
      try { text = await res.text(); if (text && text.length > 2000) text = text.slice(0, 2000) + '...'; } catch (e) { text = '<unable to read body>'; }
      networkEvents.push({ type: 'response', url, status, headers: res.headers(), body: text, timestamp: Date.now() });
    } catch (e) {}
  });

  page.on('console', (msg) => {
    try {
      consoleEvents.push({ type: msg.type(), text: msg.text(), args: msg.args().map(a => String(a)), timestamp: Date.now() });
    } catch (e) {}
  });

  // Navigate to the frontend
  console.log('Opening', FRONTEND_URL);
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });

  // Wait for login form
  try {
    await page.waitForSelector('#identifier', { timeout: 5000 });
  } catch (e) {
    console.log('Login selector not found on page — continuing to capture network traffic anyway.');
  }

  if (IDENTIFIER && PASSWORD) {
    try {
      await page.type('#identifier', IDENTIFIER, { delay: 50 });
      await page.type('#password', PASSWORD, { delay: 50 });
      await page.click('button[type="submit"]');
    } catch (e) {
      console.log('Error filling login form:', e.message);
    }
  } else {
    console.log('No credentials provided via env (LOGIN_IDENTIFIER, LOGIN_PASSWORD).');
  }

  // Let the page run and capture events for a while
  const CAPTURE_MS = Number(process.env.CAPTURE_MS || 30000);
  console.log(`Capturing network + console events for ${CAPTURE_MS}ms...`);
  await new Promise((r) => setTimeout(r, CAPTURE_MS));

  // Save outputs
  fs.writeFileSync(path.join(outDir, 'network.json'), JSON.stringify(networkEvents, null, 2));
  fs.writeFileSync(path.join(outDir, 'console.json'), JSON.stringify(consoleEvents, null, 2));

  console.log('Saved network and console captures to e2e/output');

  // Keep browser open for manual inspection if HEADFUL remains; close after short delay
  const KEEP_OPEN = process.env.KEEP_BROWSER_OPEN === '1';
  if (!KEEP_OPEN) await browser.close();

  process.exit(0);
})();
