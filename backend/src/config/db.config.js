// ubndxanuicam/backend/src/config/db.config.js
require('dotenv').config();

module.exports = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // CẢI TIẾN: Thêm cấu hình pooling để tối ưu hiệu suất
  max: 20, // Số lượng client tối đa trong pool
  idleTimeoutMillis: 30000, // Thời gian client có thể đứng yên trước khi bị đóng
  // Increase connection timeout to avoid transient network hiccups during dev
  connectionTimeoutMillis: 10000, // Thời gian chờ kết nối trước khi báo lỗi (10s)
};