#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

// Insert lightweight deleted_roles rows until total >= 100
async function run(){
  try{
    const r = await pool.query('SELECT (SELECT COUNT(*) FROM roles)::int AS active, (SELECT COUNT(*) FROM deleted_roles)::int AS deleted');
    let active = parseInt(r.rows[0].active,10);
    let deleted = parseInt(r.rows[0].deleted,10);
    console.log('Before seed - active:', active, 'deleted:', deleted);
    let total = active + deleted;
    let i = 0;
    while(total < 100){
      const name = `__seed_deleted_role_${Date.now()}_${i}`;
      const qry = `INSERT INTO deleted_roles (original_id, role_name, description, color, level, permissions_snapshot, deleted_by, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`;
      await pool.query(qry, [null, name, 'seed', '#000000', 3, JSON.stringify([]), 'seed-script']);
      i++;
      deleted++;
      total = active + deleted;
    }
    console.log('After seed - active:', active, 'deleted:', deleted);
  }catch(e){
    console.error('Seed failed', e && e.stack || e);
    process.exit(1);
  }finally{
    process.exit(0);
  }
}
run();
