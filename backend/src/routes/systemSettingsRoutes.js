const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

// Public route: get current broadcast notification (no auth required)
router.get('/notification', systemSettingsController.getPublicBroadcastNotification);

// Tất cả các route trong đây đều yêu cầu đăng nhập và có quyền 'system_settings'
router.use(verifyToken, hasPermission(['system_settings']));

// GET: Lấy tất cả cài đặt
router.get('/settings', systemSettingsController.getSystemSettings);

// PUT: Cập nhật chế độ bảo trì
router.put('/settings/maintenance', systemSettingsController.updateMaintenanceMode);

// PUT: Cập nhật / gửi thông báo broadcast
router.put('/settings/notification', systemSettingsController.updateBroadcastNotification);

// Admin QA endpoints to inspect/reset per-target edit tracking
router.get('/user-update-actions', systemSettingsController.getUserUpdateActions);
router.delete('/user-update-actions', systemSettingsController.deleteUserUpdateActions);

module.exports = router;