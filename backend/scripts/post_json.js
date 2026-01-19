const http = require('http');
const fs = require('fs');
const path = require('path');
const dataPath = path.resolve(__dirname, '..', '..', 'tmp', 'login_admin.json');
const data = fs.readFileSync(dataPath, 'utf8');
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('HEADERS', res.headers);
    console.log('BODY', body);
  });
});
req.on('error', (e) => console.error('REQ ERR', e));
req.write(data);
req.end();
