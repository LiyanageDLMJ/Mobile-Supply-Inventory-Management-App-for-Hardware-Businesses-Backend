const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { protect, authorize, requireVerified } = require('../middleware/auth');

router.use(protect);

router.get('/shops/:id', ratingController.getShopRatings);
router.get('/suppliers/me', authorize('SUPPLIER'), requireVerified, ratingController.getMySupplierRatings);
router.get('/suppliers/:id', ratingController.getSupplierRatings);
router.post('/', authorize('CUSTOMER', 'SHOP_OWNER'), requireVerified, ratingController.createRating);
router.put('/:id', authorize('CUSTOMER', 'SHOP_OWNER'), requireVerified, ratingController.updateRating);

module.exports = router;
