// ubndxanuicam/backend/server.js
// VERSION 3.0 - RESTRUCTURED WITH CENTRALIZED ROUTE HANDLER

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const crypto = require('crypto');
// Load .env from the backend directory explicitly so envs are consistent
try {
  const envPath = path.resolve(__dirname, '.env');
  dotenv.config({ path: envPath });
} catch (e) {
  dotenv.config();
}

// Ensure critical secrets exist at runtime; if missing, generate temporary values
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set — generating temporary runtime secret (not for production).');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}
if (!process.env.AUDIT_LOG_KEY) {
  console.warn('AUDIT_LOG_KEY not set — generating temporary 32-byte key (not for production).');
  process.env.AUDIT_LOG_KEY = crypto.randomBytes(32).toString('base64');
}

// Optional file-backed logging to capture runtime output for debugging in this environment.
// Enable by setting DEBUG_LOGS=true in the environment. Disabled by default to
// avoid noisy file writes in long-running or production-like runs.
if (process.env.DEBUG_LOGS === 'true') {
  const logDir = path.join(__dirname, 'logs');
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {}
  const logFile = path.join(logDir, 'server.log');
  const _origLog = console.log.bind(console);
  const _origErr = console.error.bind(console);
  const _appendLog = (...args) => {
    try {
      const line = new Date().toISOString() + ' ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n';
      fs.appendFileSync(logFile, line);
    } catch (e) {}
  };
  console.log = (...args) => { _appendLog(...args); _origLog(...args); };
  console.error = (...args) => { _appendLog('ERROR', ...args); _origErr(...args); };
} else {
  // Keep default console behavior; still print to stdout/stderr
}

// Improve visibility into crashes: log uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && (err.stack || err));
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason && (reason.stack || reason));
});

process.on('exit', (code) => {
  console.log('process: exit event fired with code', code);
});
process.on('SIGINT', () => {
  console.log('process: SIGINT');
  // In CI or this interactive environment external terminals sometimes send
  // SIGINT unexpectedly which kills the server and prevents debugging. For
  // safety, only exit on SIGINT in production; in development we log and
  // continue so we can capture diagnostics and keep the server running.
  if (process.env.NODE_ENV === 'production') {
    process.exit(0);
  } else {
    console.log('Ignoring SIGINT in non-production to allow debug runs.');
  }
});
process.on('SIGTERM', () => {
  console.log('process: SIGTERM');
  process.exit(0);
});

// --- Nạp bộ điều phối route trung tâm ---
const apiRoutes = require('./src/routes');

// --- Nạp các middleware ---
const { verifyTokenOptional } = require('./src/middlewares/authMiddleware');
const maintenanceMiddleware = require('./src/middlewares/maintenanceMiddleware');

const app = express();

// Temporary request-logging middleware for debugging Cloudflare / CDN routing.
// Enable by setting REQUEST_LOGGING=true in the backend `.env` (disabled by default).
if (process.env.REQUEST_LOGGING === 'true') {
  app.use((req, res, next) => {
    try {
      const cfIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
      const cfRay = req.headers['cf-ray'] || '';
      console.log(`[REQ] ${new Date().toISOString()} ip=${cfIp} method=${req.method} url=${req.originalUrl} cf-ray=${cfRay}`);
    } catch (e) {
      console.log('Error in request-logging middleware', e);
    }
    next();
  });
}

// Default port if none provided via environment. Tests may set `process.env.PORT`
// to `0` to bind to an ephemeral port.
const PORT = process.env.PORT || 5000;

// If running behind a proxy (nginx, Heroku, etc.) enable trust proxy
app.set('trust proxy', true);

const allowedOrigins = [
  'https://xanuicam.vn', 
  'https://www.xanuicam.vn' 
];

// Cho phép origin localhost để dễ dàng test local khi biến môi trường ALLOW_LOCALHOST=true
if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCALHOST === 'true') {
    allowedOrigins.push('http://localhost:3000');
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., server-to-server, curl)
    if (!origin) return callback(null, true);

    // In non-production environments be permissive to avoid CORS failures
    // while testing locally or in CI. In production use the allowedOrigins list.
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    // Exact match against allowed list
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);

    // If ALLOW_LOCALHOST is enabled, allow any localhost origin (any port)
    if (process.env.ALLOW_LOCALHOST === 'true') {
      try {
        const u = new URL(origin);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return callback(null, true);
      } catch (e) {
        // fall through
      }
    }

    callback(new Error('Not allowed by CORS'));
  },
  // Allow credentials (cookies) to be sent from the frontend when using
  // `fetch(..., { credentials: 'include' })`. When true, Access-Control-Allow-Credentials
  // header will be set to 'true' (required by the browser for credentialed requests).
  credentials: true,
  // Explicitly allow common methods and headers used by the frontend
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.use(express.json());
// Sanitize incoming request bodies (coerce empty date-like strings to null)
try {
  const sanitizeMiddleware = require('./src/middlewares/sanitizeMiddleware');
  app.use(sanitizeMiddleware);
} catch (e) {
  console.warn('sanitizeMiddleware not available, continuing without it.');
}

// Serve frontend build early to allow static assets and index.html to be
// returned without running global auth/maintenance middleware which may
// depend on the database. This helps the app remain responsive when the DB
// is temporarily unreachable (useful during maintenance and deploys).
try {
  const earlyBuildPath = path.resolve(__dirname, '../frontend/build');
  const earlyIndex = path.join(earlyBuildPath, 'index.html');
  const serveFrontendEarly = (process.env.NODE_ENV === 'production') || (process.env.SERVE_FRONTEND === 'true');
  if (serveFrontendEarly && fs.existsSync(earlyIndex)) {
    console.log('Serving frontend build (early) from', earlyBuildPath);
    app.use(express.static(earlyBuildPath, {
      setHeaders: (res, filePath) => {
        try {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } catch (e) {}
      }
    }));
    app.get(/^\/(?!api\/|auth\/|static\/).*/, (req, res) => {
      res.sendFile(earlyIndex);
    });
  }
} catch (e) {
  console.warn('Early frontend serve registration failed:', e && (e.stack || e));
}
// Serve uploads with safe download headers to reduce content-sniffing risks.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    try {
      // Apply secure headers for downloads and binary files
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
      res.setHeader('X-Download-Options', 'noopen');
    } catch (e) {
      // Best-effort; don't crash the request on header failures
    }
  }
}));

// JSON parse error handler: return a clean 400 JSON response when the
// client sends invalid JSON instead of crashing the request handler.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.warn('Invalid JSON body received');
    return res.status(400).json({ message: 'Invalid JSON body' });
  }
  return next(err);
});

// --- Áp dụng Middleware toàn cục ---
app.use(verifyTokenOptional);
app.use(maintenanceMiddleware);

// --- Khai báo tuyến đường API chính ---
app.use('/api', apiRoutes); // Tất cả các route API sẽ bắt đầu bằng /api

// --- Backwards compatibility: accept some endpoints without the /api prefix ---
// Historically some clients called /auth/login directly — provide alias routes so
// the frontend still works if REACT_APP_API_BASE_URL was set without '/api'.
app.use('/auth', require('./src/routes/authRoutes'));

// Root health check / informational endpoint
app.get('/', (req, res) => {
  // If a frontend build exists, serve the index at root so the SPA is
  // available at `/`. Previously this redirected to `/dashboard` which
  // caused unexpected client-side routing issues when the app was built
  // to run at root.
  try {
    const buildIndex = path.resolve(__dirname, '../frontend/build/index.html');
    if (fs.existsSync(buildIndex)) return res.sendFile(buildIndex);
  } catch (e) {
    // fall through
  }
  res.send('UBND xã Núi Cấm - Backend API is running. Use /api for endpoints.');
});

// Lightweight JSON health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), env: process.env.NODE_ENV || 'development' });
});

// Serve a no-content response for favicon requests to avoid 404 noise in browsers
// Serve a simple favicon (SVG) to avoid 404 noise
// Serve a versioned favicon path to allow easy cache-busting when pushing a new
// favicon. We expose `/favicon-v2.ico` for the asset and make `/favicon.ico`
// redirect to it with `Cache-Control: no-cache` so clients and edges revalidate.
app.get('/favicon.ico', (req, res) => {
  // Force a redirect to the versioned favicon to guarantee CDN/edges
  // request the new, versioned asset. Keep response no-cache so
  // clients and intermediaries will revalidate the redirect.
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.redirect(302, '/favicon-v2.ico');
  } catch (e) {
    return res.status(204).end();
  }
});

// Serve the versioned favicon file if present. This is intentionally a new
// path so the CDN/edges will request it freshly when referenced.
app.get('/favicon-v2.ico', (req, res) => {
  try {
    const file = path.resolve(__dirname, '../frontend/build/favicon-v2.ico');
    if (fs.existsSync(file)) {
      res.setHeader('Content-Type', 'image/x-icon');
      // Allow caching for the asset itself; the URL is versioned so it's safe.
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(file);
    }
    return res.status(404).end();
  } catch (e) {
    return res.status(204).end();
  }
});

// (Removed convenience redirects to /dashboard) - dashboard will be mounted at root.

// Serve frontend SPA when a production build exists. Only enable static
// serving when running in production or when the `SERVE_FRONTEND` env var is
// explicitly set to "true". This prevents accidentally serving a stale
// `frontend/build` during local development where the dev server is preferred.
{
  const buildPath = path.resolve(__dirname, '../frontend/build');
  const indexFile = path.join(buildPath, 'index.html');
  const serveFrontend = (process.env.NODE_ENV === 'production') || (process.env.SERVE_FRONTEND === 'true');

  if (serveFrontend) {
    if (fs.existsSync(indexFile)) {
      console.log('Serving frontend build from', buildPath);
      // Serve static files with explicit safe headers to avoid MIME/sniffing issues
      app.use(express.static(buildPath, {
        setHeaders: (res, filePath) => {
          try {
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.js') res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
            else if (ext === '.css') res.setHeader('Content-Type', 'text/css; charset=UTF-8');
            else if (ext === '.json') res.setHeader('Content-Type', 'application/json; charset=UTF-8');
            else if (ext === '.wasm') res.setHeader('Content-Type', 'application/wasm');
            else if (ext === '.svg') res.setHeader('Content-Type', 'image/svg+xml');
            // prevent content sniffing
            res.setHeader('X-Content-Type-Options', 'nosniff');
            // allow caching for static assets
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } catch (e) {
            // ignore header-setting errors
          }
        }
      }));

      // Serve index.html for any GET path that doesn't start with /api, /auth or /static
      // so single-page-app client routes are handled by the React router.
      app.get(/^\/(?!api\/|auth\/|static\/).*/, (req, res) => {
        res.sendFile(indexFile);
      });
    } else {
      console.warn(`SERVE_FRONTEND enabled but frontend build not found at ${buildPath}.`);
    }
  } else {
    console.log('Not serving frontend build (NODE_ENV != production and SERVE_FRONTEND != true).');
  }
}

// Encapsulate server startup so tests can import `app` without binding to a port.
function startServer(port = process.env.PORT || PORT) {
  const listenPort = port || PORT;
  const server = app.listen(listenPort, () => {
    console.log(`🚀 Máy chủ đang chạy tại http://localhost:${listenPort}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${listenPort} is already in use.`);
      if (process.env.NODE_ENV !== 'production' && listenPort === 3000) {
        const fallback = 5000;
        console.warn(`Attempting to fall back to port ${fallback} to avoid collision.`);
        app.listen(fallback, () => console.log(`🚀 Máy chủ đang chạy tại http://localhost:${fallback}`));
        return;
      }
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });

  // Start background workers when running as a real server
  try {
    const pruner = require('./src/workers/sessionPruner');
    if (pruner && typeof pruner.start === 'function') pruner.start();
  } catch (e) {
    console.error('Failed to start session pruner:', e && (e.stack || e));
  }
  try {
    const auditPruner = require('./src/workers/auditPruner');
    if (auditPruner && typeof auditPruner.start === 'function') auditPruner.start();
  } catch (e) {
    console.error('Failed to start audit pruner:', e && (e.stack || e));
  }
  try {
    const deletedPruner = require('./src/workers/deletedUsersPruner');
    if (deletedPruner && typeof deletedPruner.start === 'function') deletedPruner.start();
  } catch (e) {
    console.error('Failed to start deleted users pruner:', e && (e.stack || e));
  }
  try {
    const deletedRolesPruner = require('./src/workers/deletedRolesPruner');
    if (deletedRolesPruner && typeof deletedRolesPruner.start === 'function') deletedRolesPruner.start();
  } catch (e) {
    console.error('Failed to start deleted roles pruner:', e && (e.stack || e));
  }
  try {
    const deletedDepartmentsPruner = require('./src/workers/deletedDepartmentsPruner');
    if (deletedDepartmentsPruner && typeof deletedDepartmentsPruner.start === 'function') deletedDepartmentsPruner.start();
  } catch (e) {
    console.error('Failed to start deleted departments pruner:', e && (e.stack || e));
  }

  // Check for soffice availability
  try {
    const { spawnSync } = require('child_process');
    const check = spawnSync(process.env.SOFFICE_PATH || 'soffice', ['--version'], { stdio: 'ignore', timeout: 5000 });
    if (check.status === 0) {
      process.env.SOFFICE_AVAILABLE = 'true';
      console.log('soffice detected on PATH or SOFFICE_PATH — PDF conversion available.');
    } else {
      process.env.SOFFICE_AVAILABLE = 'false';
      console.log('soffice not detected (exit ' + check.status + '). PDF conversion via native soffice will not be available.');
    }
  } catch (e) {
    process.env.SOFFICE_AVAILABLE = 'false';
    console.log('soffice not detected. Set SOFFICE_PATH to the soffice binary if installed.');
  }

  // Ensure EXPORT_TMP_DIR exists and secure it in production
  try {
    const exportTmp = process.env.EXPORT_TMP_DIR || require('os').tmpdir();
    if (!fs.existsSync(exportTmp)) {
      fs.mkdirSync(exportTmp, { recursive: true });
    }
    if (process.env.NODE_ENV === 'production') {
      try { fs.chmodSync(exportTmp, 0o700); } catch (e) { /* ignore permission errors */ }
    }
    console.log('EXPORT_TMP_DIR:', exportTmp);
  } catch (e) {
    console.warn('Could not prepare EXPORT_TMP_DIR', e && (e.stack || e));
  }

  return server;
}

// If called directly, start the server. When required by tests, they can import
// the `app` and call `startServer()` with an alternate port (like 0) to bind
// to an ephemeral port and avoid collisions.
if (require.main === module) {
  startServer();
}

// Export `app` and the `startServer` helper for test harnesses.
module.exports = { app, startServer };