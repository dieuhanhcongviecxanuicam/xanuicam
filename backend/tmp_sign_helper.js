const fs = require('fs');
const jwtHelper = require('./src/utils/jwtHelper');
const payload = { user: { id:1, permissions:['full_access'], fullName: 'Dev Test' } };
const token = jwtHelper.sign(payload, { expiresIn: '1h' });
fs.writeFileSync('/tmp/admin_token.txt', token);
console.log('wrote /tmp/admin_token.txt (helper)');
