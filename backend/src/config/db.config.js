// ubndxanuicam/backend/src/config/db.config.js
require('dotenv').config();

// If a single DATABASE_URL is provided prefer it (common in containerized/production envs).
// Otherwise fall back to individual DB_* variables. Keep pooling options in both cases.
const base = {
  // Pool tuning
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (process.env.DATABASE_URL) {
  module.exports = Object.assign({ connectionString: process.env.DATABASE_URL }, base);
} else {
  module.exports = Object.assign({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  }, base);
}