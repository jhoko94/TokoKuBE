const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// (GET /api/customers/debt) - Ambil pelanggan yg punya utang (Catatan Utang)
router.get('/debt', customerController.getCustomersWithDebt);

// (POST /api/customers/:id/pay-debt) - Bayar Utang (Catatan Utang)
router.post('/:id/pay-debt', customerController.payDebt);

module.exports = router;