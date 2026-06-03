const supabase = require('../config/supabase');

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
    const { data: suppliers } = await supabase.from('suppliers')
      .select('id, company_name').in('id', supplierIds);
    const supplierMap = (suppliers || []).reduce((m, s) => { m[s.id] = s; return m; }, {});

    return orders.map(o => ({ ...o, supplier_name: supplierMap[o.supplier_id]?.company_name }));
  }

  static async findByIdWithItems(id) {
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!order) return null;

    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', id);
    order.items = items || [];
    return order;
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
