// ubndxanuicam/backend/src/routes/meetingRoutes.js
const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/', meetingController.getMeetings);
router.post('/', meetingController.createMeeting);

// NÂNG CẤP: Route mới để phê duyệt/từ chối cuộc họp
router.patch('/:id/status', hasPermission(['meeting_management']), meetingController.updateMeetingStatus);


module.exports = router;