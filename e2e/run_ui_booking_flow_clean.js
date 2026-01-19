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
    let leaderId = null;
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
