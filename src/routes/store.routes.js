const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Public route - untuk mendapatkan nama toko (untuk login page)
router.get('/name', storeController.getStoreName);

// Protected routes - hanya user yang sudah login yang bisa akses
router.get('/', authenticate, storeController.getStore);
// Update store - Hanya ADMIN dan MANAGER
router.put('/', authenticate, authorize('ADMIN', 'MANAGER'), storeController.updateStore);

module.exports = router;

