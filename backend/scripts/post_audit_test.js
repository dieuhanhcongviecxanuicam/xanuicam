#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');

function loadEnv(secretKeyName = 'JWT_SECRET'){
  if(process.env[secretKeyName]) return process.env[secretKeyName];
  const envPath = path.join(__dirname, '..', '.env');
  try{
    const raw = fs.readFileSync(envPath, 'utf8');
    const m = raw.match(new RegExp('^' + secretKeyName + "=(.*)$", 'm'));
    if(m) return m[1].trim();
  }catch(e){ /* ignore */ }
  throw new Error(`${secretKeyName} not found in env or process.env`);
}

async function run(){
  const secret = loadEnv();
  const payload = {
    user: { id: 1, username: 'dev', roles: ['admin'] },
    sid: 'script-test-session'
  };
  // Prefer centralized helper to ensure HS512 usage
  process.env.JWT_SECRET = process.env.JWT_SECRET || secret;
  const jwtHelper = require('../src/utils/jwtHelper');
  const token = jwtHelper.sign(payload, { expiresIn: '1h' });

  const body = JSON.stringify({
    action: 'task.test.log',
    module: 'task',
    resource_type: 'task',
    resource_id: 123,
    details: 'test from backend/scripts/post_audit_test.js'
  });

  const host = process.env.AUDIT_HOST || '127.0.0.1';
  const port = process.env.AUDIT_PORT ? parseInt(process.env.AUDIT_PORT,10) : 3000;
  const opts = {
    hostname: host,
    port: port,
    path: '/api/audit-logs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': 'Bearer ' + token
    }
  };

  await new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        console.log('STATUS', res.statusCode);
        console.log('BODY', buf);
        resolve();
      });
    });
    req.on('error', err => { console.error('ERR', err.message); reject(err); });
    req.write(body);
    req.end();
  });
}

run().catch(err => { console.error(err); process.exit(1); });
