const axios = require('axios');

async function run() {
  try {
    const resp = await axios.post('http://localhost:5000/api/auth/login', {
      identifier: 'admin',
      password: 'password'
    }, {
      timeout: 7000,
      validateStatus: () => true
    });

    console.log('HTTP_STATUS:', resp.status);
    console.log('HEADERS:', JSON.stringify(resp.headers, null, 2));
    console.log('BODY:', typeof resp.data === 'object' ? JSON.stringify(resp.data, null, 2) : resp.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('ERROR: Connection refused');
    } else if (err.code === 'ECONNABORTED') {
      console.error('ERROR: Timeout');
    } else {
      console.error('ERROR:', err.message);
      if (err.response) {
        console.error('RESPONSE STATUS:', err.response.status);
        console.error('RESPONSE DATA:', err.response.data);
      }
    }
  }
}

run();
