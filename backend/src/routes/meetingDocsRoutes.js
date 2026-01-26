const express = require('express');
const router = express.Router();
const meetingDocsController = require('../controllers/meetingDocsController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { meetingDocsUpload } = require('../middlewares/uploadMiddleware');

router.use(verifyToken);

// list docs for current user (optional meetingId query)
router.get('/', meetingDocsController.listDocs);

// download by id
router.get('/:id/download', meetingDocsController.download);

// upload single file under field name 'file'
router.post('/upload', meetingDocsUpload.single('file'), meetingDocsController.upload);

module.exports = router;
