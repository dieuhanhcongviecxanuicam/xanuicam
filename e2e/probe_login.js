const http = require('http');
const payload = JSON.stringify({ identifier: process.env.E2E_USER || '000000000001', password: process.env.E2E_PASS || 'password' });
const opts = { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } };

function doProbe(){
  const req = http.request(opts, (res) => {
    let body = '';
    res.on('data', c=> body += c);
    res.on('end', () => {
      console.log('STATUS', res.statusCode);
      console.log('HEADERS', res.headers);
      console.log('BODY', body);
    });
  });
  req.on('error', (e)=> console.error('REQUEST ERROR', e && e.message));
  req.write(payload); req.end();
}

doProbe();
