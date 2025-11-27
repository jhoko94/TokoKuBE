const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// (GET /api/products) - Ambil semua produk (Semua user bisa akses untuk melihat)
router.get('/', authenticate, productController.getAllProducts);

// (POST /api/products) - Buat produk baru (Master Barang) - Hanya ADMIN dan MANAGER
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), productController.createProduct);

// (POST /api/products/import) - Import produk dari template - Hanya ADMIN dan MANAGER
router.post('/import', authenticate, authorize('ADMIN', 'MANAGER'), productController.importProducts);

// (PUT /api/products/bulk-update-distributor) - Bulk update distributor - Hanya ADMIN dan MANAGER
router.put('/bulk-update-distributor', authenticate, authorize('ADMIN', 'MANAGER'), productController.bulkUpdateDistributor);

// (PUT /api/products/bulk-update-unit) - Bulk update satuan kecil/besar - Hanya ADMIN dan MANAGER
router.put('/bulk-update-unit', authenticate, authorize('ADMIN', 'MANAGER'), productController.bulkUpdateUnit);

// (PUT /api/products/:id) - Update produk (Master Barang) - Hanya ADMIN dan MANAGER
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), productController.updateProduct);

// (DELETE /api/products/:id) - Hapus produk (Master Barang) - Hanya ADMIN dan MANAGER
router.delete('/:id', authenticate, authorize('ADMIN', 'MANAGER'), productController.deleteProduct);

// (GET /api/products/suggestions) - Saran PO (Pesan Barang) - Hanya ADMIN dan MANAGER
router.get('/suggestions', authenticate, authorize('ADMIN', 'MANAGER'), productController.getPOSuggestions);

// (POST /api/products/:id/add-stock) - Tambah Stok (Cek Barang) - Hanya ADMIN dan MANAGER
router.post('/:id/add-stock', authenticate, authorize('ADMIN', 'MANAGER'), productController.addStock);

// (GET /api/products/:id/stock-card) - Kartu Stok (Cek Barang) - Semua user bisa akses
router.get('/:id/stock-card', authenticate, productController.getStockCard);

module.exports = router;