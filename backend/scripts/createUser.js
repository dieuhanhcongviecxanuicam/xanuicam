const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function createUser() {
  const cccd = '000000000001';
  const password = 'password';
  const fullName = 'Quản trị viên (Admin)';
  const role_id = 1;

  console.log('Đang mã hóa mật khẩu...');
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);
  console.log('Mã hóa thành công!');

  try {
    console.log('Đang thêm người dùng vào CSDL...');
    const query = 'INSERT INTO users (cccd, password_hash, full_name, role_id) VALUES ($1, $2, $3, $4) RETURNING *';
    const { rows } = await pool.query(query, [cccd, password_hash, fullName, role_id]);
    console.log('Tạo người dùng thành công:', rows[0]);
  } catch (error) {
    if (error.code === '23505') {
        console.error('Lỗi: Người dùng với CCCD này đã tồn tại.');
    } else {
        console.error('Đã xảy ra lỗi:', error);
    }
  } finally {
    await pool.end();
  }
}

createUser();