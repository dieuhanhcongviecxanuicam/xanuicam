const express = require('express');
const router = express.Router();
const meetingDocsController = require('../controllers/meetingDocsController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { meetingDocsUpload } = require('../middlewares/uploadMiddleware');
const rateLimit = require('express-rate-limit');

// Limit meeting doc uploads to prevent abuse (3 uploads per minute per IP)
const meetingUploadLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 3,
	standardHeaders: true,
	legacyHeaders: false
});

router.use(verifyToken);

// list docs for current user (optional meetingId query)
router.get('/', meetingDocsController.listDocs);

// download by id
router.get('/:id/download', meetingDocsController.download);

// upload single file under field name 'file'
router.post('/upload', meetingUploadLimiter, meetingDocsUpload.single('file'), meetingDocsController.upload);

module.exports = router;
