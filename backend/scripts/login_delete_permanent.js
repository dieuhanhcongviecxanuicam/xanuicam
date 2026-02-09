const http = require('http');

function postJson(path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 5000, path, method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers) };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          try { resolve({ status: res.statusCode, json: JSON.parse(buf.toString('utf8')), headers: res.headers }); }
          catch (e) { reject(e); }
        } else resolve({ status: res.statusCode, buffer: buf, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function del(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 5000, path, method: 'DELETE', headers };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          try { resolve({ status: res.statusCode, json: JSON.parse(buf.toString('utf8')), headers: res.headers }); }
          catch (e) { reject(e); }
        } else resolve({ status: res.statusCode, buffer: buf, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    console.log('Logging in...');
    const loginPayload = JSON.stringify({ identifier: 'admin', password: 'Admin123!' });
    const loginRes = await postJson('/api/auth/login', loginPayload);
    if (loginRes.status !== 200) {
      console.error('Login failed', loginRes.status, loginRes.json || loginRes.buffer && loginRes.buffer.toString());
      process.exit(1);
    }
    const token = loginRes.json && loginRes.json.token;
    if (!token) { console.error('No token'); process.exit(1); }

    const id = 15;
    console.log('Archiving department id=', id);
    const archiveRes = await del(`/api/departments/${id}`, { Authorization: `Bearer ${token}` });
    console.log('Archive response status', archiveRes.status, archiveRes.json || (archiveRes.buffer && archiveRes.buffer.toString()));

    console.log('Permanently deleting archived id=', id);
    const permRes = await del(`/api/departments/deleted/${id}`, { Authorization: `Bearer ${token}` });
    console.log('Permanent delete status', permRes.status, permRes.json || (permRes.buffer && permRes.buffer.toString()));

    process.exit(0);
  } catch (e) {
    console.error('Error', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
