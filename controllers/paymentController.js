const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const Shop = require('../models/Shop');
const Notification = require('../models/Notification');

// @desc    Create a Stripe PaymentIntent for a B2B order
// @route   POST /api/payments/create-intent
// @access  Private (Shop Owner)
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const { data: order, error } = await supabase.from('orders')
      .select('*, suppliers!supplier_id(company_name)')
      .eq('id', orderId).eq('shop_id', shop.id).maybeSingle();
    if (error) throw error;
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.payment_status === 'Paid') {
      return res.status(400).json({ success: false, message: 'This order has already been paid' });
    }

    const amountInCents = Math.round(parseFloat(order.total_amount) * 100);
    const supplierName = order.suppliers?.company_name || 'Supplier';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'lkr',
      metadata: {
        orderId: order.id.toString(),
        orderNumber: order.order_number,
        shopId: shop.id.toString(),
      },
      description: `B2B Order ${order.order_number} — ${supplierName}`,
    });

    await supabase.from('orders')
      .update({ payment_intent_id: paymentIntent.id, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: order.total_amount,
      orderNumber: order.order_number,
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Confirm payment after Stripe frontend confirmation
// @route   POST /api/payments/confirm
// @access  Private (Shop Owner)
exports.confirmPayment = async (req, res) => {
  try {
    const { orderId, paymentIntentId } = req.body;
    if (!orderId || !paymentIntentId) {
      return res.status(400).json({ success: false, message: 'orderId and paymentIntentId are required' });
    }

    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const { data: existingOrder, error: orderError } = await supabase.from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('shop_id', shop.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!existingOrder) return res.status(404).json({ success: false, message: 'Order not found' });

    if (existingOrder.payment_status === 'Paid') {
      return res.status(400).json({ success: false, message: 'This order has already been paid' });
    }

    if (existingOrder.payment_intent_id !== paymentIntentId) {
      return res.status(400).json({ success: false, message: 'Payment intent does not match this order' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ success: false, message: `Payment not completed. Status: ${paymentIntent.status}` });
    }

    if (
      paymentIntent.metadata?.orderId !== String(existingOrder.id) ||
      paymentIntent.metadata?.shopId !== String(shop.id)
    ) {
      return res.status(400).json({ success: false, message: 'Payment metadata does not match this order' });
    }

    const expectedAmount = Math.round(parseFloat(existingOrder.total_amount) * 100);
    if (paymentIntent.amount !== expectedAmount || paymentIntent.currency.toLowerCase() !== 'lkr') {
      return res.status(400).json({ success: false, message: 'Payment amount or currency does not match this order' });
    }

    const { data: order, error: updateError } = await supabase.from('orders')
      .update({ payment_status: 'Paid', status: 'Confirmed', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('shop_id', shop.id)
      .select()
      .single();
    if (updateError) throw updateError;

    // Record payment (ignore conflict if duplicate)
    await supabase.from('payments').upsert({
      order_id: orderId,
      payment_intent_id: paymentIntentId,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      status: 'Completed',
    }, { onConflict: 'payment_intent_id' });

    // Notify the shop owner of successful payment
    const { data: shopRow } = await supabase.from('shops').select('owner_id, shop_name').eq('id', order.shop_id).maybeSingle();
    if (shopRow) {
      Notification.create({
        userId: shopRow.owner_id,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Confirmed',
        message: `Payment for order ${order.order_number} (LKR ${parseFloat(order.total_amount).toLocaleString()}) was successful. Order is now active.`,
      }).catch(err => console.error('Notification create failed:', err.message));
    }

    res.json({ success: true, message: 'Payment confirmed. Order is now active.', data: order });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get payment history for shop
// @route   GET /api/payments/history
// @access  Private (Shop Owner)
exports.getPaymentHistory = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const { data: orders, error } = await supabase.from('orders')
      .select('id, order_number, total_amount, payment_status, payment_method, created_at, supplier_id')
      .eq('shop_id', shop.id).eq('payment_status', 'Paid').order('updated_at', { ascending: false });
    if (error) throw error;
    if (!orders || orders.length === 0) return res.json({ success: true, data: [] });

    const supplierIds = [...new Set(orders.map(o => o.supplier_id))];
    const { data: suppliers } = await supabase.from('suppliers').select('id, company_name').in('id', supplierIds);
    const supplierMap = (suppliers || []).reduce((m, s) => { m[s.id] = s; return m; }, {});

    const result = orders.map(o => ({
      order_id:      o.id,
      order_number:  o.order_number,
      total_amount:  o.total_amount,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      created_at:    o.created_at,
      supplier_name: supplierMap[o.supplier_id]?.company_name,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = exports;
