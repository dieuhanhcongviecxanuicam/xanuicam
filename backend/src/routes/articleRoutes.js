// ubndxanuicam/backend/src/routes/articleRoutes.js
// VERSION 2.0 - ADDED MISSING ROUTES AND PERMISSIONS

const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');
// Sử dụng middleware upload đã được chuẩn hóa
const { attachmentUpload } = require('../middlewares/uploadMiddleware');

// Mọi route đều yêu cầu đăng nhập
router.use(verifyToken);

// GET: Ai cũng có thể xem danh sách bài viết và chi tiết bài viết
router.get('/:category', articleController.getArticlesByCategory);
router.get('/view/:id', articleController.getArticleById);

// POST, PUT, DELETE: Yêu cầu quyền quản lý bài viết
router.post('/', hasPermission(['article_management']), attachmentUpload.array('attachments', 10), articleController.createArticle);
router.put('/:id', hasPermission(['article_management']), attachmentUpload.array('attachments', 10), articleController.updateArticle);
router.delete('/:id', hasPermission(['article_management']), articleController.deleteArticle);

module.exports = router;