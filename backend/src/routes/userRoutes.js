// ubndxanuicam/backend/src/routes/userRoutes.js
// VERSION 2.0 - VERIFIED AND FINALIZED

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');
const { validateUserCreation, validateUserUpdate, validate } = require('../middlewares/validationMiddleware');
const { avatarUpload } = require('../middlewares/uploadMiddleware');

// Mọi route quản lý người dùng đều yêu cầu quyền 'user_management'
router.use(verifyToken, hasPermission(['user_management']));

router.get('/', userController.getUsers);
// Export users report (Excel/PDF/CSV)
router.post('/export', userController.exportUsers);
// Get export quota for current admin
router.get('/export/quota', userController.exportQuota);
// lightweight uniqueness check: ?username=...&excludeId=123
router.get('/unique', userController.checkUnique);
// Archived users (deleted/restore)
router.get('/deleted', userController.getDeletedUsers);
router.post('/deleted/:id/restore', userController.restoreDeletedUser);
// Permanently delete an archived user (admin action) - requires MFA token in body
router.delete('/deleted/:id', userController.permanentlyDeleteUser);
router.get('/:id', userController.getUserById);
router.post('/', avatarUpload.single('avatar'), validateUserCreation, validate, userController.createUser);
// New: support PATCH for partial updates (preferred). Keep PUT for backward
// compatibility but log a deprecation warning when used.
router.patch('/:id', avatarUpload.single('avatar'), validateUserUpdate, validate, userController.updateUser);
router.put('/:id', (req, res, next) => {
	console.warn('DEPRECATION: PUT /api/users/:id is deprecated in favor of PATCH for partial updates.');
	return next();
}, avatarUpload.single('avatar'), validateUserUpdate, validate, userController.updateUser);
router.patch('/:id/status', userController.toggleUserStatus);
router.post('/:id/unlock', userController.unlockUser);
router.delete('/:id', userController.deleteUser);
router.get('/:id/tasks', userController.getUserTasks);

module.exports = router;