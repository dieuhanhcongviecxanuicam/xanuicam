require('dotenv').config();
const fetch = global.fetch || require('node-fetch');

(async () => {
  try {
    const API = 'http://127.0.0.1:5000/api';
    const username = 'e2e_test_user';
    const password = 'P@ssw0rd123';

    console.log('Performing first login (may create user if missing via other script)...');
    let r1 = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password })
    });
    const d1 = await r1.text();
    console.log('Login1 status', r1.status, d1);

    console.log('Performing second login to create another session...');
    let r2 = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password })
    });
    const d2 = await r2.text();
    console.log('Login2 status', r2.status, d2);

    console.log('Listing sessions via credential endpoint...');
    const ls = await fetch(`${API}/auth/sessions/list`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password })
    });
    const lsJson = await (ls.status === 200 ? ls.json() : ls.text());
    console.log('List status', ls.status, JSON.stringify(lsJson, null, 2));

    if (ls.status !== 200 || !lsJson.sessions || lsJson.sessions.length === 0) {
      console.log('No sessions to logout; exiting');
      process.exit(0);
    }

    const sidToLogout = lsJson.sessions[0].sessionId;
    console.log('Logging out session:', sidToLogout);
    const out = await fetch(`${API}/auth/sessions/${encodeURIComponent(sidToLogout)}/logout-credential`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password })
    });
    const outBody = await (out.status === 200 ? out.json() : out.text());
    console.log('Logout status', out.status, JSON.stringify(outBody));

    console.log('Re-listing sessions after logout...');
    const ls2 = await fetch(`${API}/auth/sessions/list`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password })
    });
    const ls2Json = await (ls2.status === 200 ? ls2.json() : ls2.text());
    console.log('List2 status', ls2.status, JSON.stringify(ls2Json, null, 2));

    console.log('E2E device manager check completed.');
  } catch (e) {
    console.error('E2E check error:', e && e.message ? e.message : e);
    process.exitCode = 1;
  }
})();
