const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');

// (POST /api/transactions) - Proses Transaksi (Jualan Baru)
router.post('/', transactionController.processTransaction);

module.exports = router;