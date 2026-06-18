const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { protect, authorize, requireVerified } = require('../middleware/auth');

router.use(protect);
router.use(authorize('SUPPLIER'));

// Profile reads/updates work pre-verification — needed so the supplier can
// still upload docs and edit their info from the locked dashboard.
router.get('/profile', supplierController.getProfile);
router.put('/location', supplierController.updateLocation);

// Everything below is a business action — admin must have approved them.
router.use(requireVerified);

router.get('/dashboard', supplierController.getDashboard);
router.get('/catalog', supplierController.getCatalog);
router.post('/catalog', supplierController.addCatalogItem);
router.put('/catalog/:id', supplierController.updateCatalogItem);
router.delete('/catalog/:id', supplierController.deleteCatalogItem);
router.get('/orders', supplierController.getOrders);
router.patch('/orders/:id/status', supplierController.updateOrderStatus);

module.exports = router;
