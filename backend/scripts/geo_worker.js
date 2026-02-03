const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fetch = require('node-fetch');
const { decrypt } = require('../src/utils/encryption');
const { broadcaster } = require('../src/utils/auditBroadcaster');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
});

async function enrichOne(id, ipEnc) {
  try {
    // decrypt ipEnc if needed? we cannot decrypt without key; instead do not decrypt, use ip-api on encrypted won't work.
    // However we stored encrypted IP; to enrich we need to decrypt. Use encryption util's decrypt.
    const { decrypt: dec } = require('../src/utils/encryption');
    const ip = ipEnc ? dec(ipEnc) : null;
    if (!ip) return false;
    const normalized = String(ip).replace('::ffff:', '');
    const url = `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=status,country,city,isp,lat,lon`;
    const res = await fetch(url, { timeout: 5000 });
    const data = await res.json();
    if (data && data.status === 'success') {
      await pool.query('UPDATE audit_logs SET country=$1, city=$2, isp=$3, latitude=$4, longitude=$5 WHERE id=$6', [data.country, data.city, data.isp, data.lat, data.lon, id]);
      try {
        // Notify server to broadcast to SSE clients
        const notifyUrl = `http://localhost:${process.env.PORT || 5000}/api/audit-logs/notify`;
        await fetch(notifyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, country: data.country, city: data.city, isp: data.isp, latitude: data.lat, longitude: data.lon }) });
      } catch(e){}
      return true;
    }
  } catch (e) {
    console.error('geo enrich error', e.message);
  }
  return false;
}

async function runOnce(limit=100) {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, ip_encrypted FROM audit_logs WHERE ip_encrypted IS NOT NULL AND country IS NULL LIMIT $1", [limit]);
    for (const row of res.rows) {
      await enrichOne(row.id, row.ip_encrypted);
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  // run once and exit
  runOnce().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { runOnce };
