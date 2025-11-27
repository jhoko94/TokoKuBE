const express = require('express');
const router = express.Router();
const distributorController = require('../controllers/distributor.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// CRUD Distributors - Hanya ADMIN dan MANAGER untuk create/update/delete
router.get('/', authenticate, distributorController.getAllDistributors);
// Get debt - Hanya ADMIN dan MANAGER
router.get('/debt', authenticate, authorize('ADMIN', 'MANAGER'), distributorController.getDistributorsWithDebt);
router.get('/:id', authenticate, distributorController.getDistributor);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), distributorController.createDistributor);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), distributorController.updateDistributor);
router.delete('/:id', authenticate, authorize('ADMIN', 'MANAGER'), distributorController.deleteDistributor);

// Pay debt - Semua user bisa akses
router.post('/:id/pay-debt', authenticate, distributorController.payDebt);

module.exports = router;

