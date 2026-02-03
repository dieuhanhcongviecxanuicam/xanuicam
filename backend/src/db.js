// ubndxanuicam/backend/src/db.js
const { Pool } = require('pg');
const dbConfig = require('./config/db.config.js');

const pool = new Pool(dbConfig);

// CẢI TIẾN: Thêm sự kiện lắng nghe lỗi kết nối để chủ động xử lý sự cố
pool.on('error', (err, client) => {
  console.error('Lỗi không mong muốn trên client nhàn rỗi', err);
  // NOTE: In development we avoid exiting the process on pool errors
  // to allow investigation and avoid noisy restarts. In production a process
  // manager should restart the service. Keep logging for visibility.
});

pool.on('connect', () => {
  console.log('Đã kết nối thành công đến cơ sở dữ liệu PostgreSQL!');
});


module.exports = pool;