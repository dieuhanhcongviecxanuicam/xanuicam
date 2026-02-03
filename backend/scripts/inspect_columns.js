const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='audit_logs' ORDER BY ordinal_position");
  console.log(res.rows.map(r => r.column_name).join(',\n'));
  await client.end();
})();
