const Redis = require('ioredis');

let client = null;
if (process.env.REDIS_URL) {
  try {
    client = new Redis(process.env.REDIS_URL);
  } catch (e) {
    console.warn('Failed to initialize Redis client for caching:', e && e.message);
  }
}

// Simple key-based caching middleware. Use by adding to routes like:
// app.get('/api/whatever', cacheMiddleware(60), handler)
function cacheMiddleware(ttlSeconds) {
  return async (req, res, next) => {
    if (!client) return next();
    try {
      const key = `cache:${req.method}:${req.originalUrl}`;
      const cached = await client.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
      // capture send to cache response body
      const origJson = res.json.bind(res);
      res.json = async (body) => {
        try {
          await client.setex(key, ttlSeconds || 60, JSON.stringify(body));
        } catch (e) {}
        res.setHeader('X-Cache', 'MISS');
        return origJson(body);
      };
      next();
    } catch (e) {
      return next();
    }
  };
}

module.exports = { cacheMiddleware };
