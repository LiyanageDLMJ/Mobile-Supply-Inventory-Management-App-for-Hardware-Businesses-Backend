const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const { validateCoordinates } = require('../utils/geolocation');
const supabase = require('../config/supabase');
const { maybeNotifyLowStock } = require('../utils/stockAlert');

// @desc    Get supplier profile
// @route   GET /api/supplier/profile
// @access  Private (Supplier)
exports.getProfile = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });
    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error('Get supplier profile error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get supplier's own catalog
// @route   GET /api/supplier/catalog
// @access  Private (Supplier)
exports.getCatalog = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });

    const { data, error } = await supabase.from('supplier_catalog')
      .select('*').eq('supplier_id', supplier.id).order('category').order('product_name');
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Get catalog error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Add item to supplier catalog
// @route   POST /api/supplier/catalog
// @access  Private (Supplier)
exports.addCatalogItem = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });

    const {
      productName, description, category, subCategory,
      wholesalePrice, minimumOrderQuantity, unitOfMeasure,
      stockAvailable, lowStockThreshold, sku, manufacturer, imageUrl,
    } = req.body;

    if (!productName || !category || wholesalePrice === undefined) {
      return res.status(400).json({ success: false, message: 'productName, category, and wholesalePrice are required' });
    }
    const price = parseFloat(wholesalePrice);
    if (isNaN(price) || price <= 0) return res.status(400).json({ success: false, message: 'Wholesale price must be a positive number' });
    const stock = parseInt(stockAvailable) || 0;
    if (stock < 0) return res.status(400).json({ success: false, message: 'Stock available cannot be negative' });
    const threshold = lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : 10;

    const { data, error } = await supabase.from('supplier_catalog').insert({
      supplier_id: supplier.id,
      product_name: productName,
      description: description || null,
      category,
      sub_category: subCategory || null,
      wholesale_price: price,
      minimum_order_quantity: minimumOrderQuantity || 1,
      unit_of_measure: unitOfMeasure || 'pcs',
      stock_available: stock,
      low_stock_threshold: threshold,
      sku: sku || null,
      manufacturer: manufacturer || null,
      image_url: imageUrl || null,
    }).select().single();
    if (error) throw error;

    // Warn if added already at/below threshold.
    await maybeNotifyLowStock({
      userId: req.user.id,
      productName: data.product_name,
      newQty: data.stock_available,
      threshold: data.low_stock_threshold,
      isSupplier: true,
    });

    res.status(201).json({ success: true, message: 'Catalog item added', data });
  } catch (error) {
    console.error('Add catalog item error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update catalog item
// @route   PUT /api/supplier/catalog/:id
// @access  Private (Supplier)
exports.updateCatalogItem = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });

    const { data: existing, error: checkError } = await supabase.from('supplier_catalog')
      .select('id, stock_available').eq('id', req.params.id).eq('supplier_id', supplier.id).maybeSingle();
    if (checkError) throw checkError;
    if (!existing) return res.status(404).json({ success: false, message: 'Catalog item not found' });

    const {
      productName, description, category, subCategory,
      wholesalePrice, minimumOrderQuantity, unitOfMeasure,
      stockAvailable, lowStockThreshold, sku, manufacturer, imageUrl, isActive,
    } = req.body;

    if (wholesalePrice !== undefined) {
      const price = parseFloat(wholesalePrice);
      if (isNaN(price) || price <= 0) return res.status(400).json({ success: false, message: 'Wholesale price must be a positive number' });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (productName !== undefined)         updateData.product_name          = productName;
    if (description !== undefined)         updateData.description           = description;
    if (category !== undefined)            updateData.category              = category;
    if (subCategory !== undefined)         updateData.sub_category          = subCategory;
    if (wholesalePrice !== undefined)      updateData.wholesale_price       = parseFloat(wholesalePrice);
    if (minimumOrderQuantity !== undefined) updateData.minimum_order_quantity = minimumOrderQuantity;
    if (unitOfMeasure !== undefined)       updateData.unit_of_measure       = unitOfMeasure;
    if (stockAvailable !== undefined)      updateData.stock_available       = parseInt(stockAvailable);
    if (lowStockThreshold !== undefined)   updateData.low_stock_threshold   = parseInt(lowStockThreshold);
    if (sku !== undefined)                 updateData.sku                   = sku;
    if (manufacturer !== undefined)        updateData.manufacturer          = manufacturer;
    if (imageUrl !== undefined)            updateData.image_url             = imageUrl;
    if (isActive !== undefined)            updateData.is_active             = isActive;

    const { data, error } = await supabase.from('supplier_catalog').update(updateData).eq('id', req.params.id).select().single();
    if (error) throw error;

    // Editing stock/threshold can cross the low-stock line — alert once.
    await maybeNotifyLowStock({
      userId: req.user.id,
      productName: data.product_name,
      newQty: data.stock_available,
      threshold: data.low_stock_threshold,
      prevQty: existing.stock_available,
      isSupplier: true,
    });

    res.json({ success: true, message: 'Catalog item updated', data });
  } catch (error) {
    console.error('Update catalog item error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Delete (deactivate) catalog item
// @route   DELETE /api/supplier/catalog/:id
// @access  Private (Supplier)
exports.deleteCatalogItem = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });

    const { data: existing, error: checkError } = await supabase.from('supplier_catalog')
      .select('id').eq('id', req.params.id).eq('supplier_id', supplier.id).maybeSingle();
    if (checkError) throw checkError;
    if (!existing) return res.status(404).json({ success: false, message: 'Catalog item not found' });

    const { error } = await supabase.from('supplier_catalog')
      .update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Catalog item removed' });
  } catch (error) {
    console.error('Delete catalog item error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get all incoming B2B orders for supplier
// @route   GET /api/supplier/orders
// @access  Private (Supplier)
exports.getOrders = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });

    const { status } = req.query;
    let query = supabase.from('orders').select('*').eq('supplier_id', supplier.id).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data: orders, error } = await query;
    if (error) throw error;
    if (!orders || orders.length === 0) return res.json({ success: true, data: [] });

    const shopIds = [...new Set(orders.map(o => o.shop_id))];
    const { data: shops } = await supabase.from('shops').select('id, shop_name, city, phone').in('id', shopIds);
    const shopMap = (shops || []).reduce((m, s) => { m[s.id] = s; return m; }, {});

    const result = orders.map(o => ({
      ...o,
      shop_name:  shopMap[o.shop_id]?.shop_name,
      shop_city:  shopMap[o.shop_id]?.city,
      shop_phone: shopMap[o.shop_id]?.phone,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get supplier orders error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update B2B order status
// @route   PATCH /api/supplier/orders/:id/status
// @access  Private (Supplier)
exports.updateOrderStatus = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });

    const { status } = req.body;
    const allowed = ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const { data: existing, error: checkError } = await supabase.from('orders')
      .select('*').eq('id', req.params.id).eq('supplier_id', supplier.id).maybeSingle();
    if (checkError) throw checkError;
    if (!existing) return res.status(404).json({ success: false, message: 'Order not found' });

    const validTransitions = {
      Pending: ['Confirmed', 'Cancelled'],
      Confirmed: ['Processing', 'Cancelled'],
      Processing: ['Shipped'],
      Shipped: ['Delivered'],
    };
    if (!validTransitions[existing.status] || !validTransitions[existing.status].includes(status)) {
      return res.status(400).json({ success: false, message: `Cannot transition from "${existing.status}" to "${status}"` });
    }

    const order = await Order.updateStatus(req.params.id, status);
    res.json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Supplier dashboard stats
// @route   GET /api/supplier/dashboard
// @access  Private (Supplier)
exports.getDashboard = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });

    const [{ data: catalogItems }, { data: orders }] = await Promise.all([
      supabase.from('supplier_catalog').select('id, is_active').eq('supplier_id', supplier.id),
      supabase.from('orders').select('id, status, total_amount, shop_id, created_at').eq('supplier_id', supplier.id),
    ]);

    const totalCatalogItems  = (catalogItems || []).length;
    const activeCatalogItems = (catalogItems || []).filter(c => c.is_active).length;
    const totalOrders   = (orders || []).length;
    const pendingOrders = (orders || []).filter(o => o.status === 'Pending').length;
    const activeOrders  = (orders || []).filter(o => ['Processing', 'Shipped'].includes(o.status)).length;
    const totalRevenue  = (orders || []).filter(o => o.status === 'Delivered').reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

    // Recent orders with shop name
    const recentOrdersRaw = (orders || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    const shopIds = [...new Set(recentOrdersRaw.map(o => o.shop_id))];
    const { data: shops } = await supabase.from('shops').select('id, shop_name').in('id', shopIds.length ? shopIds : [0]);
    const shopMap = (shops || []).reduce((m, s) => { m[s.id] = s; return m; }, {});
    const recentOrders = recentOrdersRaw.map(o => ({ ...o, shop_name: shopMap[o.shop_id]?.shop_name }));

    res.json({
      success: true,
      data: {
        supplier,
        stats: { totalCatalogItems, activeCatalogItems, totalOrders, pendingOrders, activeOrders, totalRevenue },
        recentOrders,
      },
    });
  } catch (error) {
    console.error('Supplier dashboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update supplier location
// @route   PUT /api/supplier/location
// @access  Private (Supplier)
exports.updateLocation = async (req, res) => {
  try {
    const supplier = await Supplier.findByUserId(req.user.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found' });

    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const validation = validateCoordinates(latitude, longitude);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const data = await Supplier.updateLocation(supplier.id, validation.latitude, validation.longitude);
    res.json({ success: true, message: 'Location updated successfully', data });
  } catch (error) {
    console.error('Update supplier location error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = exports;
