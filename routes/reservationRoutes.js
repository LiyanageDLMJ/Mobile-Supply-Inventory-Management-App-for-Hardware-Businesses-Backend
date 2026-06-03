const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { protect, authorize, requireVerified } = require('../middleware/auth');

// Shop-owner reservation actions are business operations — admin must verify first.
router.use(protect);
router.use(authorize('SHOP_OWNER'));
router.use(requireVerified);

router.get('/', reservationController.getReservations);
router.post('/:id/accept', reservationController.acceptReservation);
router.post('/:id/reject', reservationController.rejectReservation);
router.post('/:id/complete', reservationController.completeReservation);

module.exports = router;
