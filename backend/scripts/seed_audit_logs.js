const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { encrypt, sha256Hex } = require('../src/utils/encryption');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
});

async function seed() {
  const client = await pool.connect();
  try {
    const ips = ['14.225.0.1','8.8.8.8','1.1.1.1','203.113.0.5','185.60.216.35'];
    const actions = ['Login','Login','Login','Login','Login'];
    // try to find an existing admin user
    const userRes = await client.query("SELECT id, username FROM users WHERE username='admin' LIMIT 1");
    const userId = userRes.rows[0] ? userRes.rows[0].id : (await client.query('SELECT id FROM users LIMIT 1')).rows[0]?.id || null;
    for (let i=0;i<ips.length;i++) {
      const ip = ips[i];
      const ua = `Mozilla/5.0 (Sample ${i})`;
      const params = [userId, 'admin', 'success', null, 'Desktop', 'Windows 10', encrypt(ua), sha256Hex(ua), null, null, encrypt(ip), sha256Hex(ip), null, null, null, 'POST', '/login', null, 'Auth', actions[i], 'Seeded sample login', null];
      await client.query(`INSERT INTO audit_logs (user_id, username, status, reason, device_type, os, user_agent_encrypted, ua_hash, mac_encrypted, mac_hash, ip_encrypted, ip_hash, country, city, isp, method, url, session_id, module, action, details, task_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`, params);
    }
    console.log('Seeded audit logs');
  } catch (e) {
    console.error('Seed failed', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) seed();
