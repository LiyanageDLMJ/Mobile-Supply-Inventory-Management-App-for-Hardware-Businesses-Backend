const Reservation = require('../models/Reservation');
const Shop = require('../models/Shop');
const Product = require('../models/Product');

// @desc    Get all reservations for shop
// @route   GET /api/reservations
// @access  Private (Shop Owner)
exports.getReservations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const shop = await Shop.findByOwnerId(userId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    const reservations = await Reservation.findByShopId(shop.id, status);

    res.json({
      success: true,
      data: reservations,
    });
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Accept reservation
// @route   POST /api/reservations/:id/accept
// @access  Private (Shop Owner)
exports.acceptReservation = async (req, res) => {
  try {
    const reservationId = req.params.id;
    const { shopNotes } = req.body;

    const reservation = await Reservation.accept(reservationId, shopNotes);

    // Optionally reduce product quantity
    // await Product.updateQuantity(reservation.product_id, reservation.quantity, 'subtract');

    res.json({
      success: true,
      message: 'Reservation accepted',
      data: reservation,
    });
  } catch (error) {
    console.error('Accept reservation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Reject reservation
// @route   POST /api/reservations/:id/reject
// @access  Private (Shop Owner)
exports.rejectReservation = async (req, res) => {
  try {
    const reservationId = req.params.id;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const reservation = await Reservation.reject(reservationId, rejectionReason);

    res.json({
      success: true,
      message: 'Reservation rejected',
      data: reservation,
    });
  } catch (error) {
    console.error('Reject reservation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Complete reservation (item picked up)
// @route   POST /api/reservations/:id/complete
// @access  Private (Shop Owner)
exports.completeReservation = async (req, res) => {
  try {
    const reservationId = req.params.id;

    const reservation = await Reservation.complete(reservationId);

    // Reduce product quantity
    await Product.updateQuantity(reservation.product_id, reservation.quantity, 'subtract');

    res.json({
      success: true,
      message: 'Reservation completed',
      data: reservation,
    });
  } catch (error) {
    console.error('Complete reservation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

module.exports = exports;
