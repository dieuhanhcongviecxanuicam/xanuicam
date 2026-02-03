const axios = require('axios');
const path = require('path');
const { Pool } = require('pg');
const speakeasy = require('speakeasy');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API = `http://127.0.0.1:5000/api`;

async function run() {
  try {
    console.log('1) Logging in with password...');
    let loginRes;
    try {
      loginRes = await axios.post(`${API}/auth/login`, { identifier: '000000000001', password: 'password' }, { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      // If device limit reached, attempt to logout other devices using password and retry
      const data = err.response && err.response.data;
      if (data && (data.message && data.message.includes('Bạn đã đăng nhập trên') || data.activeDevices)) {
        console.log('  -> Device limit reached, attempting logout-others with password...');
        try {
          await axios.post(`${API}/auth/sessions/logout-others`, { identifier: '000000000001', password: 'password' }, { headers: { 'Content-Type': 'application/json' } });
          console.log('  -> logout-others succeeded, retrying login...');
          loginRes = await axios.post(`${API}/auth/login`, { identifier: '000000000001', password: 'password' }, { headers: { 'Content-Type': 'application/json' } });
        } catch (err2) {
          throw err2;
        }
      } else {
        throw err;
      }
    }
    const token = loginRes.data.token;
    console.log('  -> Logged in, token length:', token && token.length);

    console.log('2) Creating MFA secret (mfaSetup)...');
    const setupRes = await axios.post(`${API}/auth/mfa/setup`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('  -> Received otpauth_url and base32.');
    const base32 = setupRes.data.base32;

    console.log('3) Generating TOTP and verifying (mfaVerify)...');
    const totp = speakeasy.totp({ secret: base32, encoding: 'base32' });
    const verifyRes = await axios.post(`${API}/auth/mfa/verify`, { token: totp }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('  -> MFA verify response:', verifyRes.data.message || verifyRes.data);

    console.log('4) Attempting MFA-only login (server should accept TOTP without password)');
    const device = { userAgent: 'e2e-test', platform: 'node', metadata: { language: 'vi', browserName: 'e2e-test', browserVersion: '1.0' } };
    const mfaLogin = await axios.post(`${API}/auth/login`, { identifier: '000000000001', mfaOnly: true, mfaToken: totp, device }, { headers: { 'Content-Type': 'application/json' } });
    console.log('  -> MFA login response keys:', Object.keys(mfaLogin.data));
    const sessionId = mfaLogin.data.sessionId;

    // query sessions rows for this user
    const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });
    const uRes = await pool.query('SELECT id FROM users WHERE cccd = $1 OR username = $1', ['000000000001']);
    const uid = uRes.rows[0].id;
    const sRes = await pool.query('SELECT session_id, device_fingerprint_hash, device_metadata_json, user_agent_encrypted, ip_encrypted, is_active FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [uid]);
    console.log('Sessions for user id', uid, ':');
    for (const r of sRes.rows) {
      console.log(JSON.stringify({ session_id: r.session_id, fingerprint: r.device_fingerprint_hash, metadata: r.device_metadata_json ? JSON.parse(r.device_metadata_json) : null, is_active: r.is_active }, null, 2));
    }
    await pool.end();

    console.log('E2E MFA test complete. sessionId:', sessionId);
    process.exit(0);
  } catch (e) {
    console.error('E2E test failed:', e.response ? (e.response.data || e.response.statusText) : e.message, e.stack || '');
    process.exit(1);
  }
}

run();
