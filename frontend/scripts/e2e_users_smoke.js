const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const url = process.env.URL || 'http://localhost:3001/users';
  console.log('E2E USERS: opening', url);
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setViewport({ width: 1400, height: 900 });
  try {
    // wait for server to accept connections (retry loop)
    const waitForServer = async (u, attempts = 12, delayMs = 1000) => {
      const urlObj = new URL(u);
      const http = urlObj.protocol === 'https:' ? require('https') : require('http');
      for (let i = 0; i < attempts; i++) {
        try {
          await new Promise((resolve, reject) => {
            const req = http.request({ method: 'GET', hostname: urlObj.hostname, port: urlObj.port, path: urlObj.pathname || '/', timeout: 3000 }, res => { res.resume(); resolve(); });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.end();
          });
          return true;
        } catch (e) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
      return false;
    };

    const ready = await waitForServer(url, 20, 1000);
    if (!ready) throw new Error('Server did not respond');
    // If an E2E_TOKEN is provided, inject it into localStorage before loading the app.
    let token = process.env.E2E_TOKEN;
    if (!token && process.env.E2E_USER && process.env.E2E_PASS) {
      // attempt to obtain a token from backend auth endpoint
      try {
        const apiHost = (new URL(url)).origin.replace(/:\d+$/, ':5000');
        token = await (async () => {
          const http = require('http');
          const payload = JSON.stringify({ identifier: process.env.E2E_USER, password: process.env.E2E_PASS });
          const opts = { method: 'POST', hostname: 'localhost', port: 5000, path: '/auth/login', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, timeout: 5000 };
          return await new Promise((resolve, reject) => {
            const req = http.request(opts, res => {
              let bufs = '';
              res.setEncoding('utf8');
              res.on('data', d => bufs += d);
              res.on('end', () => {
                try {
                  const j = JSON.parse(bufs || '{}');
                  resolve(j.token || null);
                } catch (e) { resolve(null); }
              });
            });
            req.on('error', err => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.write(payload); req.end();
          });
        })();
        if (token) console.log('Obtained token from backend');
      } catch (e) {
        // ignore
      }
    }

    if (token) {
      // inject token into localStorage before navigating so SPA treats user as authenticated
      await page.goto('about:blank');
      await page.evaluate((t) => { try { localStorage.setItem('token', t); } catch (e) {} }, token);
    }

    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('HTTP status:', resp && resp.status());

    // take an initial screenshot and save HTML to help diagnose load issues
    await page.screenshot({ path: 'e2e_users_initial.png', fullPage: true });
    try { const html = await page.content(); require('fs').writeFileSync('e2e_users_initial.html', html); } catch (e) {}

    // If login form present, require E2E_USER/E2E_PASS and perform login (click submit explicitly)
    const hasLogin = await page.$('#identifier');
    if (hasLogin) {
      const user = process.env.E2E_USER;
      const pass = process.env.E2E_PASS;
      if (!user || !pass) {
        console.error('E2E: login detected but E2E_USER/E2E_PASS not set. Saved initial HTML/screenshot.');
        try { await page.screenshot({ path: 'e2e_users_need_credentials.png', fullPage: true }); } catch (e) {}
        await browser.close();
        process.exit(2);
      }
      try {
        await page.type('#identifier', user, { delay: 30 });
        // prefer password field if present
        const pwdSel = await page.$('#password');
        if (pwdSel) {
          await page.type('#password', pass, { delay: 30 });
        }
        // click submit button if available, otherwise press Enter
        let submit = await page.$('button[type=submit]');
        if (!submit) {
          // fallback: find a button by text using in-page evaluation (handles non-ASCII label)
          const tryTexts = ['Đăng nhập', 'Dang nhap'];
          for (const t of tryTexts) {
            const found = await page.evaluate((txt) => {
              const el = Array.from(document.querySelectorAll('button, input[type=submit]')).find(b => b && b.textContent && b.textContent.indexOf(txt) !== -1);
              return !!el;
            }, t);
            if (found) {
              // return first matching element handle
              submit = await page.evaluateHandle((txt) => Array.from(document.querySelectorAll('button, input[type=submit]')).find(b => b && b.textContent && b.textContent.indexOf(txt) !== -1), t).then(h => h.asElement());
              break;
            }
          }
          if (!submit) {
            // last resort: first form button
            const fh = await page.evaluateHandle(() => document.querySelector('form button, form input[type=submit]'));
            submit = fh && fh.asElement ? fh.asElement() : null;
          }
        }
        if (submit) {
          try { await submit.click(); } catch (e) { await page.keyboard.press('Enter'); }
        } else {
          await page.keyboard.press('Enter');
        }
        // wait for SPA navigation to users list
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200));
        await page.screenshot({ path: 'e2e_after_login.png', fullPage: true });
      } catch (e) {
        console.log('Login attempt failed', e.message || e);
      }
    }

    // wait for any of several selectors that indicate the users list has rendered
    const listSelectors = ['table', 'tbody tr', '[data-testid="users-list"]', '.users-table', '#users-table'];
    let found = false;
    for (const sel of listSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 8000 });
        found = true; break;
      } catch (e) {
        // try next
      }
    }
    if (!found) {
      // Dump HTML and a screenshot for debugging
      try {
        const html = await page.content();
        const fs = require('fs');
        fs.writeFileSync('e2e_users_failed.html', html, 'utf8');
        await page.screenshot({ path: 'e2e_users_failed.png', fullPage: true });
        console.log('Saved e2e_users_failed.html and e2e_users_failed.png for inspection');
      } catch (e) {
        console.log('Failed to save failure artifacts', e.message || e);
      }
      throw new Error('Users list did not appear (no matching selector)');
    }
    await new Promise(r => setTimeout(r, 500));
    // Screenshot list after table appears
    await page.screenshot({ path: 'e2e_users_list.png', fullPage: true });
    console.log('Saved screenshot e2e_users_list.png');

    // Hover first user name (dispatch mouseover to trigger JS hover handlers)
    const nameFound = await page.evaluate(() => {
      const el = document.querySelector('tbody tr td .text-sm.font-medium');
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
      return true;
    });
    if (nameFound) {
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: 'e2e_users_hover_name.png' });
      console.log('Saved screenshot e2e_users_hover_name.png');
    } else {
      console.log('Name element not found');
    }

    // Hover task count button
    const taskFound = await page.evaluate(() => {
      const row = document.querySelector('tbody tr');
      if (!row) return false;
      const btn = Array.from(row.querySelectorAll('button')).find(b => b && b.textContent && b.textContent.toLowerCase().includes('công việc'));
      if (!btn) return false;
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
      return true;
    });
    if (taskFound) {
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: 'e2e_users_hover_tasks.png' });
      console.log('Saved screenshot e2e_users_hover_tasks.png');
    } else {
      console.log('Task button not found');
    }

    // Hover department cell
    const deptCell = await page.$("tbody tr td:nth-child(3)");
    if (deptCell) {
      await deptCell.hover();
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: 'e2e_users_hover_dept.png' });
      console.log('Saved screenshot e2e_users_hover_dept.png');
    } else {
      console.log('Department cell not found');
    }

    // Change per-page selector to 20 (if exists)
    const perPageSelect = await page.$('select');
    if (perPageSelect) {
      // try options '20' or '20 b/c'
      try {
        await page.select('select', '20');
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({ path: 'e2e_users_perpage_20.png' });
        console.log('Selected per-page 20, screenshot e2e_users_perpage_20.png');
      } catch (e) {
        console.log('Could not set per-page via select:', e.message);
      }
    } else {
      console.log('Per-page select not found');
    }

    // Click Next button (by visible text 'Tiếp')
    const clickedNext = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b && b.textContent && b.textContent.includes('Tiếp'));
      if (!btn) return false;
      if (btn.disabled) return 'disabled';
      btn.click();
      return true;
    });
    if (clickedNext === 'disabled') console.log('Next button disabled (already last page)');
    else if (clickedNext) {
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: 'e2e_users_after_next.png', fullPage: true });
      console.log('Clicked Next, screenshot e2e_users_after_next.png');
    } else {
      console.log('Next button not found');
    }

    await browser.close();
    console.log('E2E USERS: done');
    process.exit(0);
  } catch (err) {
    console.error('E2E USERS error', err && err.message);
    try { await page.screenshot({ path: 'e2e_users_error.png' }); } catch (e) {}
    await browser.close();
    process.exit(2);
  }
})();
