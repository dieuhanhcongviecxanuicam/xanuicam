const axios = require('axios');
const fs = require('fs');
(async () => {
  const out = { timestamp: new Date().toISOString() };
  try {
    const resp = await axios.post('http://localhost:5000/api/auth/login', { identifier: 'admin', password: 'password' }, { timeout: 7000, validateStatus: () => true });
    out.status = resp.status;
    out.headers = resp.headers;
    out.data = resp.data;
  } catch (e) {
    out.error = e.message;
    if (e.response) { out.status = e.response.status; out.data = e.response.data; }
  }
  fs.writeFileSync('logs/login_test_output.json', JSON.stringify(out, null, 2));
  console.log('WROTE logs/login_test_output.json');
})();
