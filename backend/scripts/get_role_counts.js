#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

async function run(){
  try{
    const r = await pool.query('SELECT (SELECT COUNT(*) FROM roles)::int AS active, (SELECT COUNT(*) FROM deleted_roles)::int AS deleted');
    console.log('Counts:', r.rows[0]);
  }catch(e){
    console.error('Error', e && e.stack || e);
    process.exit(1);
  }finally{
    process.exit(0);
  }
}
run();
