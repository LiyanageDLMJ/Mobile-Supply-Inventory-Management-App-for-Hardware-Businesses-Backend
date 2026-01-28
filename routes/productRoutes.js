const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and SHOP_OWNER role
router.use(protect);
router.use(authorize('SHOP_OWNER'));

router.get('/', productController.getAllProducts);
router.get('/low-stock', productController.getLowStockProducts);
router.get('/:id', productController.getProduct);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.patch('/:id/quantity', productController.updateQuantity);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
