const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const user = process.env.DB_USER || 'postgres';
const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 5432);
const password = process.env.DB_PASSWORD || '';

const needed = ['nttsu', process.env.DB_DATABASE || 'ubndxanuicam'];

async function run() {
  // connect to default 'postgres' database to run CREATE DATABASE
  const client = new Client({ user, host, port, password, database: 'postgres' });
  try {
    await client.connect();
    for (const db of needed) {
      if (!db) continue;
      try {
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname=$1`, [db]);
        if (res.rows.length === 0) {
          console.log('Creating database', db);
          await client.query(`CREATE DATABASE "${db}"`);
          console.log('Created', db);
        } else {
          console.log('Database exists:', db);
        }
      } catch (e) {
        console.error('Error checking/creating db', db, e && e.message ? e.message : e);
      }
    }
  } catch (err) {
    console.error('Failed to connect to Postgres to create DBs:', err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    try { await client.end(); } catch(e){}
  }
}

run();
