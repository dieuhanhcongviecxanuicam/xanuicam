const express = require('express');
const router = express.Router();
const ccController = require('../controllers/computerConfigsController');
let { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

// In test mode, bypass auth to simplify integration tests that mock the DB
if (process.env.NODE_ENV === 'test') {
	verifyToken = (req, res, next) => next();
	hasPermission = () => (req, res, next) => next();
}

router.use(verifyToken);

router.get('/', ccController.list);
router.get('/user/:userId', ccController.getByUser);
router.post('/export', hasPermission(['user_management']), ccController.exportConfigs);
router.get('/export/logs', hasPermission(['user_management']), ccController.getExportLogs);
// Only accounts with 'user_management' (or full_access) may create/update/delete configs
router.post('/user/:userId', hasPermission(['user_management']), ccController.upsertByUser);
router.delete('/user/:userId', hasPermission(['user_management']), ccController.deleteByUser);

module.exports = router;
