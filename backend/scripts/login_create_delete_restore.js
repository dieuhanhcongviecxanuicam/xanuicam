const http = require('http');
const util = require('util');

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

function getJson(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 5000, path, method: 'GET', headers };
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
    console.log('Obtained token.');

    // 1) Export CSV (quick check)
    console.log('Requesting export (csv)...');
    const exportBody = JSON.stringify({ format: 'csv' });
    const exportRes = await postJson('/api/departments/export', exportBody, { Authorization: `Bearer ${token}`, Accept: '*/*' });
    if (exportRes.status !== 200) {
      console.error('Export failed', exportRes.status, exportRes.json || (exportRes.buffer && exportRes.buffer.toString()) || exportRes.headers);
    } else {
      const fs = require('fs');
      if (!fs.existsSync('tmp')) fs.mkdirSync('tmp');
      const fname = 'tmp/departments_export.csv';
      fs.writeFileSync(fname, exportRes.buffer);
      console.log('Export saved to', fname);
    }

    // 2) Create a temporary department
    const name = `SmokeDept ${Date.now()}`;
    console.log('Creating department:', name);
    const createBody = JSON.stringify({ name, description: 'Smoke test department' });
    const createRes = await postJson('/api/departments', createBody, { Authorization: `Bearer ${token}` });
    if (createRes.status !== 201) {
      console.error('Create failed', createRes.status, createRes.json || createRes.buffer && createRes.buffer.toString());
      process.exit(1);
    }
    const dept = createRes.json;
    console.log('Created department id=', dept.id);

    // 3) Delete (archive) it
    console.log('Deleting department id=', dept.id);
    const delRes = await new Promise((resolve, reject) => {
      const options = { hostname: 'localhost', port: 5000, path: `/api/departments/${dept.id}`, method: 'DELETE', headers: { Authorization: `Bearer ${token}` } };
      const req = http.request(options, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const ct = res.headers['content-type'] || '';
          if (ct.includes('application/json')) {
            try { const obj = JSON.parse(buf.toString('utf8')); resolve({ status: res.statusCode, json: obj, headers: res.headers }); }
            catch (e) { reject(e); }
          } else { resolve({ status: res.statusCode, buffer: buf, headers: res.headers }); }
        });
      });
      req.on('error', reject);
      req.end();
    });
    if (delRes.status !== 200) {
      console.error('Delete failed', delRes.status, delRes.json || delRes.buffer && delRes.buffer.toString());
      process.exit(1);
    }
    console.log('Deleted (archived).');

    // 4) List deleted departments
    console.log('Fetching deleted departments...');
    const listRes = await getJson('/api/departments/deleted', { Authorization: `Bearer ${token}` });
    if (listRes.status !== 200) {
      console.error('List deleted failed', listRes.status, listRes.json || listRes.buffer && listRes.buffer.toString());
      process.exit(1);
    }
    const deleted = listRes.json;
    console.log('Deleted entries count:', deleted.length);
    const found = deleted.find(d => d.name === name || Number(d.id) === Number(dept.id));
    if (!found) {
      console.error('Created-deleted department not found in deleted list');
      process.exit(1);
    }
    console.log('Found archived dept id=', found.id);

    // 5) Restore it
    console.log('Restoring archived department id=', found.id);
    const restoreRes = await postJson(`/api/departments/deleted/${found.id}/restore`, '{}', { Authorization: `Bearer ${token}` });
    if (restoreRes.status !== 200) {
      console.error('Restore failed', restoreRes.status, restoreRes.json || restoreRes.buffer && restoreRes.buffer.toString());
      process.exit(1);
    }
    console.log('Restore response:', restoreRes.json && restoreRes.json.message);

    // 6) Verify it appears in active list (fetch a larger limit)
    console.log('Verifying active departments list...');
    const activeRes = await getJson('/api/departments?limit=1000', { Authorization: `Bearer ${token}` });
    if (activeRes.status !== 200) {
      console.error('Active list fetch failed', activeRes.status, activeRes.json || activeRes.buffer && activeRes.buffer.toString());
      process.exit(1);
    }
    const active = activeRes.json && activeRes.json.data ? activeRes.json.data : [];
    const inActive = active.find(d => d.name === name || Number(d.id) === Number(dept.id));
    if (!inActive) {
      console.error('Restored dept not present in active departments');
      process.exit(1);
    }
    console.log('Smoke test succeeded: restored dept id=', inActive.id);
    process.exit(0);
  } catch (e) {
    console.error('Error during smoke test', e && e.message ? e.message : util.inspect(e));
    process.exit(1);
  }
})();
