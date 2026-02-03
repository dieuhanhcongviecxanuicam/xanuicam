const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
        catch(e){ reject(e); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  try {
    const loginBody = JSON.stringify({ identifier: 'admin', password: 'password' });
    const loginRes = await request({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) } }, loginBody);
    console.log('LOGIN STATUS', loginRes.status);
    console.log('LOGIN BODY', loginRes.body);
    let token = null;
    try { token = JSON.parse(loginRes.body).token; } catch(e) {}
    if (!token) { console.error('No token returned'); process.exit(1); }

    const infoRes = await request({ hostname: 'localhost', port: 5000, path: '/api/auth/mfa/info', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    console.log('MFA INFO STATUS', infoRes.status);
    console.log('MFA INFO BODY', infoRes.body);
  } catch (e) {
    console.error('ERROR', e && (e.stack || e));
    process.exit(2);
  }
}

run();
