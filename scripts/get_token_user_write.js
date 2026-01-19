const http = require('http');
const fs = require('fs');
const USER = process.env.E2E_USER || '000000000001';
const PASS = process.env.E2E_PASS || 'password';
const data = JSON.stringify({identifier: USER, password: PASS});
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
  timeout: 15000,
};

const req = http.request(options, (res) => {
  console.log('STATUS', res.statusCode);
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('BODY', body);
    try {
      const j = JSON.parse(body);
      if (j && j.jwt) {
        console.log('JWT:', j.jwt);
        try { fs.writeFileSync('e2e/e2e_token.txt', j.jwt); console.log('WROTE e2e/e2e_token.txt'); } catch (w) { console.error('WRITE_ERR', w.message); }
      }
    } catch (e) { console.error('PARSE_ERR', e.message); }
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
});

req.on('error', (e) => {
  console.error('REQUEST_ERROR', e.message);
  process.exit(2);
});
req.on('timeout', () => {
  console.error('REQUEST_TIMEOUT');
  req.destroy();
  process.exit(3);
});

req.write(data);
req.end();
