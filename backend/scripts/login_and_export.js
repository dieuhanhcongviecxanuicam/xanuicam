const http = require('http');
const fs = require('fs');
const loginPayload = JSON.stringify({ identifier: 'admin', password: 'Admin123!' });

function postJson(path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 5000, path, method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers)
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          try { const obj = JSON.parse(buf.toString('utf8')); resolve({ status: res.statusCode, json: obj, headers: res.headers }); }
          catch (e) { reject(e); }
        } else {
          resolve({ status: res.statusCode, buffer: buf, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    console.log('Logging in...');
    const loginRes = await postJson('/api/auth/login', loginPayload);
    if (loginRes.status !== 200) {
      console.error('Login failed', loginRes.status, loginRes.json || loginRes.buffer && loginRes.buffer.toString());
      process.exit(1);
    }
    const token = loginRes.json && loginRes.json.token;
    if (!token) { console.error('No token in login response'); process.exit(1); }
    console.log('Obtained token, starting export...');
    const exportBody = JSON.stringify({ format: 'csv' });
    const exportRes = await postJson('/api/departments/export', exportBody, { Authorization: `Bearer ${token}`, Accept: '*/*' });
    if (exportRes.status !== 200) {
      console.error('Export failed', exportRes.status, exportRes.json || (exportRes.buffer && exportRes.buffer.toString()) || exportRes.headers);
      process.exit(1);
    }
    // write buffer to file
    const fname = 'tmp/departments_export.csv';
    fs.writeFileSync(fname, exportRes.buffer);
    console.log('Export saved to', fname);
  } catch (e) {
    console.error('Error during login+export', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
