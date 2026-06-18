const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('CUSTOMER'));

router.get('/products/search', customerController.searchProducts);
router.get('/products/browse', customerController.browseProducts);
router.get('/shops/nearby', customerController.getNearbyShops);
router.get('/shops', customerController.getShops);
router.get('/shops/:shopId/products', customerController.getShopProducts);
router.post('/reservations', customerController.createReservation);
router.get('/reservations', customerController.getMyReservations);
router.delete('/reservations/:id', customerController.cancelReservation);
router.get('/loyalty', customerController.getLoyalty);

module.exports = router;
