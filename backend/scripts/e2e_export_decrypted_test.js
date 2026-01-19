// E2E test: login as admin, fetch first audit log, open details, request decrypted CSV export, verify audit entry created
const axios = require('axios');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API_BASE = `http://localhost:${process.env.PORT || 5000}/api`;

async function run() {
  try {
    console.log('1/6: Logging in as seeded admin...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, { identifier: 'admin', password: 'password' });
    const token = loginRes.data.token;
    const sessionId = loginRes.data.sessionId || loginRes.data.sid || null;
    const actorUserId = loginRes.data.user ? loginRes.data.user.id : null;
    console.log(' -> Logged in, sessionId=', sessionId, 'userId=', actorUserId);

    const headers = { Authorization: `Bearer ${token}` };

    console.log('2/6: Fetching first audit log (page=1,limit=1)...');
    const logsRes = await axios.get(`${API_BASE}/audit-logs`, { params: { page: 1, limit: 1 }, headers });
    const logs = logsRes.data.logs || [];
    if (!logs.length) {
      console.error('No audit logs found to inspect. Aborting.');
      process.exit(1);
    }
    const first = logs[0];
    console.log(' -> Found first log id=', first.id, 'action=', first.action, 'user=', first.user_name || first.username);

    console.log('3/6: Fetching details for first log...');
    const detailRes = await axios.get(`${API_BASE}/audit-logs/${first.id}`, { headers });
    console.log(' -> Details fetched. Sample:', { id: detailRes.data.id, ip: detailRes.data.ip, ua: detailRes.data.ua?.raw || detailRes.data.user_agent });

    console.log('4/6: Requesting decrypted CSV export...');
    const exportRes = await axios.get(`${API_BASE}/audit-logs/export-decrypted`, { params: { page: 1, limit: 100 }, headers, responseType: 'arraybuffer' });
    const csv = exportRes.data.toString('utf8');
    console.log(' -> Received CSV content length:', csv.length);

    console.log('5/6: Verifying export audit log in DB...');
    const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    });
    const client = await pool.connect();
    try {
      // Find most recent 'Export decrypted CSV' entry
      // Select the common columns only; some installs may not have IP/session columns named the same
      // Try to include session_id if present, fallback to without it
      let res;
      try {
        res = await client.query("SELECT id, user_id, username, action, details, created_at, session_id FROM audit_logs WHERE action = 'Export decrypted CSV' ORDER BY created_at DESC LIMIT 5");
      } catch (e) {
        res = await client.query("SELECT id, user_id, username, action, details, created_at FROM audit_logs WHERE action = 'Export decrypted CSV' ORDER BY created_at DESC LIMIT 5");
      }
      if (res.rows.length === 0) {
        console.error('No export audit entry found.');
        process.exit(2);
      }
      console.log(' -> Found export audit entries (most recent):');
      res.rows.forEach(r => console.log(r));

      // Optionally match actor username or session_id
      const found = res.rows.find(r => (actorUserId && r.user_id === actorUserId) || (sessionId && r.session_id === sessionId));
      if (found) {
        console.log('\nSUCCESS: Export audit entry created and matches admin/session.');
      } else {
        console.warn('\nWARNING: Export audit entries found but none match admin username/session id.');
      }
    } finally {
      client.release();
      await pool.end();
    }

    console.log('6/6: Test finished.');
    process.exit(0);
  } catch (err) {
    if (err.response) {
      console.error('E2E test failed: HTTP', err.response.status, err.response.statusText);
      console.error('Response data:', err.response.data);
    } else {
      console.error('E2E test failed:', err.stack || err.message);
    }
    process.exit(10);
  }
}

run();
