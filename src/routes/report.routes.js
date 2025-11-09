const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');

// (GET /api/reports) - Laporan (Dummy)
router.get('/', reportController.getReports);

// (POST /api/reports/opname) - Proses Stok Opname
router.post('/opname', reportController.processStockOpname);

module.exports = router;