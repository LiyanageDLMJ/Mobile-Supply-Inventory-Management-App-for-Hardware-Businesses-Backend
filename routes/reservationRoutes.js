const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and SHOP_OWNER role
router.use(protect);
router.use(authorize('SHOP_OWNER'));

router.get('/', reservationController.getReservations);
router.post('/:id/accept', reservationController.acceptReservation);
router.post('/:id/reject', reservationController.rejectReservation);
router.post('/:id/complete', reservationController.completeReservation);

module.exports = router;
