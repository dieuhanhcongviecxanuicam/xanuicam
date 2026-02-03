#!/usr/bin/env node
// E2E script: unlock a user via admin token, then perform wrong-password attempts
// Usage: ADMIN_TOKEN=<admin_jwt> TARGET_USERNAME=someuser node scripts/e2e_unlock_and_attempts.js

const axios = require('axios');

const BASE = process.env.BASE_URL || 'http://localhost:5000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TARGET_USERNAME = process.env.TARGET_USERNAME;

if (!ADMIN_TOKEN) {
  console.error('ADMIN_TOKEN environment variable is required.');
  process.exit(2);
}
if (!TARGET_USERNAME) {
  console.error('TARGET_USERNAME environment variable is required.');
  process.exit(2);
}

const adminClient = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } });
const anonClient = axios.create({ baseURL: BASE });

async function findUser(username) {
  const res = await adminClient.get('/users', { params: { search: username, limit: 50 } });
  const rows = res.data && res.data.data ? res.data.data : [];
  return rows.find(r => r.username === username || (r.full_name && r.full_name.includes(username)) );
}

async function unlockUser(id) {
  const res = await adminClient.post(`/users/${id}/unlock`);
  return res.data;
}

async function wrongLoginAttempt(username, attemptNo) {
  try {
    const res = await anonClient.post('/auth/login', { identifier: username, password: 'wrong-password' });
    console.log(`Attempt ${attemptNo}: unexpected success`, res.data);
  } catch (err) {
    if (err.response) {
      console.log(`Attempt ${attemptNo}: status=${err.response.status}`, err.response.data);
      return err.response.data;
    } else {
      console.error(`Attempt ${attemptNo}: network/error`, err.message);
    }
  }
}

async function run() {
  try {
    console.log('Looking up user:', TARGET_USERNAME);
    const user = await findUser(TARGET_USERNAME);
    if (!user) {
      console.error('User not found');
      process.exit(3);
    }
    console.log('Found user', user.id, user.username || user.full_name);

    console.log('Unlocking user via admin token...');
    await unlockUser(user.id);
    console.log('User unlocked. Now performing wrong-password attempts (1..5)');

    for (let i = 1; i <= 5; i++) {
      const data = await wrongLoginAttempt(TARGET_USERNAME, i);
      if (data && data.attemptsLeft !== undefined) {
        console.log(`Server reports attemptsLeft=${data.attemptsLeft}`);
      }
      if (data && /khóa/i.test(String(data.message || ''))) {
        console.log('Account locked by server during attempts. Stopping.');
        break;
      }
      // small delay
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('E2E script finished.');
  } catch (e) {
    console.error('E2E script error:', e && (e.stack || e.message || e));
    process.exit(1);
  }
}

run();
