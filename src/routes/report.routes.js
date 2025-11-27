const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// (GET /api/reports) - Laporan - Hanya ADMIN dan MANAGER
router.get('/', authenticate, authorize('ADMIN', 'MANAGER'), reportController.getReports);

// (POST /api/reports/opname) - Proses Stok Opname - Hanya ADMIN dan MANAGER
router.post('/opname', authenticate, authorize('ADMIN', 'MANAGER'), reportController.processStockOpname);

module.exports = router;