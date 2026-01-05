const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// (GET /api/products) - Ambil semua produk (Semua user bisa akses untuk melihat)
router.get('/', authenticate, productController.getAllProducts);

// (GET /api/products/search-by-name) - Cari product by exact name match
router.get('/search-by-name', authenticate, productController.getProductByName);

// (POST /api/products) - Buat produk baru (Master Barang) - Hanya ADMIN, MANAGER, dan TESTER
router.post('/', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.createProduct);

// (POST /api/products/import) - Import produk dari template - Hanya ADMIN, MANAGER, dan TESTER
router.post('/import', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.importProducts);

// (PUT /api/products/bulk-update-distributor) - Bulk update distributor - Hanya ADMIN, MANAGER, dan TESTER
router.put('/bulk-update-distributor', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.bulkUpdateDistributor);

// (PUT /api/products/bulk-update-unit) - Bulk update satuan kecil/besar - Hanya ADMIN, MANAGER, dan TESTER
router.put('/bulk-update-unit', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.bulkUpdateUnit);

// (PUT /api/products/bulk-update-minstock) - Bulk update minimal stok - Hanya ADMIN, MANAGER, dan TESTER
router.put('/bulk-update-minstock', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.bulkUpdateMinStock);

// (DELETE /api/products/bulk) - Bulk delete products - HARUS SEBELUM /:id agar tidak tertangkap sebagai parameter
router.delete('/bulk', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.bulkDeleteProducts);

// (PUT /api/products/:id) - Update produk (Master Barang) - Hanya ADMIN, MANAGER, TESTER, dan KASIR
router.put('/:id', authenticate, authorize('ADMIN', 'KASIR', 'MANAGER', 'PROG', 'TESTER'), productController.updateProduct);

// (DELETE /api/products/:id) - Hapus produk (Master Barang) - Hanya ADMIN, MANAGER, dan TESTER
router.delete('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.deleteProduct);

// (GET /api/products/by-barcode/:barcode) - Scan Barcode - Semua user bisa akses
router.get('/by-barcode/:barcode', authenticate, productController.getProductByBarcode);

// (GET /api/products/suggestions) - Saran PO (Pesan Barang) - Hanya ADMIN, MANAGER, dan TESTER
router.get('/suggestions', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.getPOSuggestions);

// (POST /api/products/:id/add-stock) - Tambah Stok (Cek Barang) - Hanya ADMIN, MANAGER, dan TESTER
router.post('/:id/add-stock', authenticate, authorize('ADMIN', 'MANAGER', 'PROG', 'TESTER'), productController.addStock);

// (GET /api/products/:id/stock-card) - Kartu Stok (Cek Barang) - Semua user bisa akses
router.get('/:id/stock-card', authenticate, productController.getStockCard);

module.exports = router;