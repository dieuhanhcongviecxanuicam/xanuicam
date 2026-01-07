const axios = require('axios');
(async () => {
  try {
    const resp = await axios.post('http://localhost:5000/api/auth/login', {
      identifier: 'admin',
      password: '3pxQdHBGfXkgGYCviiPxGBBA',
      device: { userAgent: 'node-test' }
    }, { timeout: 10000 });
    console.log('STATUS', resp.status);
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('ERR STATUS', err.response.status, 'DATA', err.response.data);
    } else {
      console.error('ERR', err.message);
    }
    process.exit(1);
  }
})();
