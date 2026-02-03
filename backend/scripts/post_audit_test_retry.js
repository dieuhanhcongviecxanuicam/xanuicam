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

function makeToken(secret){
  const payload = { user: { id: 1, username: 'dev', roles: ['admin'] }, sid: 'script-test-session' };
  process.env.JWT_SECRET = process.env.JWT_SECRET || secret;
  const jwtHelper = require('../src/utils/jwtHelper');
  return jwtHelper.sign(payload, { expiresIn: '1h' });
}

function tryPost(host, port, token){
  return new Promise((resolve,reject)=>{
    const body = JSON.stringify({ action:'task.test.log', module:'task', resource_type:'task', resource_id:123, details:'retry test' });
    const opts = { hostname: host, port: port, path: '/api/audit-logs', method: 'POST', headers: { 'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Authorization':'Bearer '+token } };
    const req = http.request(opts, res=>{
      let buf=''; res.on('data',d=>buf+=d); res.on('end',()=>resolve({status:res.statusCode,body:buf,port}));
    });
    req.on('error',e=>reject(e));
    req.write(body); req.end();
  });
}

(async ()=>{
  const secret = loadEnv();
  const token = makeToken(secret);
  const hosts = ['127.0.0.1'];
  const ports = [3000,5000];
  for(let attempt=1; attempt<=6; attempt++){
    for(const host of hosts){
      for(const port of ports){
        try{
          console.log(`Trying ${host}:${port} (attempt ${attempt})`);
          const res = await tryPost(host,port,token);
          console.log('OK', res);
          process.exit(0);
        }catch(e){
          console.error('ERR', host, port, e.message);
        }
      }
    }
    await new Promise(r=>setTimeout(r, 2000));
  }
  console.error('All attempts failed'); process.exit(2);
})();
