// ubndxanuicam/backend/src/routes/taskRoutes.js
// VERSION 2.0 - VERIFIED AND FINALIZED

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { verifyToken, hasPermission, hasAnyPermission } = require('../middlewares/authMiddleware');
const { validateTaskCreation, validate } = require('../middlewares/validationMiddleware');
const { attachmentUpload } = require('../middlewares/uploadMiddleware');
const rateLimit = require('express-rate-limit');

// Task attachment limiter: 10 uploads per minute per IP
const taskAttachmentLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.use(verifyToken);

router.get('/', taskController.getTasks);
router.get('/deleted', taskController.getDeletedTasks);
router.post('/', hasPermission(['create_task']), validateTaskCreation, validate, taskController.createTask);
router.get('/:id', taskController.getTask);
router.get('/:id/history', taskController.getTaskHistory);
router.put('/:id', hasPermission(['edit_delete_task']), taskController.updateTask);
router.patch('/:id/status', taskController.updateTaskStatus);
router.patch('/:id/kpi', hasPermission(['approve_task']), taskController.updateTaskKpi);
router.delete('/:id', hasPermission(['edit_delete_task']), taskController.deleteTask);

// Deleted tasks management (restore / permanent delete)
router.post('/deleted/:id/restore', taskController.restoreDeletedTask);
router.delete('/deleted/:id', taskController.permanentlyDeleteTask);

// POST: bulk export tasks (xlsx/pdf/csv) with password confirmation and per-account daily limit
router.post('/export', hasAnyPermission(['view_reports','export_tasks']), taskController.exportTasksBulk);

// Routes cho bình luận và tệp đính kèm
router.get('/:id/comments', taskController.getTaskComments);
router.post('/:id/comments', taskController.addTaskComment);
router.get('/:id/attachments', taskController.getTaskAttachments);
router.post('/:id/attachments', taskAttachmentLimiter, attachmentUpload.single('file'), taskController.addTaskAttachment);

module.exports = router;