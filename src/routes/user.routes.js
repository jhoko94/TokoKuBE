const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Semua route user memerlukan authentication dan hanya ADMIN yang bisa akses
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUser);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.post('/:id/reset-password', userController.resetPassword);

module.exports = router;

