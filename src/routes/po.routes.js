const express = require('express');
const router = express.Router();
const poController = require('../controllers/po.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// (GET /api/purchase-orders) - Ambil PO (Cek Pesanan) - Hanya ADMIN dan MANAGER
router.get('/', authenticate, authorize('ADMIN', 'MANAGER'), poController.getPendingPOs);

// (POST /api/purchase-orders) - Buat PO baru (Pesan Barang) - Hanya ADMIN dan MANAGER
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), poController.createPO);

// (POST /api/purchase-orders/:id/receive) - Terima PO (Cek Pesanan) - Hanya ADMIN dan MANAGER
router.post('/:id/receive', authenticate, authorize('ADMIN', 'MANAGER'), poController.receivePO);

module.exports = router;