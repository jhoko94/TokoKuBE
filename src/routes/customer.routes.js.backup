const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// CRUD Customers - Hanya ADMIN dan MANAGER untuk create/update/delete
router.get('/', authenticate, customerController.getAllCustomers);
// Route spesifik harus didefinisikan SEBELUM route dengan parameter
router.get('/debt', authenticate, customerController.getCustomersWithDebt); // Harus sebelum /:id
router.get('/:id', authenticate, customerController.getCustomer);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), customerController.createCustomer);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), customerController.updateCustomer);
router.delete('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), customerController.deleteCustomer);

// Route dengan parameter spesifik (harus sebelum route generic /:id jika menggunakan method yang sama)
// (GET /api/customers/email-quota) - Get email quota status - Hanya ADMIN, MANAGER, dan TESTER
router.get('/email-quota', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), customerController.getEmailQuota);

// (POST /api/customers/bulk-send-email) - Bulk send email - Hanya ADMIN, MANAGER, dan TESTER
router.post('/bulk-send-email', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), customerController.bulkSendEmail);

// (POST /api/customers/:id/pay-debt) - Bayar Utang (Catatan Utang) - Semua user bisa akses
router.post('/:id/pay-debt', authenticate, customerController.payDebt);

// (POST /api/customers/:id/send-email) - Kirim Email ke Pelanggan - Hanya ADMIN, MANAGER, dan TESTER
router.post('/:id/send-email', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), customerController.sendEmail);

// (POST /api/customers/:id/send-whatsapp) - Kirim WhatsApp ke Pelanggan - Hanya ADMIN, MANAGER, dan TESTER
router.post('/:id/send-whatsapp', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), customerController.sendWhatsApp);

// (POST /api/customers/bulk-send-whatsapp) - Bulk send WhatsApp - Hanya ADMIN, MANAGER, dan TESTER
router.post('/bulk-send-whatsapp', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), customerController.bulkSendWhatsApp);

module.exports = router;