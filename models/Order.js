const supabase = require('../config/supabase');
const Rating = require('./Rating');

class Order {
  static async create(orderData) {
    const {
      shopId, supplierId, totalAmount, deliveryAddress, deliveryCity,
      estimatedDeliveryDate, paymentMethod, notes, items,
    } = orderData;

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase.from('orders').insert({
      order_number: orderNumber,
      shop_id: shopId,
      supplier_id: supplierId,
      total_amount: totalAmount,
      delivery_address: deliveryAddress || 'Not specified',
      delivery_city: deliveryCity || 'Not specified',
      estimated_delivery_date: estimatedDeliveryDate || null,
      payment_method: paymentMethod || 'COD',
      notes: notes || null,
    }).select().single();

    if (orderError) throw orderError;

    const orderItems = items.map(item => ({
      order_id: order.id,
      catalog_item_id: item.catalogItemId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    return order;
  }

  static async findByShopId(shopId) {
    const { data: orders, error } = await supabase.from('orders')
      .select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
    if (error) throw error;
    if (!orders || orders.length === 0) return [];

    const supplierIds = [...new Set(orders.map(o => o.supplier_id))];
    const [{ data: suppliers }, ratingMap] = await Promise.all([
      supabase.from('suppliers').select('id, company_name').in('id', supplierIds),
      Rating.findForTransactions('SUPPLIER', orders.map(o => o.id)),
    ]);
    const supplierMap = (suppliers || []).reduce((m, s) => { m[s.id] = s; return m; }, {});

    return orders.map(o => ({
      ...o,
      supplier_name: supplierMap[o.supplier_id]?.company_name,
      rating: ratingMap.get(Number(o.id)) || null,
    }));
  }

  static async findByIdWithItems(id) {
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!order) return null;

    const [{ data: items, error: itemsError }, { data: supplier, error: supplierError }] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', id).order('id'),
      supabase.from('suppliers').select('company_name').eq('id', order.supplier_id).maybeSingle(),
    ]);
    if (itemsError) throw itemsError;
    if (supplierError) throw supplierError;
    order.items = items || [];
    order.supplier_name = supplier?.company_name || null;
    const ratingMap = await Rating.findForTransactions('SUPPLIER', [order.id]);
    order.rating = ratingMap.get(Number(order.id)) || null;
    return order;
  }

  static async updatePendingOrder({ orderId, shopId, items, deliveryAddress, deliveryCity, estimatedDeliveryDate, notes }) {
    const { data, error } = await supabase.rpc('update_pending_order', {
      p_order_id: orderId,
      p_shop_id: shopId,
      p_items: items.map(item => ({
        catalog_item_id: item.catalogItemId,
        quantity: item.quantity,
      })),
      p_delivery_address: deliveryAddress,
      p_delivery_city: deliveryCity,
      p_estimated_delivery_date: estimatedDeliveryDate || null,
      p_notes: notes || null,
    });
    if (error) throw error;
    return data;
  }

  static async updateStatus(id, status) {
    const { data, error } = await supabase.from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
}

module.exports = Order;
