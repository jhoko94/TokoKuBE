const express = require('express');
const router = express.Router();
const poController = require('../controllers/po.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// (GET /api/purchase-orders) - Ambil PO (Cek Pesanan) - Hanya ADMIN, MANAGER, dan TESTER
router.get('/', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), poController.getPendingPOs);

// (POST /api/purchase-orders) - Buat PO baru (Pesan Barang) - Hanya ADMIN, MANAGER, dan TESTER
router.post('/', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), poController.createPO);

// (POST /api/purchase-orders/:id/receive) - Terima PO (Cek Pesanan) - Hanya ADMIN, MANAGER, dan TESTER
router.post('/:id/receive', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), poController.receivePO);

module.exports = router;