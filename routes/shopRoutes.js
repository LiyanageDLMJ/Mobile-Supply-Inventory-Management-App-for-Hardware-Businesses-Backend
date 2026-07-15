const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { protect, authorize, requireVerified } = require('../middleware/auth');

// Authentication + SHOP_OWNER role for every shop route.
router.use(protect);
router.use(authorize('SHOP_OWNER'));

// Profile reads/updates are allowed for unverified shop owners — they need
// these to upload documents and edit their info from the locked dashboard.
router.get('/profile', shopController.getProfile);
router.put('/profile', shopController.updateProfile);
router.put('/location', shopController.updateLocation);

// Everything below this line is a "business action" — requires admin approval.
router.use(requireVerified);

router.get('/dashboard/stats', shopController.getDashboardStats);
router.get('/dashboard', shopController.getDashboard);

// Supplier browsing and B2B ordering
router.get('/suppliers', shopController.getSuppliers);
router.get('/suppliers/:supplierId/catalog', shopController.getSupplierCatalog);
router.post('/orders', shopController.createOrder);
router.get('/orders', shopController.getOrders);
router.get('/orders/:id', shopController.getOrder);
router.put('/orders/:id', shopController.updateOrder);

module.exports = router;
