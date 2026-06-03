const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, authorize, requireVerified } = require('../middleware/auth');

// All routes require authentication, SHOP_OWNER role, AND admin-verified status.
// (An unverified shop owner cannot read/write inventory at all — the locked
// dashboard surfaces the verification prompt instead.)
router.use(protect);
router.use(authorize('SHOP_OWNER'));
router.use(requireVerified);

router.get('/', productController.getAllProducts);
router.get('/low-stock', productController.getLowStockProducts);
router.get('/:id', productController.getProduct);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.patch('/:id/quantity', productController.updateQuantity);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
