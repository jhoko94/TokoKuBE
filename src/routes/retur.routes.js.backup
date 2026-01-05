const express = require('express');
const router = express.Router();
const returController = require('../controllers/retur.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Retur Penjualan - Semua user bisa akses
router.get('/penjualan', authenticate, returController.getAllReturPenjualan);
router.post('/penjualan', authenticate, returController.createReturPenjualan);
// Approve/Reject retur penjualan - Hanya ADMIN, MANAGER, dan TESTER
router.put('/penjualan/:id/approve', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), returController.approveReturPenjualan);
router.put('/penjualan/:id/reject', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), returController.rejectReturPenjualan);

// Retur Pembelian - Hanya ADMIN, MANAGER, dan TESTER
router.get('/pembelian', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), returController.getAllReturPembelian);
router.post('/pembelian', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), returController.createReturPembelian);

module.exports = router;

