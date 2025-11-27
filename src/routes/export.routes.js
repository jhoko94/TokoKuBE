const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Semua route export memerlukan authentication
router.use(authenticate);

router.get('/sales', exportController.exportSales);
router.get('/products', exportController.exportProducts);
router.get('/debt', exportController.exportDebt);
router.get('/stock-history', exportController.exportStockHistory);

module.exports = router;

