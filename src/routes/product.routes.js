const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// (GET /api/products) - Ambil semua produk
router.get('/', productController.getAllProducts);

// (POST /api/products) - Buat produk baru (Master Barang)
router.post('/', productController.createProduct);

// (PUT /api/products/:id) - Update produk (Master Barang)
router.put('/:id', productController.updateProduct);

// (DELETE /api/products/:id) - Hapus produk (Master Barang)
router.delete('/:id', productController.deleteProduct);

// (GET /api/products/suggestions) - Saran PO (Pesan Barang)
router.get('/suggestions', productController.getPOSuggestions);

// (POST /api/products/:id/add-stock) - Tambah Stok (Cek Barang)
router.post('/:id/add-stock', productController.addStock);

// (GET /api/products/:id/stock-card) - Kartu Stok (Cek Barang)
router.get('/:id/stock-card', productController.getStockCard);

module.exports = router;