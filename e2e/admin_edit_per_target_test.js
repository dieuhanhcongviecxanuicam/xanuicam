const axios = require('axios');
const base = 'http://localhost:5000';

async function login(username, password) {
  const r = await axios.post(base + '/api/auth/login', { username, password }).catch(e => { throw e.response ? e.response.data : e; });
  return r.data.token || r.data;
}

async function run() {
  try {
    const token = await login('admin', 'password');
    console.log('ADMIN_TOKEN_OK');
    const headers = { Authorization: `Bearer ${token}` };

    // create test user
    const username = 'e2e_target_' + Date.now();
    const createRes = await axios.post(base + '/api/users', { fullName: 'E2E Target', username, password: 'secret123', role_id: 4 }, { headers }).catch(e => { throw e.response ? e.response.data : e; });
    const target = createRes.data || createRes;
    console.log('CREATED_TARGET', target.id || target);

    // perform two updates (should succeed)
    for (let i = 1; i <= 2; i++) {
      const upd = await axios.patch(base + `/api/users/${target.id}`, { fullName: `E2E Updated ${i}` }, { headers }).catch(e => e.response ? e.response : e);
      console.log(`EDIT_${i}`, upd.status, upd.data ? (upd.data.message || JSON.stringify(upd.data).slice(0,120)) : 'no-data');
    }

    // third update should be blocked (403)
    const third = await axios.patch(base + `/api/users/${target.id}`, { fullName: `E2E Updated 3` }, { headers }).catch(e => e.response ? e.response : e);
    console.log('EDIT_3', third.status, third.data ? (third.data.message || JSON.stringify(third.data).slice(0,120)) : 'no-data');

    process.exit(0);
  } catch (err) {
    console.error('ERROR', err && (err.message || JSON.stringify(err)).slice ? (err.message || JSON.stringify(err)) : err);
    process.exit(2);
  }
}

run();
