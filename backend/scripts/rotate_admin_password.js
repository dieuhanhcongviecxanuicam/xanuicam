// Rotate Admin password to a generated strong secret and save to file
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');

(async ()=>{
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
  try{
    // Generate a 24-character base64 password
    const newPass = crypto.randomBytes(18).toString('base64').replace(/\+/g,'A').replace(/\//g,'B');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPass, salt);

    const res = await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2 RETURNING id, username", [hash, 'admin']);
    if (res.rowCount === 0) {
      console.error('Admin user not found (username=admin). No change made.');
      process.exit(2);
    }

    const outPath = path.resolve(__dirname, 'admin_new_password.txt');
    const content = `# Admin rotated password (do not commit to VCS)\n# Generated: ${new Date().toISOString()}\nusername: admin\npassword: ${newPass}\n`;
    fs.writeFileSync(outPath, content, { encoding: 'utf8', flag: 'w' });
    console.log('Admin password rotated and saved to', outPath);
    console.log('New password (also printed once):', newPass);
  }catch(e){
    console.error('Failed to rotate admin password:', e);
    process.exit(1);
  }finally{
    await pool.end();
  }
})();
