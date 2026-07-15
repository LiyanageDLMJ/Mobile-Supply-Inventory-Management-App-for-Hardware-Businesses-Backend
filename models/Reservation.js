const supabase = require('../config/supabase');
const Rating = require('./Rating');

class Reservation {
  static async create(data) {
    const {
      customerId, shopId, productId, quantity, unitPrice,
      totalAmount, pickupDate, pickupTime, customerNotes,
    } = data;

    const reservationNumber = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const { data: reservation, error } = await supabase.from('reservations').insert({
      reservation_number: reservationNumber,
      customer_id: customerId,
      shop_id: shopId,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      pickup_date: pickupDate || null,
      pickup_time: pickupTime || null,
      customer_notes: customerNotes || null,
    }).select().single();

    if (error) throw error;
    return reservation;
  }

  static async findByShopId(shopId, status) {
    let query = supabase.from('reservations').select('*').eq('shop_id', shopId);
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false });

    const { data: reservations, error } = await query;
    if (error) throw error;
    if (!reservations || reservations.length === 0) return [];

    // Fetch customer and product details
    const customerIds = [...new Set(reservations.map(r => r.customer_id))];
    const productIds  = [...new Set(reservations.map(r => r.product_id))];

    const [{ data: customers }, { data: products }] = await Promise.all([
      supabase.from('users').select('id, first_name, last_name, email, phone').in('id', customerIds),
      supabase.from('products').select('id, product_name, unit_of_measure, image_url').in('id', productIds),
    ]);

    const customerMap = (customers || []).reduce((m, c) => { m[c.id] = c; return m; }, {});
    const productMap  = (products  || []).reduce((m, p) => { m[p.id] = p; return m; }, {});

    return reservations.map(r => ({
      ...r,
      first_name:      customerMap[r.customer_id]?.first_name,
      last_name:       customerMap[r.customer_id]?.last_name,
      customer_email:  customerMap[r.customer_id]?.email,
      customer_phone:  customerMap[r.customer_id]?.phone,
      product_name:    productMap[r.product_id]?.product_name,
      unit_of_measure: productMap[r.product_id]?.unit_of_measure,
      image_url:       productMap[r.product_id]?.image_url,
    }));
  }

  static async findByCustomerId(customerId) {
    const { data: reservations, error } = await supabase.from('reservations')
      .select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
    if (error) throw error;
    if (!reservations || reservations.length === 0) return [];

    const shopIds    = [...new Set(reservations.map(r => r.shop_id))];
    const productIds = [...new Set(reservations.map(r => r.product_id))];

    const [{ data: shops }, { data: products }, ratingMap] = await Promise.all([
      supabase.from('shops').select('id, shop_name, city, address, phone').in('id', shopIds),
      supabase.from('products').select('id, product_name, unit_of_measure, image_url').in('id', productIds),
      Rating.findForTransactions('SHOP', reservations.map(r => r.id)),
    ]);

    const shopMap    = (shops    || []).reduce((m, s) => { m[s.id] = s; return m; }, {});
    const productMap = (products || []).reduce((m, p) => { m[p.id] = p; return m; }, {});

    return reservations.map(r => ({
      ...r,
      shop_name:       shopMap[r.shop_id]?.shop_name,
      shop_city:       shopMap[r.shop_id]?.city,
      shop_address:    shopMap[r.shop_id]?.address,
      shop_phone:      shopMap[r.shop_id]?.phone,
      product_name:    productMap[r.product_id]?.product_name,
      unit_of_measure: productMap[r.product_id]?.unit_of_measure,
      image_url:       productMap[r.product_id]?.image_url,
      rating:          ratingMap.get(Number(r.id)) || null,
    }));
  }

  static async accept(id, shopNotes) {
    const { data, error } = await supabase.from('reservations')
      .update({ status: 'Accepted', shop_notes: shopNotes || null, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  static async reject(id, rejectionReason) {
    const { data, error } = await supabase.from('reservations')
      .update({ status: 'Rejected', rejection_reason: rejectionReason, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  static async complete(id) {
    const { data, error } = await supabase.from('reservations')
      .update({ status: 'Completed', updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
}

module.exports = Reservation;
