const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');
const { validateRole, validate } = require('../middlewares/validationMiddleware');

router.use(verifyToken, hasPermission(['role_management']));

router.get('/', roleController.getRoles);
router.get('/permissions', roleController.getAllPermissions);
router.get('/:id', roleController.getRoleById);
router.post('/', validateRole, validate, roleController.createRole);
router.put('/:id', validateRole, validate, roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

// Deleted roles management (soft-deleted archive)
router.get('/deleted/list', roleController.getDeletedRoles);
router.post('/deleted/:id/restore', roleController.restoreDeletedRole);
router.delete('/deleted/:id/permanent', roleController.permanentlyDeleteRole);

module.exports = router;