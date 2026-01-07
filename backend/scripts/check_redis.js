const path = require('path');
// load backend .env so REDIS_URL is available to scripts
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getClient } = require('../src/utils/redisClient');

(async ()=>{
  try {
    const client = getClient();
    if (!client) {
      console.log('Redis not configured (REDIS_URL not set or ioredis missing).');
      process.exit(0);
    }
    const pong = await client.ping();
    console.log('Redis ping response:', pong);
    // test simple key
    await client.set('health:redis_test', '1', 'EX', 10);
    const v = await client.get('health:redis_test');
    console.log('Redis test key:', v);
    process.exit(0);
  } catch (e) {
    console.error('Redis check failed:', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
