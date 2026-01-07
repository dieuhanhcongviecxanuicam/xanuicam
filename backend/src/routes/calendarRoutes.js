// ubndxanuicam/backend/src/routes/calendarRoutes.js
const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { pdfAttachmentUpload, meetingDocsUpload } = require('../middlewares/uploadMiddleware');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Ai cũng có thể xem lịch
router.get('/', calendarController.getEvents);

// Chỉ người có quyền mới được quản lý sự kiện
// Accept files sent under either 'attachments' (array) or 'attachment' (single) for backward compatibility
// Accept up to 10 files for the `attachments` field and 1 for legacy `attachment`
router.post('/', hasPermission(['event_management']), meetingDocsUpload.any(), calendarController.createEvent);
router.put('/:id', hasPermission(['event_management']), meetingDocsUpload.any(), calendarController.updateEvent);
// Deleted attachments archive + restore (admin)
router.get('/deleted-attachments', hasPermission(['event_management']), calendarController.getDeletedAttachments);
router.post('/deleted-attachments/:id/restore', hasPermission(['event_management']), calendarController.restoreDeletedAttachment);
// Archived (deleted) events listing & restore
router.get('/deleted', hasPermission(['event_management']), calendarController.getDeletedEvents);
router.post('/deleted/:id/restore', hasPermission(['event_management']), calendarController.restoreDeletedEvent);
router.delete('/:id', hasPermission(['event_management']), calendarController.deleteEvent);

module.exports = router;