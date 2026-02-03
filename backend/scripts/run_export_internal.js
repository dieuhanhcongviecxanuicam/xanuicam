const fs = require('fs');
const stream = require('stream');
const taskController = require('../src/controllers/taskController');
const pool = require('../src/db');
(async ()=>{
  try{
    // find a user with export permission (role 1 admin or export_tester)
    const client = await pool.connect();
    let userRow;
    try{
      const r = await client.query("SELECT id, username FROM users WHERE username = $1 LIMIT 1", ['export_tester']);
      if (r.rows.length === 0) {
        const r2 = await client.query('SELECT id, username FROM users LIMIT 1');
        userRow = r2.rows[0];
      } else userRow = r.rows[0];
    } finally { client.release(); }

    if (!userRow) throw new Error('No user found to run export as');
    const req = {
      user: { id: userRow.id },
      body: { format: 'xlsx', filters: {}, password: 'TestExport123!' },
      ip: '127.0.0.1',
      headers: {}
    };

    // create a writable capture stream
    const chunks = [];
    const writable = new stream.Writable({ write(chunk, enc, cb) { chunks.push(Buffer.from(chunk)); cb(); } });
    // mock res
    const res = {
      headers: {},
      setHeader(k,v) { this.headers[k]=v; },
      send(b) { if (Buffer.isBuffer(b)) chunks.push(b); else chunks.push(Buffer.from(String(b))); this._ended = true; },
      end() { this._ended = true; },
      write: (c)=>{ chunks.push(Buffer.from(c)); },
      status: (s)=>{ this.statusCode = s; return this; },
      json: (o)=>{ console.log('JSON response:', o); }
    };

    await taskController.exportTasksBulk(req, res);

    // combine and write file if any
    if (chunks.length>0) {
      const buf = Buffer.concat(chunks);
      const fname = `tasks_export_internal_${Date.now()}.xlsx`;
      fs.writeFileSync(fname, buf);
      console.log('Wrote', fname);
    } else {
      console.log('No data written by export controller');
    }
  } catch(e) {
    console.error('Internal export error', e && (e.response && e.response.data ? JSON.stringify(e.response.data) : e.message || e));
    try{ console.error(e.stack); }catch(_){}
    process.exitCode=1;
  } finally { try{ await pool.end(); }catch(_){} }
})();
