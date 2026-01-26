const express = require('express');
const router = express.Router();

// Optional cache middleware (uses REDIS_URL). If unavailable, handler falls back.
let cacheMiddleware = null;
try {
  cacheMiddleware = require('../middlewares/cacheMiddleware').cacheMiddleware;
} catch (e) {
  cacheMiddleware = null;
}

// Returns a timestamp and a random number; with cache middleware this will be cached
router.get('/', cacheMiddleware ? cacheMiddleware(30) : (req, res, next) => next(), (req, res) => {
  return res.json({ ts: new Date().toISOString(), value: Math.floor(Math.random() * 10000) });
});

module.exports = router;
