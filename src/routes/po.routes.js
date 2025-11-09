const express = require('express');
const router = express.Router();
const poController = require('../controllers/po.controller');

// (GET /api/purchase-orders) - Ambil PO (Cek Pesanan)
router.get('/', poController.getPendingPOs);

// (POST /api/purchase-orders) - Buat PO baru (Pesan Barang)
router.post('/', poController.createPO);

// (POST /api/purchase-orders/:id/receive) - Terima PO (Cek Pesanan)
router.post('/:id/receive', poController.receivePO);

module.exports = router;