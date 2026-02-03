const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

// Mọi route trong đây đều yêu cầu đăng nhập
router.use(verifyToken);

// POST: Người dùng gửi một góp ý mới
router.post('/', feedbackController.submitFeedback);

// == BỔ SUNG ROUTE MỚI ==
// GET: Người dùng lấy lịch sử góp ý của chính mình
router.get('/my-feedback', feedbackController.getMyFeedback);

// GET: Admin lấy danh sách tất cả các góp ý
router.get('/', hasPermission(['system_settings']), feedbackController.getAllFeedback);

// GET: Admin lấy chi tiết một góp ý
router.get('/:id', hasPermission(['system_settings']), feedbackController.getFeedbackById);

// PUT: Admin phản hồi một góp ý
router.put('/:id/respond', hasPermission(['system_settings']), feedbackController.respondToFeedback);

module.exports = router;