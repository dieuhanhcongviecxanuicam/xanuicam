// ubndxanuicam/backend/src/routes/roomBookingRoutes.js
const express = require('express');
const router = express.Router();
const roomBookingController = require('../controllers/roomBookingController');
const { meetingDocsUpload } = require('../middlewares/uploadMiddleware');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/', roomBookingController.getBookings);
router.get('/deleted', hasPermission(['room_booking_management']), roomBookingController.getDeletedBookings);
router.get('/deleted-attachments', hasPermission(['room_booking_management']), roomBookingController.getDeletedAttachments);
// preview endpoint for attachments (docx -> HTML)
router.get('/attachments/preview', roomBookingController.previewAttachment);
// allow multiple meeting documents (pdf|docx) under field name 'attachments'
router.post('/', meetingDocsUpload.array('attachments', 6), roomBookingController.createBooking);
router.patch('/:id/status', hasPermission(['room_booking_management']), roomBookingController.updateBookingStatus);
router.put('/:id', meetingDocsUpload.array('attachments', 6), roomBookingController.updateBooking);
router.delete('/:id', roomBookingController.deleteBooking);
router.post('/deleted-attachments/:id/restore', hasPermission(['room_booking_management']), roomBookingController.restoreDeletedAttachment);
router.post('/deleted/:id/restore', hasPermission(['room_booking_management']), roomBookingController.restoreDeletedBooking);

module.exports = router;