const assert = require('assert');
const fetch = require('node-fetch');

(async () => {
  const base = process.env.API_BASE || 'http://localhost:5000/api';
  // This test requires a running backend and a test event to delete/restore; it's best-effort.
  try {
    console.log('Fetching deleted events...');
    const resp = await fetch(base + '/calendar/deleted');
    console.log('Status:', resp.status);
    const j = await resp.json();
    console.log('Body sample length:', Array.isArray(j) ? j.length : 'not-array');
    console.log('OK');
  } catch (e) {
    console.error('Test failed', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
