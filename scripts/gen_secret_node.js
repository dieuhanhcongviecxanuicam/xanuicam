const fs = require('fs');
const crypto = require('crypto');
const bytes = 64;
const b = crypto.randomBytes(bytes).toString('base64');
console.log(b);
fs.writeFileSync('backend/.env', `JWT_SECRET=${b}\nJWT_ALGORITHM=HS512\n`, { encoding: 'utf8' });
console.log('Wrote backend/.env');
