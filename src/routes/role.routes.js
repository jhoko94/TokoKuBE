const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Semua route role memerlukan authentication dan hanya ADMIN yang bisa akses
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', roleController.getAllRoles);
router.get('/:id', roleController.getRole);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

module.exports = router;

