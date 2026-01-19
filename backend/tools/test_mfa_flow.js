// Simple test script to exercise login -> mfa disable -> mfa info
// Run from repository root: `node backend/tools/test_mfa_flow.js`
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');

(async () => {
  try {
    // ensure cwd is backend so node_modules resolution works
    process.chdir(path.join(__dirname, '..'));
    const base = 'http://127.0.0.1:5000/api';
    console.log('Logging in as admin...');
    const loginRes = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'admin', password: 'password' }) });
    const loginText = await loginRes.text();
    console.log('LOGIN_STATUS', loginRes.status, loginText);
    let token = null;
    try { token = JSON.parse(loginText).token; } catch (e) {}
    if (!token) {
      console.error('No token from login. Aborting.');
      process.exit(2);
    }

    console.log('Calling /auth/mfa/disable with password...');
    const disableRes = await fetch(base + '/auth/mfa/disable', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ password: 'password' }) });
    const disableText = await disableRes.text();
    console.log('DISABLE_STATUS', disableRes.status, disableText);

    console.log('Calling /auth/mfa/info...');
    const infoRes = await fetch(base + '/auth/mfa/info', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    const infoText = await infoRes.text();
    console.log('INFO_STATUS', infoRes.status, infoText);

    // Show last few log lines
    const logPath = path.join(__dirname, '..', 'logs', 'requests.jsonl');
    if (fs.existsSync(logPath)) {
      const s = fs.readFileSync(logPath, 'utf8');
      const lines = s.trim().split(/\r?\n/).slice(-20);
      console.log('\n--- last log lines ---');
      console.log(lines.join('\n'));
    } else {
      console.log('No log file found at', logPath);
    }

  } catch (e) {
    console.error('TEST_ERR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
