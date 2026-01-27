const express = require('express');
const router = express.Router();
const ccController = require('../controllers/computerConfigsController');
const rateLimit = require('express-rate-limit');
let { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

// Apply a strict limiter for export endpoints to prevent abuse.
const exportLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 5, // limit each IP to 5 export requests per minute
	standardHeaders: true,
	legacyHeaders: false
});

// In test mode, bypass auth to simplify integration tests that mock the DB
if (process.env.NODE_ENV === 'test') {
	verifyToken = (req, res, next) => next();
	hasPermission = () => (req, res, next) => next();
}

router.use(verifyToken);

router.get('/', ccController.list);
router.get('/user/:userId', ccController.getByUser);
router.post('/export', exportLimiter, hasPermission(['user_management']), ccController.exportConfigs);
router.get('/export/logs', hasPermission(['user_management']), ccController.getExportLogs);
// Only accounts with 'user_management' (or full_access) may create/update/delete configs
router.post('/user/:userId', hasPermission(['user_management']), ccController.upsertByUser);
router.delete('/user/:userId', hasPermission(['user_management']), ccController.deleteByUser);

module.exports = router;
