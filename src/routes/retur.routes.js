const express = require('express');
const router = express.Router();
const returController = require('../controllers/retur.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Retur Penjualan - Semua user bisa akses
router.get('/penjualan', authenticate, returController.getAllReturPenjualan);
router.post('/penjualan', authenticate, returController.createReturPenjualan);
// Approve/Reject retur penjualan - Hanya ADMIN dan MANAGER
router.put('/penjualan/:id/approve', authenticate, authorize('ADMIN', 'MANAGER'), returController.approveReturPenjualan);
router.put('/penjualan/:id/reject', authenticate, authorize('ADMIN', 'MANAGER'), returController.rejectReturPenjualan);

// Retur Pembelian - Hanya ADMIN dan MANAGER
router.get('/pembelian', authenticate, authorize('ADMIN', 'MANAGER'), returController.getAllReturPembelian);
router.post('/pembelian', authenticate, authorize('ADMIN', 'MANAGER'), returController.createReturPembelian);

module.exports = router;

