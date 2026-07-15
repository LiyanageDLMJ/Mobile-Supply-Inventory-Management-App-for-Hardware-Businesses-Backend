const supabase = require('../config/supabase');
const Shop = require('../models/Shop');
const Supplier = require('../models/Supplier');
const Rating = require('../models/Rating');
const Notification = require('../models/Notification');
const { validateRatingPayload, canRateReservation, canRateOrder } = require('../utils/ratingPolicy');

exports.createRating = async (req, res) => {
  try {
    const validation = validateRatingPayload(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const transactionType = String(req.body.transactionType || '').toUpperCase();
    const transactionId = Number(req.body.transactionId);
    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid transactionId is required' });
    }

    let insertData;
    if (req.user.role === 'CUSTOMER' && transactionType === 'RESERVATION') {
      const { data: reservation, error } = await supabase.from('reservations')
        .select('id, customer_id, shop_id, status')
        .eq('id', transactionId)
        .eq('customer_id', req.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found' });
      if (!canRateReservation(req.user.id, reservation)) {
        return res.status(409).json({ success: false, message: 'A shop can be rated only after the reservation is completed' });
      }
      insertData = {
        reviewer_id: req.user.id,
        target_type: 'SHOP',
        shop_id: reservation.shop_id,
        reservation_id: reservation.id,
        stars: validation.stars,
        comment: validation.comment,
      };
    } else if (req.user.role === 'SHOP_OWNER' && transactionType === 'ORDER') {
      const shop = await Shop.findByOwnerId(req.user.id);
      if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
      const { data: order, error } = await supabase.from('orders')
        .select('id, shop_id, supplier_id, status')
        .eq('id', transactionId)
        .eq('shop_id', shop.id)
        .maybeSingle();
      if (error) throw error;
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      if (!canRateOrder(shop.id, order)) {
        return res.status(409).json({ success: false, message: 'A supplier can be rated only after the order is delivered' });
      }
      insertData = {
        reviewer_id: req.user.id,
        target_type: 'SUPPLIER',
        supplier_id: order.supplier_id,
        order_id: order.id,
        stars: validation.stars,
        comment: validation.comment,
      };
    } else {
      return res.status(403).json({
        success: false,
        message: 'Customers rate completed reservations; shop owners rate delivered supplier orders',
      });
    }

    const rating = await Rating.create(insertData);

    const targetLookup = insertData.target_type === 'SHOP'
      ? await supabase.from('shops').select('owner_id').eq('id', insertData.shop_id).maybeSingle()
      : await supabase.from('suppliers').select('user_id').eq('id', insertData.supplier_id).maybeSingle();
    const targetUserId = insertData.target_type === 'SHOP'
      ? targetLookup.data?.owner_id
      : targetLookup.data?.user_id;
    if (targetUserId) {
      Notification.create({
        userId: targetUserId,
        type: 'NEW_RATING',
        title: 'New verified rating',
        message: `Your business received a ${rating.stars}-star rating from a completed transaction.`,
      }).catch(err => console.error('Rating notification failed:', err.message));
    }

    res.status(201).json({ success: true, message: 'Rating submitted successfully', data: rating });
  } catch (error) {
    console.error('Create rating error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'This transaction has already been rated' });
    }
    if (error.code === '42P01') {
      return res.status(503).json({ success: false, message: 'Rating system is not configured. Run scripts/ratings_migration.sql in Supabase.' });
    }
    if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
      return res.status(503).json({
        success: false,
        message: 'Rating service configuration is incomplete. Ask the administrator to configure the backend Supabase server key.',
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

exports.updateRating = async (req, res) => {
  try {
    const validation = validateRatingPayload(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    const existing = await Rating.findById(req.params.id);
    if (!existing || Number(existing.reviewer_id) !== Number(req.user.id)) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }
    if (existing.is_hidden) {
      return res.status(409).json({ success: false, message: 'This rating is under administrator moderation and cannot be edited' });
    }
    const rating = await Rating.update(existing.id, req.user.id, validation.stars, validation.comment);
    res.json({ success: true, message: 'Rating updated successfully', data: rating });
  } catch (error) {
    console.error('Update rating error:', error);
    if (error.code === '42501') {
      return res.status(503).json({
        success: false,
        message: 'Rating service configuration is incomplete. Ask the administrator to configure the backend Supabase server key.',
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

async function publicRatings(req, res, targetType) {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid target id' });
    }
    const summaryMap = await Rating.getSummaryMap(targetType, [targetId]);
    const reviews = await Rating.getPublicReviews(targetType, targetId);
    res.json({
      success: true,
      data: { ...(summaryMap.get(targetId) || { rating_average: null, rating_count: 0 }), reviews },
    });
  } catch (error) {
    console.error('Get public ratings error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
}

exports.getShopRatings = (req, res) => publicRatings(req, res, 'SHOP');
exports.getSupplierRatings = (req, res) => publicRatings(req, res, 'SUPPLIER');

exports.getMySupplierRatings = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });
    const feedback = await Rating.getBusinessFeedback('SUPPLIER', supplier.id);
    res.json({ success: true, data: { supplier: { id: supplier.id, company_name: supplier.company_name }, ...feedback } });
  } catch (error) {
    console.error('Get supplier feedback error:', error);
    if (error.code === 'RATINGS_MIGRATION_REQUIRED') {
      return res.status(503).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};
