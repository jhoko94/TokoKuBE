const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouse.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Semua route warehouse memerlukan authentication
router.use(authenticate);

router.get('/', warehouseController.getAllWarehouses);
router.get('/:id', warehouseController.getWarehouse);
router.post('/', authorize('ADMIN', 'MANAGER', 'TESTER'), warehouseController.createWarehouse);
router.put('/:id', authorize('ADMIN', 'MANAGER', 'TESTER'), warehouseController.updateWarehouse);
router.delete('/:id', authorize('ADMIN'), warehouseController.deleteWarehouse);
router.post('/transfer', warehouseController.transferStock);

module.exports = router;

