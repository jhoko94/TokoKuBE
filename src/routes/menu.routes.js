const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menu.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Public route - untuk get user menus
router.get('/user', authenticate, menuController.getUserMenus);

// Admin only routes
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', menuController.getAllMenus);
router.post('/', menuController.createMenu);
router.put('/:id', menuController.updateMenu);
router.post('/:menuId/permissions', menuController.setMenuPermission);
router.get('/roles/:roleId', menuController.getRoleMenus);

module.exports = router;

