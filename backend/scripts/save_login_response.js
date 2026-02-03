const axios = require('axios');
const fs = require('fs');
(async () => {
  try {
    const resp = await axios.post('http://localhost:5000/api/auth/login', { identifier: 'admin', password: 'password' }, { timeout: 10000 });
    fs.writeFileSync('logs/login_response_full.json', JSON.stringify(resp.data, null, 2));
    console.log('Wrote logs/login_response_full.json');
  } catch (e) {
    console.error('Login failed:', e && e.response ? e.response.data : e.message);
    process.exit(1);
  }
})();
