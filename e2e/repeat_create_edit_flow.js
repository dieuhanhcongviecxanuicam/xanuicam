const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const pool = require('../backend/src/db');
const bcrypt = require('bcryptjs');

async function ensureTestUser(username, plainPassword) {
  // ensure role exists
  let roleId = null;
  try {
    const roleRes = await pool.query('SELECT id FROM roles ORDER BY id LIMIT 1');
    roleId = roleRes.rows[0] ? roleRes.rows[0].id : null;
  } catch (e) {
    // roles table may not exist in fresh DB; create a minimal table to allow seeding
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, role_name TEXT, level INTEGER)`);
      const ins = await pool.query("INSERT INTO roles (role_name, level) VALUES ('e2e_role',1) RETURNING id");
      roleId = ins.rows[0].id;
    } catch (inner) {
      console.warn('E2E: could not create roles table:', inner && inner.message ? inner.message : inner);
    }
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);

  const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  let userId;
  if (userRes.rows[0]) {
    userId = userRes.rows[0].id;
    await pool.query('UPDATE users SET password_hash=$1, full_name=$2, role_id=$3, is_active=TRUE WHERE id=$4', [hash, 'E2E Test User', roleId, userId]);
  } else {
    const r = await pool.query('INSERT INTO users (username, password_hash, full_name, role_id, is_active) VALUES ($1,$2,$3,$4,TRUE) RETURNING id', [username, hash, 'E2E Test User', roleId]);
    userId = r.rows[0].id;
  }
  return { id: userId };
}

async function run() {
  const argv = require('minimist')(process.argv.slice(2));
  const iterations = Number(argv.iterations || process.env.E2E_ITERATIONS || 100);
  const consecutiveSuccessTarget = Number(argv.success || process.env.E2E_SUCCESS_TARGET || 5);
  const headful = argv.headful || process.env.HEADFUL === '1';
  const base = process.env.E2E_BASE || 'http://localhost:3000';
  const username = process.env.E2E_USER || argv.user || 'e2e_test_user';
  const password = process.env.E2E_PASS || argv.pass || 'P@ssw0rd123';

  const outDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('E2E repeat test starting', { base, username, iterations, consecutiveSuccessTarget, headful });

  try {
    try {
      await ensureTestUser(username, password);
    } catch (dbErr) {
      console.warn('E2E: could not ensure user (DB error), proceeding without DB seeding:', dbErr && dbErr.message ? dbErr.message : dbErr);
    }

    const browser = await puppeteer.launch({ headless: !headful, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

      // Helpers: robust token fetch with retries and reset profile cooldown via DB
      const http = require('http');

      async function fetchToken(identifier, pass, retries = 4) {
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            const data = JSON.stringify({ identifier, password: pass });
            const opts = { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
            const token = await new Promise((resolve) => {
              const req = http.request(opts, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                  if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { const j = JSON.parse(body); resolve(j && j.token ? j.token : null); } catch (e) { resolve(null); }
                  } else {
                    resolve(null);
                  }
                });
              });
              req.on('error', () => resolve(null));
              req.write(data); req.end();
            });
            if (token) return token;
          } catch (e) {}
          await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
        }
        return null;
      }

      async function resetProfileCooldown(identifier) {
        try {
          // verify column exists first
          const col = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_last_updated_at' LIMIT 1");
          if (!col.rows || col.rows.length === 0) {
            console.log('E2E: profile_last_updated_at column not present; skipping reset');
            return false;
          }
          await pool.query('UPDATE users SET profile_last_updated_at = NULL WHERE cccd = $1 OR username = $1', [identifier]);
          console.log('E2E: reset profile_last_updated_at for', identifier);
          return true;
        } catch (e) {
          console.warn('E2E: resetProfileCooldown failed:', e && e.message ? e.message : e);
          return false;
        }
      }

      // E2E config
      const configuredUser = process.env.E2E_USER || argv.user || username;
      const configuredPass = process.env.E2E_PASS || argv.pass || password;
      const autoResetCooldown = (process.env.E2E_RESET_COOLDOWN || '1') !== '0';

      // attempt to fetch token and set it in localStorage so page-level auth works
      if (configuredUser && configuredPass) {
        try {
          const tkn = await fetchToken(configuredUser, configuredPass);
          if (tkn) {
            await page.evaluate((t) => { try { localStorage.setItem('token', t); } catch (e) {} }, tkn);
            console.log('E2E: set token in localStorage via API login');
          } else {
            console.warn('E2E: could not obtain token via API');
          }
        } catch (e) { console.warn('E2E: token fetch error', e && e.message ? e.message : e); }
      }

    const logs = [];
    page.on('console', msg => { const text = `${msg.type().toUpperCase()}: ${msg.text()}`; logs.push(text); console.log(text); });
    page.on('pageerror', err => { const e = `PAGEERROR: ${err.toString()}`; logs.push(e); console.error(e); });

    // capture network responses for profile update
    let lastProfileStatus = null;
    page.on('requestfinished', async (req) => {
      try {
        const url = req.url();
        if (url.includes('/auth/profile') || url.includes('/api/auth/profile')) {
          const res = req.response();
          const status = res ? res.status() : 'N/A';
          lastProfileStatus = status;
          const reqBody = req.postData ? req.postData() : '';
          const respText = res ? await res.text().catch(()=>'') : '';
          const t = `[NETWORK] ${status} ${url} REQ=>${reqBody} RESP=>${respText}`;
          logs.push(t);
          console.log(t);
        }
      } catch (e) {}
    });

    let consecutiveSuccess = 0;
    for (let i = 0; i < iterations; i++) {
      console.log(`Iteration ${i+1}/${iterations}`);
      // reset profile cooldown in DB so E2E can perform repeated updates
      if (autoResetCooldown && configuredUser) {
        try { await resetProfileCooldown(configuredUser); } catch(e) {}
      }

      // login with retries: submit UI form and wait for token in localStorage
      const usernameSelector = 'input[name="username"], input[name="email"], input#username, input#email, input#identifier, input[id="identifier"]';
      const passwordSelector = 'input[name="password"], input#password, input[id="password"]';
      const submitSelector = 'button[type="submit"], button.btn-primary, button.btn, input[type="submit"]';

      let loggedIn = false;
      for (let attemptLogin = 0; attemptLogin < 3 && !loggedIn; attemptLogin++) {
        try {
          await page.goto(`${base}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
          await new Promise(r => setTimeout(r, 400));
          const uEl = await page.$(usernameSelector);
          const pEl = await page.$(passwordSelector);
          if (!uEl || !pEl) {
            console.warn('Login form not found (attempt', attemptLogin+1, ')');
            continue;
          }
          await uEl.click({ clickCount: 3 }); await uEl.type(username);
          await pEl.click({ clickCount: 3 }); await pEl.type(password);
          lastProfileStatus = null;
          await page.click(submitSelector).catch(()=>{});

          // wait up to 8s for client to set token in localStorage
          const start = Date.now();
          while ((Date.now() - start) < 8000) {
            const t = await page.evaluate(() => localStorage.getItem('token'));
            if (t) { loggedIn = true; break; }
            await new Promise(r => setTimeout(r, 250));
          }
          if (!loggedIn) console.warn('Login attempt did not produce token (attempt', attemptLogin+1, ')');
        } catch (e) {
          console.warn('Login attempt error:', e && e.message ? e.message : e);
        }
      }
      if (!loggedIn) console.warn('Failed to obtain client token after UI login attempts; proceeding to profile (fallbacks may be used)');

      // go to profile page
      await page.goto(`${base}/settings/profile`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('form', { timeout: 5000 }).catch(()=>{});

      // modify profile phone_number with timestamp to ensure change
      const newPhone = '0' + (Math.floor(Math.random()*900000000) + 100000000).toString().slice(0,9);
      // Try multiple selectors for phone input; if not found, fall back to updating profile via API using the token
      const phoneSelectors = ['input[name="phone_number"]','input[name="phone"]','input#phone','input[name="phoneNumber"]'];
      let phoneEl = null;
      for (const s of phoneSelectors) {
        phoneEl = await page.$(s);
        if (phoneEl) break;
      }
      if (!phoneEl) {
        console.warn('Profile phone input not found in UI; attempting API profile update as fallback');
        // try to fetch token again and call API profile endpoint
        const attemptToken = await fetchToken(configuredUser, configuredPass);
        if (attemptToken) {
          try {
            const http = require('http');
            await new Promise((resolve, reject) => {
              const data = JSON.stringify({ phone_number: newPhone });
              const opts = { hostname: 'localhost', port: 5000, path: '/api/auth/profile', method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), Authorization: 'Bearer ' + attemptToken } };
              const req = http.request(opts, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                  if (res.statusCode >= 200 && res.statusCode < 300) return resolve();
                  return reject(new Error(`Profile API update failed: ${res.statusCode} ${body}`));
                });
              });
              req.on('error', (e) => reject(e));
              req.write(data); req.end();
            });
            console.log('Profile updated via API fallback');
          } catch (apiErr) {
            console.warn('Profile API fallback failed:', apiErr && apiErr.message ? apiErr.message : apiErr);
          }
        } else {
          console.warn('Could not obtain token to perform API profile update fallback');
        }
      } else {
        await phoneEl.click({ clickCount: 3 });
        await phoneEl.type(newPhone);
      }

      // submit form
      await page.click('button[type="submit"], button.btn-primary').catch(()=>{});

      // wait up to 20s for network response to profile update
      const start = Date.now();
      while ((Date.now() - start) < 20000 && lastProfileStatus === null) {
        await new Promise(r => setTimeout(r, 200));
      }

      const status = lastProfileStatus;
      if (status && (status === 200 || status === 201)) {
        console.log(`Iteration ${i+1} profile update success (status=${status})`);
        consecutiveSuccess++;
      } else {
        console.error(`Iteration ${i+1} profile update failed (status=${status})`);
        consecutiveSuccess = 0;
        // save artifacts
        const prefix = `${i+1}-${Date.now()}`;
        await page.screenshot({ path: path.join(outDir, `failure-${prefix}.png`), fullPage: true }).catch(()=>{});
        fs.writeFileSync(path.join(outDir, `failure-${prefix}.log.txt`), logs.join('\n'));
      }

      if (consecutiveSuccess >= consecutiveSuccessTarget) {
        console.log(`Reached ${consecutiveSuccessTarget} consecutive successes; exiting.`);
        break;
      }

      // logout to ensure next iteration starts fresh
      try {
        await page.goto(`${base}/logout`, { waitUntil: 'networkidle2', timeout: 5000 }).catch(()=>{});
      } catch(e) {}
      await new Promise(r => setTimeout(r, 300));
    }

    await browser.close();
    await pool.end();
    console.log('E2E repeat test finished.');
    process.exit(0);
  } catch (err) {
    console.error('E2E repeat test error:', err);
    try { await pool.end(); } catch(e){}
    process.exit(2);
  }
}

run();
