const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Tất cả các route trong đây đều yêu cầu người dùng phải đăng nhập
router.use(verifyToken);

// GET /api/notifications - Lấy danh sách thông báo
router.get('/', notificationController.getNotifications);

// GET/PUT prefs for current user
router.get('/prefs', notificationController.getPrefs);
router.put('/prefs', notificationController.updatePrefs);

// POST /api/notifications/mark-all-as-read - Đánh dấu tất cả là đã đọc
router.post('/mark-all-as-read', notificationController.markAllAsRead);

// BỔ SUNG: Route để đánh dấu một thông báo là đã đọc
router.post('/:id/read', notificationController.markAsRead);

module.exports = router;