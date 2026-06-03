const Reservation = require('../models/Reservation');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const supabase = require('../config/supabase');

// @desc    Get all reservations for shop
// @route   GET /api/reservations
// @access  Private (Shop Owner)
exports.getReservations = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const reservations = await Reservation.findByShopId(shop.id, req.query.status);
    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Accept reservation
// @route   POST /api/reservations/:id/accept
// @access  Private (Shop Owner)
exports.acceptReservation = async (req, res) => {
  try {
    const reservation = await Reservation.accept(req.params.id, req.body.shopNotes);

    Notification.create({
      userId: reservation.customer_id,
      type: 'RESERVATION_ACCEPTED',
      title: 'Reservation Accepted',
      message: `Your reservation ${reservation.reservation_number} has been accepted. Please pick up by the scheduled time.`,
    }).catch(err => console.error('Notification create failed:', err.message));

    res.json({ success: true, message: 'Reservation accepted', data: reservation });
  } catch (error) {
    console.error('Accept reservation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Reject reservation
// @route   POST /api/reservations/:id/reject
// @access  Private (Shop Owner)
exports.rejectReservation = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });

    const reservation = await Reservation.reject(req.params.id, rejectionReason);

    Notification.create({
      userId: reservation.customer_id,
      type: 'RESERVATION_REJECTED',
      title: 'Reservation Rejected',
      message: `Your reservation ${reservation.reservation_number} was rejected. Reason: ${rejectionReason}`,
    }).catch(err => console.error('Notification create failed:', err.message));

    res.json({ success: true, message: 'Reservation rejected', data: reservation });
  } catch (error) {
    console.error('Reject reservation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Complete reservation (item picked up)
// @route   POST /api/reservations/:id/complete
// @access  Private (Shop Owner)
exports.completeReservation = async (req, res) => {
  try {
    const reservation = await Reservation.complete(req.params.id);

    // Deduct product stock
    await Product.updateQuantity(reservation.product_id, reservation.quantity, 'subtract');

    // Award loyalty points: 1 point per LKR 100
    const points = Math.floor(parseFloat(reservation.total_amount) / 100);
    if (points > 0) {
      const { data: currentUser } = await supabase.from('users')
        .select('loyalty_points').eq('id', reservation.customer_id).single();
      const newPoints = (currentUser?.loyalty_points || 0) + points;
      const newTier =
        newPoints >= 5000 ? 'Platinum' :
        newPoints >= 2000 ? 'Gold' :
        newPoints >= 500  ? 'Silver' : 'Bronze';
      await supabase.from('users')
        .update({ loyalty_points: newPoints, loyalty_tier: newTier })
        .eq('id', reservation.customer_id);
    }

    Notification.create({
      userId: reservation.customer_id,
      type: 'RESERVATION_COMPLETED',
      title: 'Pickup Complete',
      message: `Your reservation ${reservation.reservation_number} is complete.${points > 0 ? ` You earned ${points} loyalty points!` : ''}`,
    }).catch(err => console.error('Notification create failed:', err.message));

    res.json({ success: true, message: 'Reservation completed', data: reservation });
  } catch (error) {
    console.error('Complete reservation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = exports;
