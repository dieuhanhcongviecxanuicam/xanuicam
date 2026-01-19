const http = require('http');
const data = JSON.stringify({ identifier: '000000000001', password: 'password' });
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
};
const req = http.request(options, (res) => {
  console.log('statusCode', res.statusCode);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('body:', body);
  });
});
req.on('error', (e) => { console.error('error', e); });
req.write(data);
req.end();
