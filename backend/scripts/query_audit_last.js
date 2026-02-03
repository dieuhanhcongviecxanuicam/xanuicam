#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

async function run(){
  try{
    const res = await pool.query('SELECT id, action, module, details, username, created_at FROM audit_logs ORDER BY id DESC LIMIT 10');
    console.log('Latest audit_logs:');
    console.table(res.rows);
  }catch(e){
    console.error('Query failed', e && e.stack || e);
    process.exit(1);
  }finally{
    process.exit(0);
  }
}
run();
