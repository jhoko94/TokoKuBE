const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { authenticate } = require('../middleware/auth.middleware');

// (GET /api/transactions) - Get all transactions
router.get('/', authenticate, transactionController.getAllTransactions);

// (GET /api/transactions/:invoiceNumber) - Get transaction by invoice number
router.get('/:invoiceNumber', authenticate, transactionController.getTransactionByInvoice);

// (POST /api/transactions) - Proses Transaksi (Jualan Baru)
router.post('/', authenticate, transactionController.processTransaction);

module.exports = router;