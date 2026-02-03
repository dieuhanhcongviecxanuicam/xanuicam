// Lightweight Redis client helper with safe fallback when not configured or module missing
let client = null;
const getClient = () => {
  if (client) return client;
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || null;
  if (!redisUrl) return null;
  try {
    // require inside try/catch so environments without the package won't crash
    const IORedis = require('ioredis');
    // Disable aggressive retrying in dev to avoid huge log noise when Redis isn't available locally.
    client = new IORedis(redisUrl, { maxRetriesPerRequest: 0, retryStrategy: null });
    client.on('error', (e) => {
      console.warn('Redis client error (will fallback to in-memory):', e && e.message ? e.message : e);
    });
    client.on('connect', () => {
      console.log('Redis client connected to', redisUrl);
    });
    client.on('ready', () => {
      console.log('Redis client ready');
    });
    // quick ping to verify availability (non-blocking)
    client.ping().catch((e) => console.warn('Redis ping failed (non-fatal):', e && e.message ? e.message : e));
    return client;
  } catch (e) {
    console.warn('ioredis not available or failed to initialize, falling back to in-memory rate limiter');
    return null;
  }
};

module.exports = { getClient };
