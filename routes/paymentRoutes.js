const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, authorize, requireVerified } = require('../middleware/auth');

router.use(protect);
router.use(authorize('SHOP_OWNER'));
router.use(requireVerified);

router.post('/create-intent', paymentController.createPaymentIntent);
router.post('/confirm', paymentController.confirmPayment);
router.get('/history', paymentController.getPaymentHistory);

module.exports = router;
