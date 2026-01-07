const express = require('express');
const router = express.Router();
const barcodeController = require('../controllers/barcode.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// GET /api/barcodes - List semua barcode (Semua user bisa akses untuk melihat)
router.get('/', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER', 'KASIR', 'PROG'), barcodeController.getAllBarcodes);

// GET /api/barcodes/:id - Detail barcode (Semua user bisa akses untuk melihat)
router.get('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER', 'KASIR', 'PROG'), barcodeController.getBarcodeById);

// POST /api/barcodes - Tambah barcode baru (Hanya ADMIN, MANAGER, TESTER, PROG)
router.post('/', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER', 'PROG'), barcodeController.createBarcode);

// POST /api/barcodes/generate - Generate barcode random (Hanya ADMIN, MANAGER, TESTER, PROG)
router.post('/generate', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER', 'PROG'), barcodeController.generateBarcode);

// PUT /api/barcodes/:id - Update barcode (Hanya ADMIN, MANAGER, TESTER, PROG)
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER', 'PROG'), barcodeController.updateBarcode);

// DELETE /api/barcodes/bulk - Bulk delete barcode (Hanya ADMIN, MANAGER, TESTER, PROG)
router.delete('/bulk', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER', 'PROG'), barcodeController.bulkDeleteBarcodes);

// DELETE /api/barcodes/:id - Hapus barcode (Hanya ADMIN, MANAGER, TESTER, PROG)
router.delete('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER', 'PROG'), barcodeController.deleteBarcode);

module.exports = router;

