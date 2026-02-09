// ubndxanuicam/backend/src/routes/roomBookingRoutes.js
const express = require('express');
const router = express.Router();
const roomBookingController = require('../controllers/roomBookingController');
const { meetingDocsUpload } = require('../middlewares/uploadMiddleware');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');
const rateLimit = require('express-rate-limit');

// Limit attachments per IP to reduce abuse (5 attachment uploads per minute)
const attachmentsLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

router.use(verifyToken);

router.get('/', roomBookingController.getBookings);
router.get('/deleted', hasPermission(['room_booking_management']), roomBookingController.getDeletedBookings);
router.get('/deleted-attachments', hasPermission(['room_booking_management']), roomBookingController.getDeletedAttachments);
// preview endpoint for attachments (docx -> HTML)
router.get('/attachments/preview', roomBookingController.previewAttachment);
// allow multiple meeting documents (pdf|docx) under field name 'attachments'
router.post('/', attachmentsLimiter, meetingDocsUpload.array('attachments', 6), roomBookingController.createBooking);
router.patch('/:id/status', hasPermission(['room_booking_management']), roomBookingController.updateBookingStatus);
router.put('/:id', attachmentsLimiter, meetingDocsUpload.array('attachments', 6), roomBookingController.updateBooking);
router.delete('/:id', roomBookingController.deleteBooking);
router.post('/deleted-attachments/:id/restore', hasPermission(['room_booking_management']), roomBookingController.restoreDeletedAttachment);
router.post('/deleted/:id/restore', hasPermission(['room_booking_management']), roomBookingController.restoreDeletedBooking);

module.exports = router;