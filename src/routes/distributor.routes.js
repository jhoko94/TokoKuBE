const express = require('express');
const router = express.Router();
const distributorController = require('../controllers/distributor.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// CRUD Distributors - Hanya ADMIN dan MANAGER untuk create/update/delete
router.get('/', authenticate, distributorController.getAllDistributors);
// Get debt - Hanya ADMIN, MANAGER, dan TESTER
router.get('/debt', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), distributorController.getDistributorsWithDebt);
// Bulk delete - HARUS SEBELUM /:id agar tidak tertangkap sebagai parameter
router.delete('/bulk', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), distributorController.bulkDeleteDistributors);
router.get('/:id', authenticate, distributorController.getDistributor);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), distributorController.createDistributor);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), distributorController.updateDistributor);
router.delete('/:id', authenticate, authorize('ADMIN', 'MANAGER', 'TESTER'), distributorController.deleteDistributor);

// Pay debt - Semua user bisa akses
router.post('/:id/pay-debt', authenticate, distributorController.payDebt);

module.exports = router;

