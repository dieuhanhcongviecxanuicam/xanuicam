const axios = require('axios');

const base = process.env.BASE_URL || 'http://127.0.0.1:5000';

async function run() {
  try {
    console.log('Checking GET /api/system/notification');
    const r = await axios.get(base + '/api/system/notification', { timeout: 5000 });
    console.log('status=', r.status);
    console.log('body=', r.data);
  } catch (e) {
    console.error('GET /api/system/notification failed:', e.message);
    process.exit(2);
  }

  try {
    console.log('Checking POST /api/admin/system/settings/notification (simulated)');
    // This endpoint requires auth in production; this smoke test only checks route accessibility
    // without authentication by skipping it if 401 is returned.
    const payload = { enabled: false, title: 'smoke', message: 'smoke', start_time: null, end_time: null };
    const p = await axios.put(base + '/api/admin/system/settings/notification', payload, { timeout: 5000 }).catch(err => err.response || err);
    if (p && p.status && p.status >= 200 && p.status < 300) {
      console.log('admin save OK', p.status);
    } else if (p && p.status === 401) {
      console.warn('admin save requires auth (expected in production). status=401');
    } else {
      console.error('admin save unexpected response', p && p.status);
      process.exit(3);
    }
  } catch (e) {
    console.error('PUT /api/admin/system/settings/notification failed:', e.message);
    process.exit(4);
  }

  console.log('Smoke tests passed (or endpoints behaved as expected).');
  process.exit(0);
}

run();
