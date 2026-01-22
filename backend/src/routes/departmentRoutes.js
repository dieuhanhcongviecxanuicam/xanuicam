const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');
const { validateDepartment, validate } = require('../middlewares/validationMiddleware');
// SỬA LỖI: Import từ middleware đã hợp nhất
const { avatarUpload } = require('../middlewares/uploadMiddleware');
const rateLimit = require('express-rate-limit');

// Avatar upload limiter: 10 uploads per minute per IP
const avatarUploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.use(verifyToken, hasPermission(['department_management']));

router.get('/', departmentController.getDepartments);
router.get('/deleted', departmentController.getDeletedDepartments);
router.post('/deleted/:id/restore', departmentController.restoreDeletedDepartment);
router.delete('/deleted/:id', departmentController.permanentlyDeleteDepartment);
router.post('/export', departmentController.exportDepartments);
// SỬA LỖI: Sử dụng middleware đã import
router.post('/', avatarUploadLimiter, avatarUpload.single('avatar'), validateDepartment, validate, departmentController.createDepartment);
router.put('/:id', avatarUploadLimiter, avatarUpload.single('avatar'), validateDepartment, validate, departmentController.updateDepartment);
router.delete('/:id', departmentController.deleteDepartment);

module.exports = router;