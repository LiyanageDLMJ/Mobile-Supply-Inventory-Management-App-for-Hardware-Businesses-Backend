const supabase = require('../config/supabase');

class Product {
  static async create(productData) {
    const {
      shopId, productName, description, category, subCategory,
      unitPrice, costPrice, quantityOnHand, unitOfMeasure, sku,
      barcode, lowStockThreshold, imageUrl,
    } = productData;

    const { data, error } = await supabase.from('products').insert({
      shop_id: shopId,
      product_name: productName,
      description: description || null,
      category,
      sub_category: subCategory || null,
      unit_price: unitPrice,
      cost_price: costPrice || null,
      quantity_on_hand: quantityOnHand || 0,
      unit_of_measure: unitOfMeasure || 'pcs',
      sku: sku || null,
      barcode: barcode || null,
      low_stock_threshold: lowStockThreshold || 10,
      image_url: imageUrl || null,
    }).select().single();

    if (error) throw error;
    return data;
  }

  static async findByShopId(shopId) {
    const { data, error } = await supabase.from('products')
      .select('*').eq('shop_id', shopId).order('category').order('product_name');
    if (error) throw error;
    return data || [];
  }

  static async getLowStockItems(shopId) {
    const { data, error } = await supabase.from('products').select('*').eq('shop_id', shopId);
    if (error) throw error;
    return (data || []).filter(p => p.quantity_on_hand <= p.low_stock_threshold);
  }

  static async findById(id) {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async update(id, updates) {
    const updateData = { updated_at: new Date().toISOString() };
    const fields = [
      'product_name', 'description', 'category', 'sub_category',
      'unit_price', 'cost_price', 'quantity_on_hand', 'unit_of_measure',
      'sku', 'barcode', 'low_stock_threshold', 'image_url',
    ];
    for (const f of fields) {
      if (updates[f] !== undefined && updates[f] !== null) updateData[f] = updates[f];
    }

    const { data, error } = await supabase.from('products').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  static async updateQuantity(productId, amount, operation = 'set') {
    const { data: current, error: fetchError } = await supabase.from('products')
      .select('quantity_on_hand').eq('id', productId).single();
    if (fetchError) throw fetchError;

    let newQty = current.quantity_on_hand;
    if (operation === 'add') newQty += Number(amount);
    else if (operation === 'subtract') newQty = Math.max(0, newQty - Number(amount));
    else newQty = Number(amount);

    const { data, error } = await supabase.from('products')
      .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
      .eq('id', productId).select().single();
    if (error) throw error;
    // Expose the pre-change quantity so callers can apply a crossing-guard
    // (only alert when stock first drops to/below the threshold).
    return { ...data, previous_quantity: current.quantity_on_hand };
  }

  static async delete(id) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

module.exports = Product;
