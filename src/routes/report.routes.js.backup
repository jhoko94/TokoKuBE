const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// (GET /api/reports) - Laporan - Hanya ADMIN, MANAGER, dan TESTER
router.get('/', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), reportController.getReports);

// (POST /api/reports/opname) - Proses Stok Opname - Hanya ADMIN, MANAGER, dan TESTER
router.post('/opname', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), reportController.processStockOpname);

module.exports = router;