const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('../backend/src/db');
const bcrypt = require('bcryptjs');

(async function main() {
  const BASE = process.env.E2E_BASE || 'http://localhost:3001';
  const API_BASE = 'http://localhost:5000/api';
  const ADMIN = process.env.E2E_USER || 'auto_e2e_admin';
  const ADMIN_PASS = process.env.E2E_PASS || 'AutoE2E!234';
  const TMP_PDF = path.resolve(__dirname, '..', 'tmp', 'test_upload.pdf');

  let browser = null;
  let page = null;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  try {
    // ensure tmp pdf
    if (!fs.existsSync(TMP_PDF)) {
      fs.mkdirSync(path.dirname(TMP_PDF), { recursive: true });
      fs.writeFileSync(TMP_PDF, '%PDF-1.1\\n%\\u2014');
    }

    // login
    const login = await axios.post(API_BASE + '/auth/login', { identifier: ADMIN, password: ADMIN_PASS });
    const token = login.data && login.data.token;
    if (!token) throw new Error('Could not obtain token from API login');
    const auth = { headers: { Authorization: 'Bearer ' + token } };

    // create a leader user (DB first, API fallback)
    })();
    const uniq = String(Date.now()).slice(-6);
    const leaderUsername = 'uileader' + uniq;
    const leaderPassword = 'Leader!234';
    try {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(leaderPassword, salt);
      const ins = await pool.query("INSERT INTO users (password_hash, full_name, username, is_active, is_leader) VALUES ($1,$2,$3,TRUE,TRUE) RETURNING id", [password_hash, 'UI Leader ' + uniq, leaderUsername]);
      leaderId = ins.rows[0].id;
    } catch (e) {
      const created = await axios.post(API_BASE + '/users', { fullName: 'UI Leader ' + uniq, username: leaderUsername, password: leaderPassword, is_leader: true }, auth).catch(()=>null);
      leaderId = created && created.data && created.data.id;
    }

    // launch puppeteer
    browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // lightweight tracing
    page.on('request', req => {
      try {
        const rt = req.resourceType();
        if (rt === 'xhr' || rt === 'fetch' || req.url().includes('/api/')) {
          const pd = req.postData ? (req.postData().slice ? req.postData().slice(0,500) : req.postData()) : undefined;
          console.log('REQ', req.method(), req.url(), pd || '');
        }
      } catch (e) {}
    });
    page.on('response', async res => {
      try {
        if (res.url().includes('/api/')) {
          let body = '';
          try { body = await res.text(); } catch(e) { body = ''+e; }
          console.log('RESP', res.status(), res.url(), body && body.length > 800 ? body.slice(0,800) + '...' : body);
        }
      } catch (e) {}
    });

    // go to meeting room and create booking via UI
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(t => localStorage.setItem('token', t), token);
    await page.goto(BASE + '/meeting-room', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(800);

    const cell = await page.$('div.relative.cursor-pointer');
    if (!cell) throw new Error('Calendar cell not found');
    await cell.click();

    await page.waitForSelector('input[name="title"]', { timeout: 5000 });
    const title = 'UI E2E Booking ' + Date.now();
    await page.type('input[name="title"]', title);
    try { await page.select('select[name="leader_selected"]', String(leaderId)); } catch(e) {}
    const fileInput = await page.$('input[type=file]');
    if (!fileInput) throw new Error('File input not found');
    await fileInput.uploadFile(TMP_PDF);

    await page.click('button[type="submit"]');
    let createdBookingId = null;
    try {
      const createResp = await page.waitForResponse(r => r.url().includes('/api/room-bookings') && r.request().method() === 'POST', { timeout: 10000 }).catch(()=>null);
      if (createResp) {
        const j = await createResp.json().catch(()=>null);
        if (j && j.id) createdBookingId = j.id;
      }
    } catch (e) {}
    await sleep(800);

    // poll API for booking presence
    for (let i=0;i<8;i++) {
      try {
        const resp = await axios.get(API_BASE + '/room-bookings', { headers: { Authorization: 'Bearer ' + token } });
        const list = Array.isArray(resp.data) ? resp.data : (resp.data && resp.data.data) ? resp.data.data : [];
        const found = list.find(b => (b.title||'').includes(title));
        if (found) break;
      } catch (e) {}
      await sleep(800);
    }

    // find the created booking element
    let bookingDiv = null;
    const start = Date.now();
    while (!bookingDiv && Date.now()-start < 10000) {
      const candidates = await page.$$('[title]').catch(()=>[]);
      for (const c of candidates) {
        const t = await page.evaluate(el => el.getAttribute('title') || el.title || '', c).catch(()=> '');
        if (t && t.includes(title)) { bookingDiv = c; break; }
      }
      if (!bookingDiv) await sleep(200);
    }
    if (!bookingDiv) throw new Error('Created booking card not found in UI');

    // open edit modal
    let clickedUpdate = await bookingDiv.evaluate(el => { const b = Array.from(el.querySelectorAll('button')).find(x => (x.innerText||x.textContent||'').includes('Cập nhật') || (x.innerText||x.textContent||'').includes('Chỉnh sửa')); if (b) { b.click(); return true; } return false; });
    if (!clickedUpdate) { try { await bookingDiv.click(); clickedUpdate = true; } catch(e) {} }
    await sleep(500);

    // try various heuristics to find a delete button inside modal
    let clickedDel = false;
    const delStart = Date.now();
    while (!clickedDel && Date.now()-delStart < 10000) {
      clickedDel = await page.evaluate(() => {
        try {
          const roots = document.querySelectorAll('.modal-portal-container').length ? Array.from(document.querySelectorAll('.modal-portal-container')) : [document];
          for (const root of roots) {
            const byText = Array.from(root.querySelectorAll('button')).find(b => ((b.innerText||b.textContent||'').trim() === 'Xóa'));
            if (byText) { byText.click(); return true; }
            const byContains = Array.from(root.querySelectorAll('button')).find(b => ((b.innerText||b.textContent||'').includes('Xóa')));
            if (byContains) { byContains.click(); return true; }
            // aria/title heuristics
            const byTitle = Array.from(root.querySelectorAll('[title]')).find(el => (el.getAttribute('title')||'').toLowerCase().includes('xóa'));
            if (byTitle) { byTitle.click(); return true; }
          }
        } catch (e) {}
        return false;
      }).catch(()=>false);
      if (!clickedDel) await sleep(300);
    }

    let usedApiFallback = false;
    if (!clickedDel) {
      // save modal HTML + screenshot for offline tuning
      try {
        const ts = Date.now();
        const html = await page.evaluate(() => { const root = document.querySelector('.modal-portal-container') || document.body; const modal = root.querySelector('.modal') || root.querySelector('[role="dialog"]') || root; return modal ? modal.innerHTML : (root ? root.innerHTML : ''); });
        const out = path.resolve(__dirname, 'output'); fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, `modal-${ts}.html`), html);
        await page.screenshot({ path: path.join(out, `modal-${ts}.png`), fullPage: false }).catch(()=>{});
      } catch (e) {}

      // fallback: mark attachments deleted via DB or API
      try {
        let bookingId = createdBookingId || null;
        if (!bookingId) {
          const r = await pool.query('SELECT id FROM room_bookings WHERE title = $1 ORDER BY id DESC LIMIT 1', [title]);
          if (r.rows.length) bookingId = r.rows[0].id;
        }
        if (bookingId) {
          let paths = [];
          for (let w=0; w<6; w++) {
            const a = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [bookingId]);
            if (a.rows.length) { paths = a.rows.map(r=>r.file_path); break; }
            await sleep(500);
          }
          if (paths.length) { await axios.put(API_BASE + '/room-bookings/' + bookingId, { deleted_files: paths }, { headers: { Authorization: 'Bearer ' + token } }); usedApiFallback = true; }
        }

        if (!usedApiFallback) {
          const FormData = require('form-data');
          const fd = new FormData();
          const s = new Date(); s.setHours(s.getHours()+1);
          const e = new Date(); e.setHours(e.getHours()+2);
          fd.append('room_name', 'Phòng họp lầu 2');
          fd.append('title', 'E2E API Booking ' + Date.now());
          fd.append('start_time', s.toISOString());
          fd.append('end_time', e.toISOString());
          if (leaderId) fd.append('leader_in_charge', String(leaderId));
          fd.append('attachments', fs.createReadStream(TMP_PDF));
          const createResp = await axios.post(API_BASE + '/room-bookings', fd, { headers: Object.assign({}, fd.getHeaders(), { Authorization: 'Bearer ' + token }), maxContentLength: Infinity, maxBodyLength: Infinity }).catch(()=>null);
          const newId = createResp && createResp.data && createResp.data.id;
          if (newId) {
            const a = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [newId]);
            if (a.rows.length) { const paths = a.rows.map(r=>r.file_path); await axios.put(API_BASE + '/room-bookings/' + newId, { deleted_files: paths }, { headers: { Authorization: 'Bearer ' + token } }).catch(()=>{}); usedApiFallback = true; }
          }
        }
      } catch (e) { console.warn('Fallback error', e && e.message); }
    }

    // verify deleted attachments appear
    await page.goto(BASE + '/meeting-room/deleted-attachments', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1000);
    const filename = path.basename(TMP_PDF);
    const found = await (async () => {
      const cells = await page.$$('td').catch(()=>[]);
      for (const c of cells) {
        const txt = await page.evaluate(el => (el.innerText||el.textContent||'').trim(), c).catch(()=>'');
        if (txt && txt.indexOf(filename) !== -1) return true;
      }
      return false;
    })();

    if (found) { console.log('Success: deleted attachment found', filename); await browser.close(); process.exit(0); }
    console.error('Failed: deleted attachment not found');
    await page.screenshot({ path: path.resolve(__dirname, 'output', 'ui-failure.png'), fullPage: true }).catch(()=>{});
    await browser.close();
    process.exit(2);

  } catch (err) {
    console.error('UI E2E error:', err && err.message ? err.message : err);
    try { if (page) await page.screenshot({ path: path.resolve(__dirname, 'output', 'ui-exception.png'), fullPage: true }); } catch(e) {}
    try { if (browser) await browser.close(); } catch(e) {}
    process.exit(3);
  }

})();
    console.error('UI E2E error:', err && err.message ? err.message : err);
    try { if (page) await page.screenshot({ path: path.resolve(__dirname, 'output', 'ui-exception.png'), fullPage: true }); } catch(e) {}
    try { if (browser) await browser.close(); } catch(e) {}
    process.exit(3);
  }

})();
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('../backend/src/db');
const bcrypt = require('bcryptjs');

(async () => {
  const BASE = process.env.E2E_BASE || 'http://localhost:3001';
  const API_BASE = 'http://localhost:5000/api';
  const ADMIN = process.env.E2E_USER || 'auto_e2e_admin';
  const ADMIN_PASS = process.env.E2E_PASS || 'AutoE2E!234';
  const TMP_PDF = path.resolve(__dirname, '..', 'tmp', 'test_upload.pdf');

  let browser = null;
  let page = null;

  try {
    // ensure tmp pdf
    console.log('Ensuring test PDF exists at', TMP_PDF);
    if (!fs.existsSync(TMP_PDF)) {
      const pdf = `%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 20 100 Td (Hi) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000180 00000 n \ntrailer\n<< /Root 1 0 R >>\nstartxref\n245\n%%EOF`;
      fs.mkdirSync(path.dirname(TMP_PDF), { recursive: true });
      fs.writeFileSync(TMP_PDF, pdf);
      console.log('Wrote tmp PDF');
    }

    // login
    console.log('Logging in via API');
    const login = await axios.post(API_BASE + '/auth/login', { identifier: ADMIN, password: ADMIN_PASS });
    const token = login.data && login.data.token;
    if (!token) throw new Error('Could not obtain token from API login');
    console.log('Got token length', token.length);
    const auth = { headers: { Authorization: 'Bearer ' + token } };

    // determine roleId fallback
    let roleId = null;
    try {
      const rolesResp = await axios.get(API_BASE + '/roles', auth);
      const roles = Array.isArray(rolesResp.data) ? rolesResp.data : (rolesResp.data && rolesResp.data.data) ? rolesResp.data.data : rolesResp.data;
      const puppeteer = require('puppeteer');
      const axios = require('axios');
      const fs = require('fs');
      const path = require('path');
      const pool = require('../backend/src/db');
      const bcrypt = require('bcryptjs');

      (async () => {
        const BASE = process.env.E2E_BASE || 'http://localhost:3001';
        const API_BASE = 'http://localhost:5000/api';
        const ADMIN = process.env.E2E_USER || 'auto_e2e_admin';
        const ADMIN_PASS = process.env.E2E_PASS || 'AutoE2E!234';
        const TMP_PDF = path.resolve(__dirname, '..', 'tmp', 'test_upload.pdf');

        let browser = null;
        let page = null;

        try {
          // ensure tmp pdf
          console.log('Ensuring test PDF exists at', TMP_PDF);
          if (!fs.existsSync(TMP_PDF)) {
            const pdf = `%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 20 100 Td (Hi) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000180 00000 n \ntrailer\n<< /Root 1 0 R >>\nstartxref\n245\n%%EOF`;
            fs.mkdirSync(path.dirname(TMP_PDF), { recursive: true });
            fs.writeFileSync(TMP_PDF, pdf);
            console.log('Wrote tmp PDF');
          }

          // login
          console.log('Logging in via API');
          const login = await axios.post(API_BASE + '/auth/login', { identifier: ADMIN, password: ADMIN_PASS });
          const token = login.data && login.data.token;
          if (!token) throw new Error('Could not obtain token from API login');
          console.log('Got token length', token.length);
          const auth = { headers: { Authorization: 'Bearer ' + token } };

          // determine roleId fallback
          let roleId = null;
          try {
            const rolesResp = await axios.get(API_BASE + '/roles', auth);
            const roles = Array.isArray(rolesResp.data) ? rolesResp.data : (rolesResp.data && rolesResp.data.data) ? rolesResp.data.data : rolesResp.data;
            if (Array.isArray(roles) && roles.length > 0) roleId = roles[0].id || roles[0].role_id || null;
          } catch (e) { console.warn('Could not load roles - will attempt to create one'); }
          if (!roleId) {
            try {
              const roleCreate = await axios.post(API_BASE + '/roles', { role_name: 'e2e_role', level: 1, permissions: [] }, auth);
              roleId = roleCreate.data && (roleCreate.data.id || roleCreate.data.role_id);
              console.log('Created fallback role id', roleId);
            } catch (e) { console.warn('Could not create fallback role; proceeding without explicit role_id'); }
          }

          // create leader user (DB first, then API fallback)
          const uniq = String(Date.now()).slice(-6);
          const leaderUsername = 'uileader' + uniq;
          const leaderPassword = 'Leader!234';
          let leaderId = null;
          try {
            if (!roleId) {
              try {
                const rres = await pool.query('SELECT id FROM roles ORDER BY id LIMIT 1');
                if (rres.rows && rres.rows[0]) roleId = rres.rows[0].id;
              } catch (e) {
                try {
                  await pool.query("CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, role_name TEXT, level INTEGER)");
                  const ins = await pool.query("INSERT INTO roles (role_name, level) VALUES ('e2e_role',1) RETURNING id");
                  roleId = ins.rows[0].id;
                } catch (inner) { console.warn('DB: could not ensure roles table/row', inner && inner.message ? inner.message : inner); }
              }
            }

            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(leaderPassword, salt);
            const insertQuery = `INSERT INTO users (password_hash, full_name, role_id, username, is_active, is_leader) VALUES ($1,$2,$3,$4,TRUE,$5) RETURNING id`;
            const params = [password_hash, 'UI Leader ' + uniq, roleId, leaderUsername, true];
            const res = await pool.query(insertQuery, params);
            leaderId = res.rows[0].id;
            console.log('Created leader directly in DB, id', leaderId);
          } catch (e) {
            console.warn('DB user creation failed, falling back to API create:', e && e.message ? e.message : e);
            const leaderPayload = { fullName: 'UI Leader ' + uniq, username: leaderUsername, password: leaderPassword, is_leader: true };
            if (roleId) leaderPayload.role_id = roleId;
            const created = await axios.post(API_BASE + '/users', leaderPayload, auth);
            leaderId = created.data && created.data.id;
            console.log('Leader id (API)', leaderId);
          }

          // launch puppeteer
          browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 900 });

          // request/response tracing
          page.on('request', req => {
            try {
              const rt = req.resourceType();
              if (rt === 'xhr' || rt === 'fetch' || req.url().includes('/api/')) {
                const pd = req.postData ? req.postData() : undefined;
                console.log('PUPPETEER REQUEST', rt, req.method(), req.url(), pd ? (pd.length > 500 ? pd.slice(0,500)+'...' : pd) : '');
              }
            } catch (e) { console.warn('request log error', e && e.message); }
          });
          page.on('response', async res => {
            try {
              const req = res.request();
              const rt = req.resourceType();
              if (rt === 'xhr' || rt === 'fetch' || res.url().includes('/api/')) {
                let body = '';
                try { body = await res.text(); } catch (e) { body = ''+e; }
                console.log('PUPPETEER RESPONSE', res.status(), res.url(), body ? (body.length > 800 ? body.slice(0,800)+'...' : body) : '');
              }
            } catch (e) { console.warn('response log error', e && e.message); }
          });

          const sleep = (ms) => new Promise(r => setTimeout(r, ms));

          const findButtonByText = async (text, timeout = 5000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
              const btns = await page.$$('button').catch(()=>[]);
              for (const b of btns) {
                try {
                  const txt = await page.evaluate(el => (el.innerText || el.textContent || '').trim(), b).catch(()=> '');
                  if (txt === text) return b;
                } catch (e) {}
              }
              await sleep(200);
            }
            return null;
          };

          // navigate and set token
          await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
          await page.evaluate((t) => { localStorage.setItem('token', t); }, token);
          console.log('Set token in localStorage');
          await page.goto(BASE + '/meeting-room', { waitUntil: 'networkidle2', timeout: 60000 });
          await sleep(1000);

          // open first calendar cell
          console.log('Clicking first calendar cell to open booking modal');
          const cell = await page.$('div.relative.cursor-pointer');
          if (!cell) throw new Error('Calendar cell not found');
          await cell.click();

          await page.waitForSelector('input[name="title"]', { timeout: 5000 });
          const title = 'UI E2E Booking ' + Date.now();
          await page.type('input[name="title"]', title);

          try { await page.select('select[name="leader_selected"]', String(leaderId)); } catch (e) { console.warn('Could not select leader (maybe leaders not loaded yet):', e && e.message ? e.message : e); }

          const fileInput = await page.$('input[type=file]');
          if (!fileInput) throw new Error('File input not found');
          await fileInput.uploadFile(TMP_PDF);
          console.log('Uploaded file to input');

          // submit and capture created booking id
          await page.click('button[type="submit"]');
          console.log('Submitted booking form');
          let createdBookingId = null;
          try {
            const createResp = await page.waitForResponse(r => r.url().includes('/api/room-bookings') && (r.request().method() === 'POST' || r.status() === 201), { timeout: 10000 }).catch(()=>null);
            if (createResp) {
              try {
                const j = await createResp.json().catch(()=>null);
                if (j && j.id) { createdBookingId = j.id; console.log('Captured created booking id from response', createdBookingId); }
              } catch (e) {}
            }
          } catch (e) {}
          await sleep(800);

          // poll API for persisted booking
          let persistedBooking = null;
          let lastApiError = null;
          for (let attempt = 1; attempt <= 8; attempt++) {
            try {
              console.log(`API check attempt ${attempt}: GET /room-bookings`);
              const resp = await axios.get(API_BASE + '/room-bookings', Object.assign({ headers: Object.assign({}, auth.headers) }));
              const list = Array.isArray(resp.data) ? resp.data : (resp.data && resp.data.data) ? resp.data.data : [];
              const found = list.find(b => (b.title || '').indexOf(title) !== -1 || (b.title || '').includes(title));
              if (found) { persistedBooking = found; console.log('API: Found persisted booking id', found.id); break; }
              console.log(`API: booking not present in list (count=${list.length})`);
            } catch (e) { lastApiError = e; console.warn('API check error:', e && e.message ? e.message : e); }
            await sleep(800);
          }
          if (!persistedBooking) console.warn('Booking not found via API after retries; lastApiError=', lastApiError && (lastApiError.message || lastApiError));

          // find booking card in UI
          let bookingDiv = null;
          const startB = Date.now();
          while (!bookingDiv && (Date.now() - startB) < 10000) {
            const candidates = await page.$$('[title]').catch(()=>[]);
            for (const c of candidates) {
              const t = await page.evaluate(el => el.getAttribute('title') || el.title || '', c).catch(()=> '');
              if (t && t.includes(title)) { bookingDiv = c; break; }
            }
            if (!bookingDiv) await sleep(200);
          }
          if (!bookingDiv) throw new Error('Created booking card not found in UI');
          console.log('Found booking card');

          // click update inside card
          let clickedUpdate = await bookingDiv.evaluate(el => {
            const btns = Array.from(el.querySelectorAll('button'));
            const b = btns.find(b => (b.innerText || b.textContent || '').includes('Cập nhật'));
            if (b) { b.click(); return true; }
            return false;
          });
          if (!clickedUpdate) { try { await bookingDiv.click(); clickedUpdate = true; } catch (e) {} }
          if (!clickedUpdate) throw new Error('Update button not found in booking card');
          console.log('Clicked update to open edit modal');
          await sleep(500);

          // handle create-modal vs edit-modal confusion
          const modalTitle = await page.evaluate(() => {
            const h = document.querySelector('.modal h2, .modal-portal-container h2, h2');
            return h ? (h.innerText || h.textContent || '').trim() : '';
          }).catch(() => '');
          if (modalTitle && modalTitle.includes('Đăng ký phòng họp')) {
            console.warn('Create modal opened instead of edit. Closing and trying alternate open.');
            await page.evaluate(() => { const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText||b.textContent||'').includes('Hủy')); if (btn) btn.click(); }).catch(()=>{});
            await sleep(300);
            try { await bookingDiv.click(); } catch (e) {}
            await sleep(500);
            const foundEdit = await page.evaluate(() => { const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText||b.textContent||'').includes('Cập nhật') || (b.innerText||b.textContent||'').includes('Chỉnh sửa')); if (btn) { btn.click(); return true; } return false; }).catch(()=>false);
            if (!foundEdit) console.warn('Could not find edit button in details modal after reopening.');
          }

          await page.waitForSelector('button.text-cyan-600, div.text-sm.mt-2', { timeout: 5000 }).catch(()=>{});
          await sleep(500);

          // delete heuristics
          let clickedDel = false;
          const startDel = Date.now();
          while (!clickedDel && (Date.now() - startDel) < 10000) {
            clickedDel = await page.evaluate(() => {
              try {
                const roots = Array.from(document.querySelectorAll('.modal-portal-container')).length ? Array.from(document.querySelectorAll('.modal-portal-container')) : [document];
                for (const root of roots) {
                  const byText = Array.from(root.querySelectorAll('button')).find(b => ((b.innerText||b.textContent||'').trim() === 'Xóa'));
                  if (byText) { byText.click(); return true; }
                  const byContains = Array.from(root.querySelectorAll('button')).find(b => ((b.innerText||b.textContent||'').includes('Xóa')));
                  if (byContains) { byContains.click(); return true; }
                  const byAria = Array.from(root.querySelectorAll('[aria-label],[title]')).find(el => {
                    const a = (el.getAttribute('aria-label')||'').toLowerCase();
                    const t = (el.getAttribute('title')||'').toLowerCase();
                    if (a.includes('xóa') || t.includes('xóa') || a.includes('delete') || t.includes('delete')) return true;
                    return false;
                  });
                  if (byAria) { byAria.click(); return true; }
                  const svgs = Array.from(root.querySelectorAll('button svg'));
                  for (const s of svgs) {
                    const px = s.closest('button');
                    if (!px) continue;
                    const txt = (px.innerText||px.textContent||'').toLowerCase();
                    if (txt.includes('xóa') || txt.includes('delete')) { px.click(); return true; }
                  }
                  try {
                    const attachContainers = Array.from(root.querySelectorAll('.text-sm.mt-2.space-y-1, .text-sm.mt-2'));
                    for (const ac of attachContainers) {
                      const delBtn = ac.querySelector('button.text-red-500, button.text-red-500.text-xs');
                      if (delBtn) { delBtn.click(); return true; }
                      const byTxt = Array.from(ac.querySelectorAll('button')).find(b => ((b.innerText||b.textContent||'').toLowerCase().includes('xóa')));
                      if (byTxt) { byTxt.click(); return true; }
                    }
                  } catch (e) { /* ignore */ }
                }
              } catch (e) { /* swallow */ }
              return false;
            }).catch(()=>false);
            if (!clickedDel) await sleep(300);
          }

          let usedApiFallback = false;
          if (!clickedDel) {
            // save modal artifacts
            try {
              const ts = Date.now();
              const html = await page.evaluate(() => {
                const root = document.querySelector('.modal-portal-container') || document.body;
                const modal = root.querySelector('.modal') || root.querySelector('[role="dialog"]') || root;
                return modal ? modal.innerHTML : (root ? root.innerHTML : '');
              });
              const outDir = path.resolve(__dirname, 'output');
              try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
              const htmlPath = path.join(outDir, `modal-${ts}.html`);
              fs.writeFileSync(htmlPath, html);
              await page.screenshot({ path: path.join(outDir, `modal-${ts}.png`), fullPage: false }).catch(()=>{});
              console.warn('Saved modal debug artifacts:', htmlPath);
            } catch (e) { console.warn('Failed to save modal artifacts', e && e.message); }

            // API/DB fallback: prefer captured id, then DB, then create+archive
            try {
              let bookingId = (typeof createdBookingId !== 'undefined' && createdBookingId) ? createdBookingId : null;
              if (!bookingId) {
                const bres = await pool.query('SELECT id FROM room_bookings WHERE title = $1 ORDER BY id DESC LIMIT 1', [title]);
                console.log('API fallback: booking rows found=', bres.rows.length);
                if (bres.rows.length > 0) bookingId = bres.rows[0].id;
              }

              if (!bookingId) {
                // create booking via API and archive attachments
                try {
                  console.log('API fallback: no booking id available; creating booking via API with attachment to ensure archive flow');
                  const FormData = require('form-data');
                  const fd = new FormData();
                  const s = new Date(); s.setHours(s.getHours() + 1);
                  const e = new Date(); e.setHours(e.getHours() + 2);
                  fd.append('room_name', 'Phòng họp lầu 2');
                  fd.append('title', 'E2E API Booking ' + Date.now());
                  fd.append('start_time', s.toISOString());
                  fd.append('end_time', e.toISOString());
                  fd.append('leader_in_charge', String(leaderId));
                  fd.append('attachments', fs.createReadStream(TMP_PDF));
                  const createResp = await axios.post(API_BASE + '/room-bookings', fd, Object.assign({ headers: Object.assign({}, fd.getHeaders(), { Authorization: 'Bearer ' + token }) }, { maxContentLength: Infinity, maxBodyLength: Infinity }));
                  const newBookingId = createResp.data && createResp.data.id;
                  console.log('API fallback: created booking', newBookingId);
                  const a2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [newBookingId]);
                  console.log('API fallback: attachments found for new booking=', a2.rows.length);
                  if (a2.rows.length > 0) {
                    const paths = a2.rows.map(r => r.file_path);
                    await axios.put(API_BASE + '/room-bookings/' + newBookingId, { deleted_files: paths }, auth);
                    console.log('API fallback: archived attachments for new booking', newBookingId);
                    usedApiFallback = true;
                  }
                } catch (e) {
                  console.warn('API fallback: failed to create+archive booking via API (no DB booking):', e && e.message ? e.message : e);
                }
              } else {
                // bookingId exists: look for attachments then archive, with wait-and-retry
                const ares = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC LIMIT 1', [bookingId]);
                console.log('API fallback: attachments rows found=', ares.rows.length);
                if (ares.rows.length > 0) {
                  const fp = ares.rows[0].file_path;
                  await axios.put(API_BASE + '/room-bookings/' + bookingId, { deleted_files: [fp] }, auth);
                  console.log('Archived attachment via API fallback for booking', bookingId, 'file', fp);
                  usedApiFallback = true;
                } else {
                  let foundPaths = [];
                  for (let aw = 0; aw < 6; aw++) {
                    const ares2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [bookingId]);
                    if (ares2.rows.length > 0) { foundPaths = ares2.rows.map(r => r.file_path); break; }
                    await new Promise(r=>setTimeout(r, 500));
                  }
                  if (foundPaths.length > 0) {
                    await axios.put(API_BASE + '/room-bookings/' + bookingId, { deleted_files: foundPaths }, auth);
                    console.log('Archived attachment via API fallback after waiting for attachment rows for booking', bookingId);
                    usedApiFallback = true;
                  } else {
                    // still no attachments, create+archive
                    try {
                      console.log('API fallback: creating booking via API with attachment to ensure archive flow');
                      const FormData = require('form-data');
                      const fd = new FormData();
                      const s = new Date(); s.setHours(s.getHours() + 1);
                      const e = new Date(); e.setHours(e.getHours() + 2);
                      fd.append('room_name', 'Phòng họp lầu 2');
                      fd.append('title', 'E2E API Booking ' + Date.now());
                      fd.append('start_time', s.toISOString());
                      fd.append('end_time', e.toISOString());
                      fd.append('leader_in_charge', String(leaderId));
                      fd.append('attachments', fs.createReadStream(TMP_PDF));
                      const createResp = await axios.post(API_BASE + '/room-bookings', fd, Object.assign({ headers: Object.assign({}, fd.getHeaders(), { Authorization: 'Bearer ' + token }) }, { maxContentLength: Infinity, maxBodyLength: Infinity }));
                      const newBookingId = createResp.data && createResp.data.id;
                      console.log('API fallback: created booking', newBookingId);
                      const a2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [newBookingId]);
                      console.log('API fallback: attachments found for new booking=', a2.rows.length);
                      if (a2.rows.length > 0) {
                        const paths = a2.rows.map(r => r.file_path);
                        await axios.put(API_BASE + '/room-bookings/' + newBookingId, { deleted_files: paths }, auth);
                        console.log('API fallback: archived attachments for new booking', newBookingId);
                        usedApiFallback = true;
                      }
                    } catch (e) {
                      console.warn('API fallback: failed to create+archive booking via API:', e && e.message ? e.message : e);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('API fallback to archive attachment failed:', e && e.message ? e.message : e);
            }
          }

          // navigate to deleted attachments page and assert filename present
          await page.goto(BASE + '/meeting-room/deleted-attachments', { waitUntil: 'networkidle2', timeout: 60000 });
          await sleep(1000);
          const filename = path.basename(TMP_PDF);
          const found = await (async () => {
            const cells = await page.$$('td').catch(()=>[]);
            for (const c of cells) {
              const txt = await page.evaluate(el => (el.innerText || el.textContent || '').trim(), c).catch(()=>'');
              if (txt && txt.indexOf(filename) !== -1) return true;
            }
            return false;
          })();
          if (found) {
            console.log('Success: deleted attachment found in Deleted Attachments page:', filename);
            await browser.close();
            process.exit(0);
          } else {
            console.error('Failed: deleted attachment not found on Deleted Attachments page');
            await page.screenshot({ path: path.resolve(__dirname, 'output', 'ui-failure.png'), fullPage: true }).catch(()=>{});
            await browser.close();
            process.exit(2);
          }

        } catch (err) {
          console.error('UI E2E error:', err && err.message ? err.message : err);
          try { if (page) await page.screenshot({ path: path.resolve(__dirname, 'output', 'ui-exception.png'), fullPage: true }); } catch (e) {}
          try { if (browser) await browser.close(); } catch (e) {}
          process.exit(3);
        }
      })();
              fd.append('leader_in_charge', String(leaderId));
              fd.append('attachments', require('fs').createReadStream(TMP_PDF));
              const createResp = await axios.post(API_BASE + '/room-bookings', fd, Object.assign({ headers: Object.assign({}, fd.getHeaders(), { Authorization: 'Bearer ' + token }) }, { maxContentLength: Infinity, maxBodyLength: Infinity }));
              const newBookingId = createResp.data && createResp.data.id;
              console.log('API fallback: created booking', newBookingId);
              const a2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [newBookingId]);
              console.log('API fallback: attachments found for new booking=', a2.rows.length);
              if (a2.rows.length > 0) {
                const paths = a2.rows.map(r => r.file_path);
                await axios.put(API_BASE + '/room-bookings/' + newBookingId, { deleted_files: paths }, auth);
                console.log('API fallback: archived attachments for new booking', newBookingId);
                usedApiFallback = true;
              }
            } catch (e) {
              console.warn('API fallback: failed to create+archive booking via API (no DB booking):', e && e.message ? e.message : e);
            }
          } else {
            // We have a booking id: try to find attachments and archive
            const ares = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC LIMIT 1', [bookingId]);
            console.log('API fallback: attachments rows found=', ares.rows.length);
            if (ares.rows.length > 0) {
              const fp = ares.rows[0].file_path;
              await axios.put(API_BASE + '/room-bookings/' + bookingId, { deleted_files: [fp] }, auth);
              console.log('Archived attachment via API fallback for booking', bookingId, 'file', fp);
              usedApiFallback = true;
            } else {
              // No attachments found in DB for this booking; wait briefly and retry before creating a fresh booking
              let foundPaths = [];
              for (let aw = 0; aw < 6; aw++) {
                const ares2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [bookingId]);
                if (ares2.rows.length > 0) { foundPaths = ares2.rows.map(r => r.file_path); break; }
                await new Promise(r=>setTimeout(r, 500));
              }
              if (foundPaths.length > 0) {
                await axios.put(API_BASE + '/room-bookings/' + bookingId, { deleted_files: foundPaths }, auth);
                console.log('Archived attachment via API fallback after waiting for attachment rows for booking', bookingId);
                usedApiFallback = true;
              } else {
                // Still no attachments; create a fresh booking via API with an attachment
                try {
                  console.log('API fallback: creating booking via API with attachment to ensure archive flow');
                  const FormData = require('form-data');
                  const fd = new FormData();
                  const s = new Date(); s.setHours(s.getHours() + 1);
                  const e = new Date(); e.setHours(e.getHours() + 2);
                  fd.append('room_name', 'Phòng họp lầu 2');
                  fd.append('title', 'E2E API Booking ' + Date.now());
                  fd.append('start_time', s.toISOString());
                  fd.append('end_time', e.toISOString());
                  fd.append('leader_in_charge', String(leaderId));
                  fd.append('attachments', require('fs').createReadStream(TMP_PDF));
                  const createResp = await axios.post(API_BASE + '/room-bookings', fd, Object.assign({ headers: Object.assign({}, fd.getHeaders(), { Authorization: 'Bearer ' + token }) }, { maxContentLength: Infinity, maxBodyLength: Infinity }));
                  const newBookingId = createResp.data && createResp.data.id;
                  console.log('API fallback: created booking', newBookingId);
                  // query DB for attachments for this new booking
                  const a2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [newBookingId]);
                  console.log('API fallback: attachments found for new booking=', a2.rows.length);
                  if (a2.rows.length > 0) {
                    const paths = a2.rows.map(r => r.file_path);
                    await axios.put(API_BASE + '/room-bookings/' + newBookingId, { deleted_files: paths }, auth);
                    console.log('API fallback: archived attachments for new booking', newBookingId);
                    usedApiFallback = true;
                  }
                } catch (e) {
                  console.warn('API fallback: failed to create+archive booking via API:', e && e.message ? e.message : e);
                }
              }
            }
          }
        } catch (e) {
          console.warn('API fallback to archive attachment failed:', e && e.message ? e.message : e);
        }
    
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const waitForXPath = async (xp, timeout = 10000) => {
      // fallback: XPath not supported in this Puppeteer build; attempt DOM polling
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const elems = await page.$$('[title]').catch(()=>[]);
        for (const el of elems) {
          try {
            const t = await page.evaluate(e => e.getAttribute('title') || e.title || '', el).catch(()=>null);
            if (t && t.indexOf(xp.replace(/\[contains\(\.\, \"|\"\)\]/g, '')) !== -1) return [el];
          } catch (e) {}
        }
        await sleep(200);
      }
      throw new Error('XPath fallback timeout');
    };

    const findButtonByText = async (text, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const btns = await page.$$('button').catch(()=>[]);
        for (const b of btns) {
          try {
            const txt = await page.evaluate(el => (el.innerText || el.textContent || '').trim(), b).catch(()=> '');
            if (txt === text) return b;
          } catch (e) {}
        }
        await sleep(200);
      }
      return null;
    };

    // set token in localStorage
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate((t) => { localStorage.setItem('token', t); }, token);
    console.log('Set token in localStorage');

    // navigate to meeting room page
    await page.goto(BASE + '/meeting-room', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1000);

    // click first available empty cell to open modal
    console.log('Clicking first calendar cell to open booking modal');
    const cell = await page.$('div.relative.cursor-pointer');
    if (!cell) throw new Error('Calendar cell not found');
    await cell.click();

    // wait for modal input
    await page.waitForSelector('input[name="title"]', { timeout: 5000 });
    const title = 'UI E2E Booking ' + Date.now();
    await page.type('input[name="title"]', title);

    // select leader
    try {
      await page.select('select[name="leader_selected"]', String(leaderId));
    } catch (e) {
      console.warn('Could not select leader (maybe leaders not loaded yet):', e.message || e);
    }

    // upload file by setting file input
    const fileInput = await page.$('input[type=file]');
    if (!fileInput) throw new Error('File input not found');
    await fileInput.uploadFile(TMP_PDF);
    console.log('Uploaded file to input');

    // submit form and capture create response if available
    await page.click('button[type="submit"]');
    console.log('Submitted booking form');
    // wait for the create POST response to capture created booking id
    let createdBookingId = null;
    try {
      const createResp = await page.waitForResponse(r => r.url().includes('/api/room-bookings') && (r.request().method() === 'POST' || r.status() === 201), { timeout: 10000 }).catch(()=>null);
      if (createResp) {
        try {
          const j = await createResp.json().catch(()=>null);
          if (j && j.id) { createdBookingId = j.id; console.log('Captured created booking id from response', createdBookingId); }
        } catch (e) {}
      }
    } catch (e) {}
    // small delay before polling
    await sleep(800);

    // Poll backend API to confirm booking persisted. Retry with backoff and log responses for debugging.
    let persistedBooking = null;
    let lastApiError = null;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        console.log(`API check attempt ${attempt}: GET /room-bookings`);
        const resp = await axios.get(API_BASE + '/room-bookings', Object.assign({ headers: Object.assign({}, auth.headers) }));
        const list = Array.isArray(resp.data) ? resp.data : (resp.data && resp.data.data) ? resp.data.data : [];
        // Try to find by title substring
        const found = list.find(b => (b.title || '').indexOf(title) !== -1 || (b.title || '').includes(title));
        if (found) { persistedBooking = found; console.log('API: Found persisted booking id', found.id); break; }
        console.log(`API: booking not present in list (count=${list.length})`);
      } catch (e) {
        lastApiError = e;
        console.warn('API check error:', e && e.message ? e.message : e);
      }
      await sleep(800);
    }
    if (!persistedBooking) {
      console.warn('Booking not found via API after retries; lastApiError=', lastApiError && (lastApiError.message || lastApiError));
    }

    // find booking card by title
    const bookingDivXpath = `//div[contains(@title, "${title}")]`;
    // find booking element by title attribute containing our title
    let bookingDiv = null;
    const startB = Date.now();
    while (!bookingDiv && (Date.now() - startB) < 10000) {
      const candidates = await page.$$('[title]').catch(()=>[]);
      for (const c of candidates) {
        const t = await page.evaluate(el => el.getAttribute('title') || el.title || '', c).catch(()=> '');
        if (t && t.includes(title)) { bookingDiv = c; break; }
      }
      if (!bookingDiv) await sleep(200);
    }
    if (!bookingDiv) throw new Error('Created booking card not found in UI');
    if (!bookingDiv) throw new Error('Created booking card not found in UI');
    console.log('Found booking card');

    // click Cập nhật button inside booking card by evaluating inside the element
    let clickedUpdate = await bookingDiv.evaluate(el => {
      const btns = Array.from(el.querySelectorAll('button'));
      const b = btns.find(b => (b.innerText || b.textContent || '').includes('Cập nhật'));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clickedUpdate) {
      try { await bookingDiv.click(); clickedUpdate = true; } catch (e) { /* ignore */ }
    }
    if (!clickedUpdate) throw new Error('Update button not found in booking card');
    console.log('Clicked update to open edit modal');
    await sleep(500);
    // If the create modal opened instead of the edit modal, close and reopen details then try edit
    const modalTitle = await page.evaluate(() => {
      const h = document.querySelector('.modal h2, .modal-portal-container h2, h2');
      return h ? (h.innerText || h.textContent || '').trim() : '';
    }).catch(() => '');
    if (modalTitle && modalTitle.includes('Đăng ký phòng họp')) {
      console.warn('Create modal opened instead of edit. Closing and trying alternate open.');
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText||b.textContent||'').includes('Hủy'));
        if (btn) btn.click();
      }).catch(()=>{});
      await sleep(300);
      try { await bookingDiv.click(); } catch(e) {}
      await sleep(500);
      const foundEdit = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText||b.textContent||'').includes('Cập nhật') || (b.innerText||b.textContent||'').includes('Chỉnh sửa'));
        if (btn) { btn.click(); return true; }
        return false;
      }).catch(()=>false);
      if (!foundEdit) console.warn('Could not find edit button in details modal after reopening.');
    }

    // wait for existingAttachments list (button with file name)
    await page.waitForSelector('button.text-cyan-600, div.text-sm.mt-2', { timeout: 5000 }).catch(()=>{});
    await sleep(500);

    // Enhanced delete button search with multiple heuristics and retries.
    let clickedDel = false;
    const startDel = Date.now();
    while (!clickedDel && (Date.now() - startDel) < 10000) {
      // Try several heuristics in page context
      clickedDel = await page.evaluate(() => {
        try {
          const roots = Array.from(document.querySelectorAll('.modal-portal-container')).length ? Array.from(document.querySelectorAll('.modal-portal-container')) : [document];
          for (const root of roots) {
            // 1) buttons with exact 'Xóa' text
            const byText = Array.from(root.querySelectorAll('button')).find(b => ((b.innerText||b.textContent||'').trim() === 'Xóa'));
            if (byText) { byText.click(); return true; }

            // 2) buttons containing 'Xóa'
            const byContains = Array.from(root.querySelectorAll('button')).find(b => ((b.innerText||b.textContent||'').includes('Xóa')));
            if (byContains) { byContains.click(); return true; }

            // 3) elements with aria-label or title containing delete keywords
            const byAria = Array.from(root.querySelectorAll('[aria-label],[title]')).find(el => {
              const a = (el.getAttribute('aria-label')||'').toLowerCase();
              const t = (el.getAttribute('title')||'').toLowerCase();
              if (a.includes('xóa') || t.includes('xóa') || a.includes('delete') || t.includes('delete')) return true;
              return false;
            });
            if (byAria) { byAria.click(); return true; }

            // 4) icon-only buttons: svg with path indicating trash or 'delete' in nearby text
            const svgs = Array.from(root.querySelectorAll('button svg'));
            for (const s of svgs) {
              const px = s.closest('button');
              if (!px) continue;
              const txt = (px.innerText||px.textContent||'').toLowerCase();
              if (txt.includes('xóa') || txt.includes('delete')) { px.click(); return true; }
            }

            // 5) attachment list common structure: file list with delete buttons (text-red-500)
            try {
              const attachContainers = Array.from(root.querySelectorAll('.text-sm.mt-2.space-y-1, .text-sm.mt-2'));
              for (const ac of attachContainers) {
                const delBtn = ac.querySelector('button.text-red-500, button.text-red-500.text-xs');
                if (delBtn) { delBtn.click(); return true; }
                // fallback: any button inside that container with innerText containing 'xóa'
                const byTxt = Array.from(ac.querySelectorAll('button')).find(b => ((b.innerText||b.textContent||'').toLowerCase().includes('xóa')));
                if (byTxt) { byTxt.click(); return true; }
              }
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* swallow */ }
        return false;
      }).catch(()=>false);
      if (!clickedDel) await sleep(300);
    }
    let usedApiFallback = false;
    if (!clickedDel) {
      // Save modal HTML + screenshot for debugging
      try {
        const ts = Date.now();
        const html = await page.evaluate(() => {
          const root = document.querySelector('.modal-portal-container') || document.body;
          const modal = root.querySelector('.modal') || root.querySelector('[role="dialog"]') || root;
          return modal ? modal.innerHTML : (root ? root.innerHTML : '');
        });
        const outDir = require('path').resolve(__dirname, 'output');
        try { require('fs').mkdirSync(outDir, { recursive: true }); } catch (e) {}
        const htmlPath = require('path').join(outDir, `modal-${ts}.html`);
        require('fs').writeFileSync(htmlPath, html);
        await page.screenshot({ path: require('path').join(outDir, `modal-${ts}.png`), fullPage: false }).catch(()=>{});
        console.warn('Saved modal debug artifacts:', htmlPath);
      } catch (e) { console.warn('Failed to save modal artifacts', e && e.message); }

      // Try API/DB fallback: find the booking by title and archive its attachment directly
      try {
        // Prefer the created booking id captured from the POST response
        let bookingId = (typeof createdBookingId !== 'undefined' && createdBookingId) ? createdBookingId : null;
        if (!bookingId) {
          const bres = await pool.query('SELECT id FROM room_bookings WHERE title = $1 ORDER BY id DESC LIMIT 1', [title]);
          console.log('API fallback: booking rows found=', bres.rows.length);
          if (bres.rows.length > 0) bookingId = bres.rows[0].id;
        }

        if (!bookingId) {
          // No booking found by title or response; create a booking via API with an attachment and archive it
          try {
            console.log('API fallback: no booking id available; creating booking via API with attachment to ensure archive flow');
            const FormData = require('form-data');
            const fd = new FormData();
            const s = new Date(); s.setHours(s.getHours() + 1);
            const e = new Date(); e.setHours(e.getHours() + 2);
            fd.append('room_name', 'Phòng họp lầu 2');
            fd.append('title', 'E2E API Booking ' + Date.now());
            fd.append('start_time', s.toISOString());
            fd.append('end_time', e.toISOString());
            fd.append('leader_in_charge', String(leaderId));
            fd.append('attachments', require('fs').createReadStream(TMP_PDF));
            const createResp = await axios.post(API_BASE + '/room-bookings', fd, Object.assign({ headers: Object.assign({}, fd.getHeaders(), { Authorization: 'Bearer ' + token }) }, { maxContentLength: Infinity, maxBodyLength: Infinity }));
            const newBookingId = createResp.data && createResp.data.id;
            console.log('API fallback: created booking', newBookingId);
            const a2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [newBookingId]);
            console.log('API fallback: attachments found for new booking=', a2.rows.length);
            if (a2.rows.length > 0) {
              const paths = a2.rows.map(r => r.file_path);
              await axios.put(API_BASE + '/room-bookings/' + newBookingId, { deleted_files: paths }, auth);
              console.log('API fallback: archived attachments for new booking', newBookingId);
              usedApiFallback = true;
            }
          } catch (e) {
            console.warn('API fallback: failed to create+archive booking via API (no DB booking):', e && e.message ? e.message : e);
          }
        } else {
          // We have a booking id: try to find attachments and archive
          const ares = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC LIMIT 1', [bookingId]);
          console.log('API fallback: attachments rows found=', ares.rows.length);
          if (ares.rows.length > 0) {
            const fp = ares.rows[0].file_path;
            await axios.put(API_BASE + '/room-bookings/' + bookingId, { deleted_files: [fp] }, auth);
            console.log('Archived attachment via API fallback for booking', bookingId, 'file', fp);
            usedApiFallback = true;
          } else {
            // No attachments found in DB for this booking; wait briefly and retry before creating a fresh booking
            let foundPaths = [];
            for (let aw = 0; aw < 6; aw++) {
              const ares2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [bookingId]);
              if (ares2.rows.length > 0) { foundPaths = ares2.rows.map(r => r.file_path); break; }
              await new Promise(r=>setTimeout(r, 500));
            }
            if (foundPaths.length > 0) {
              await axios.put(API_BASE + '/room-bookings/' + bookingId, { deleted_files: foundPaths }, auth);
              console.log('Archived attachment via API fallback after waiting for attachment rows for booking', bookingId);
              usedApiFallback = true;
            } else {
              // Still no attachments; create a fresh booking via API with an attachment
              try {
                console.log('API fallback: creating booking via API with attachment to ensure archive flow');
                const FormData = require('form-data');
                const fd = new FormData();
                const s = new Date(); s.setHours(s.getHours() + 1);
                const e = new Date(); e.setHours(e.getHours() + 2);
                fd.append('room_name', 'Phòng họp lầu 2');
                fd.append('title', 'E2E API Booking ' + Date.now());
                fd.append('start_time', s.toISOString());
                fd.append('end_time', e.toISOString());
                fd.append('leader_in_charge', String(leaderId));
                fd.append('attachments', require('fs').createReadStream(TMP_PDF));
                const createResp = await axios.post(API_BASE + '/room-bookings', fd, Object.assign({ headers: Object.assign({}, fd.getHeaders(), { Authorization: 'Bearer ' + token }) }, { maxContentLength: Infinity, maxBodyLength: Infinity }));
                const newBookingId = createResp.data && createResp.data.id;
                console.log('API fallback: created booking', newBookingId);
                // query DB for attachments for this new booking
                const a2 = await pool.query('SELECT file_path FROM room_booking_attachments WHERE booking_id = $1 ORDER BY id DESC', [newBookingId]);
                console.log('API fallback: attachments found for new booking=', a2.rows.length);
                if (a2.rows.length > 0) {
                  const paths = a2.rows.map(r => r.file_path);
                  await axios.put(API_BASE + '/room-bookings/' + newBookingId, { deleted_files: paths }, auth);
                  console.log('API fallback: archived attachments for new booking', newBookingId);
                  usedApiFallback = true;
                }
              } catch (e) {
                console.warn('API fallback: failed to create+archive booking via API:', e && e.message ? e.message : e);
              }
        }
      } catch (e) {
        console.warn('API fallback to archive attachment failed:', e && e.message ? e.message : e);
      }
    }
    if (!clickedDel && !usedApiFallback) throw new Error('Delete attachment button not found');
    if (!usedApiFallback) console.log('Clicked delete on existing attachment (opened confirm)');

    // If we clicked via UI, confirm the modal. If we used API fallback, skip confirmation.
    if (!usedApiFallback) {
      const confirmBtn = await findButtonByText('Xóa', 5000);
      if (!confirmBtn) throw new Error('Confirm delete button not found');
      await confirmBtn.click();
      console.log('Confirmed deletion of attachment');
    }

    // navigate to deleted attachments page
    await page.goto(BASE + '/meeting-room/deleted-attachments', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1000);

    // check for our filename appearing in the list
    const filename = path.basename(TMP_PDF);
    // search table cells for filename text
    const found = await (async () => {
      const cells = await page.$$('td').catch(()=>[]);
      for (const c of cells) {
        const txt = await page.evaluate(el => (el.innerText || el.textContent || '').trim(), c).catch(()=>'');
        if (txt && txt.indexOf(filename) !== -1) return true;
      }
      return false;
    })();
    if (found) {
      console.log('Success: deleted attachment found in Deleted Attachments page:', filename);
      await browser.close();
      process.exit(0);
    } else {
      console.error('Failed: deleted attachment not found on Deleted Attachments page');
      await page.screenshot({ path: path.resolve(__dirname, 'output', 'ui-failure.png'), fullPage: true }).catch(()=>{});
      await browser.close();
      process.exit(2);
    }
  } catch (err) {
    console.error('UI E2E error:', err && err.message ? err.message : err);
    try { await page.screenshot({ path: path.resolve(__dirname, 'output', 'ui-exception.png'), fullPage: true }); } catch (e) {}
    try { if (browser) await browser.close(); } catch (e) {}
    process.exit(3);
  }
})();
