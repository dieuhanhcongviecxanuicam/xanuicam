const path = require('path');
const fs = require('fs');
const stream = require('stream');

// Lightweight harness to invoke exportConfigs with a mocked DB and capture response headers/body
async function run() {
  const dbPath = path.resolve(__dirname, '..', 'src', 'db.js');
  // prepare mock pool
  const mockPool = {
    query: async (q, params) => {
      // simple heuristic: return two users when selecting users
      if (/FROM users u/.test(q) || /WHERE u.id = ANY/.test(q)) {
        return { rows: [
          { id: 1, full_name: 'Test User 1', username: 'test1', config: { hostname: 'host1', os: 'win' } },
          { id: 2, full_name: 'Test User 2', username: 'test2', config: { hostname: 'host2' } }
        ] };
      }
      return { rows: [] };
    }
  };

  // inject into require cache
  try {
    const resolved = require.resolve(dbPath);
    const Module = require('module');
    const m = new Module(resolved, module.parent);
    m.filename = resolved;
    m.exports = mockPool;
    require.cache[resolved] = m;
  } catch (e) {
    console.error('Failed to mock db module', e);
    return process.exit(1);
  }

  // require controller after mocking db
  const controller = require(path.resolve(__dirname, '..', 'src', 'controllers', 'computerConfigsController.js'));

  // prepare mocked req/res
  const headers = {};
  const resBuffer = [];
  const writable = new stream.Writable({
    write(chunk, encoding, callback) {
      resBuffer.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      callback();
    }
  });
  const res = Object.assign(writable, {
    setHeader(k, v) { headers[k.toLowerCase()] = String(v); },
    getHeader(k) { return headers[k.toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.setHeader('content-type', 'application/json'); this.end(Buffer.from(JSON.stringify(obj))); },
    send(buf) { if (!Buffer.isBuffer(buf)) buf = Buffer.from(String(buf)); this.end(buf); }
  });

  const req = { body: { userIds: [1,2], format: 'pdf' }, headers: {} };

  console.log('Invoking exportConfigs...');
  try {
    await controller.exportConfigs(req, res);
  } catch (e) {
    console.error('controller.exportConfigs threw', e);
    process.exit(1);
  }

  // wait for stream end
  writable.on('finish', () => {
    const buf = Buffer.concat(resBuffer);
    console.log('Response headers:', headers);
    console.log('Response size (bytes):', buf.length);
    // write to temp file for inspection
    const out = path.join(__dirname, 'export_test_output.pdf');
    try { fs.writeFileSync(out, buf); console.log('Wrote', out); } catch (e) { console.error('Failed to write file', e); }
    process.exit(0);
  });
}

run();
