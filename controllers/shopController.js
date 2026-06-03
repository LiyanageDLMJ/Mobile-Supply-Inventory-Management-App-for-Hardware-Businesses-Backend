const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const { validateCoordinates } = require('../utils/geolocation');
const supabase = require('../config/supabase');

// @desc    Get shop owner dashboard stats
// @route   GET /api/shop/dashboard/stats
// @access  Private (Shop Owner)
exports.getDashboardStats = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const [products, pendingReservations, completedReservations] = await Promise.all([
      Product.findByShopId(shop.id),
      Reservation.findByShopId(shop.id, 'Pending'),
      Reservation.findByShopId(shop.id, 'Completed'),
    ]);

    const lowStockCount = products.filter(p => {
      const threshold = p.low_stock_threshold || 10;
      return p.quantity_on_hand <= threshold;
    }).length;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Calculate today's sales from completed reservations
    const todaysSales = completedReservations
      .filter(r => {
        const completedDate = new Date(r.updated_at || r.created_at);
        const rDate = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
        return rDate.getTime() === today.getTime();
      })
      .reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);

    // Urgent orders: pending reservations created in last hour
    const urgentOrders = pendingReservations.filter(r => {
      const created = new Date(r.created_at);
      return (now - created) < 60 * 60 * 1000;
    }).length;

    res.json({
      success: true,
      stats: {
        todaysSales,
        salesChange: 0,
        pendingOrders: pendingReservations.length,
        urgentOrders,
        lowStockCount,
        totalProducts: products.length,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get shop owner dashboard
// @route   GET /api/shop/dashboard
// @access  Private (Shop Owner)
exports.getDashboard = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const [products, pendingReservations] = await Promise.all([
      Product.findByShopId(shop.id),
      Reservation.findByShopId(shop.id, 'Pending'),
    ]);
    const lowStockItems = products.filter(p => p.quantity_on_hand <= p.low_stock_threshold);

    res.json({
      success: true,
      data: {
        shop,
        stats: {
          totalProducts: products.length,
          lowStockCount: lowStockItems.length,
          pendingReservationsCount: pendingReservations.length,
          totalInventoryValue: products.reduce((sum, p) => sum + (p.quantity_on_hand * p.unit_price), 0),
          loyaltyPoints: shop.loyalty_points,
          loyaltyTier: shop.loyalty_tier,
        },
        lowStockItems: lowStockItems.slice(0, 10),
        pendingReservations: pendingReservations.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get shop profile
// @route   GET /api/shop/profile
// @access  Private (Shop Owner)
exports.getProfile = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    res.json({ success: true, data: shop });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update shop profile
// @route   PUT /api/shop/profile
// @access  Private (Shop Owner)
exports.updateProfile = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const {
      shopName, description, phone, email, address, city, province,
      postalCode, openingTime, closingTime, workingDays,
    } = req.body;

    const updateData = { updated_at: new Date().toISOString() };
    if (shopName)     updateData.shop_name    = shopName;
    if (description)  updateData.description  = description;
    if (phone)        updateData.phone        = phone;
    if (email)        updateData.email        = email;
    if (address)      updateData.address      = address;
    if (city)         updateData.city         = city;
    if (province)     updateData.province     = province;
    if (postalCode)   updateData.postal_code  = postalCode;
    if (openingTime)  updateData.opening_time = openingTime;
    if (closingTime)  updateData.closing_time = closingTime;
    if (workingDays)  updateData.working_days = workingDays;

    const { error } = await supabase.from('shops').update(updateData).eq('id', shop.id);
    if (error) throw error;

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update shop location
// @route   PUT /api/shop/location
// @access  Private (Shop Owner)
exports.updateLocation = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const validation = validateCoordinates(latitude, longitude);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const data = await Shop.updateLocation(shop.id, validation.latitude, validation.longitude);
    res.json({ success: true, message: 'Location updated successfully', data });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Browse all active suppliers
// @route   GET /api/shop/suppliers
// @access  Private (Shop Owner)
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll();
    res.json({ success: true, data: suppliers });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get a supplier's catalog
// @route   GET /api/shop/suppliers/:supplierId/catalog
// @access  Private (Shop Owner)
exports.getSupplierCatalog = async (req, res) => {
  try {
    const { data, error } = await supabase.from('supplier_catalog')
      .select('*')
      .eq('supplier_id', req.params.supplierId)
      .eq('is_active', true)
      .order('category').order('product_name');
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Get supplier catalog error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Place a B2B order to a supplier
// @route   POST /api/shop/orders
// @access  Private (Shop Owner)
exports.createOrder = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const { supplierId, items, deliveryAddress, deliveryCity, estimatedDeliveryDate, paymentMethod, notes } = req.body;

    if (!supplierId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Supplier and at least one item are required' });
    }

    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const { data: catalogItem, error } = await supabase.from('supplier_catalog')
        .select('*').eq('id', item.catalogItemId).eq('supplier_id', supplierId).eq('is_active', true).maybeSingle();
      if (error || !catalogItem) {
        return res.status(400).json({ success: false, message: `Catalog item ${item.catalogItemId} not found or inactive` });
      }
      if (item.quantity < catalogItem.minimum_order_quantity) {
        return res.status(400).json({ success: false, message: `Minimum order quantity for "${catalogItem.product_name}" is ${catalogItem.minimum_order_quantity}` });
      }
      if (item.quantity > catalogItem.stock_available) {
        return res.status(400).json({ success: false, message: `Only ${catalogItem.stock_available} units of "${catalogItem.product_name}" available` });
      }
      const itemTotal = catalogItem.wholesale_price * item.quantity;
      totalAmount += itemTotal;
      validatedItems.push({
        catalogItemId: catalogItem.id,
        productName: catalogItem.product_name,
        quantity: item.quantity,
        unitPrice: catalogItem.wholesale_price,
        totalPrice: itemTotal,
      });
    }

    const order = await Order.create({
      shopId: shop.id, supplierId, totalAmount,
      deliveryAddress: deliveryAddress || shop.address,
      deliveryCity: deliveryCity || shop.city,
      estimatedDeliveryDate: estimatedDeliveryDate || null,
      paymentMethod: paymentMethod || 'COD',
      notes: notes || null,
      items: validatedItems,
    });

    // Notify supplier about new order
    const { data: supplierRow } = await supabase.from('suppliers').select('user_id').eq('id', supplierId).maybeSingle();
    if (supplierRow) {
      Notification.create({
        userId: supplierRow.user_id,
        type: 'NEW_ORDER',
        title: 'New B2B Order',
        message: `${shop.shop_name} placed order ${order.order_number} — LKR ${parseFloat(order.total_amount).toLocaleString()}`,
      }).catch(err => console.error('Notification create failed:', err.message));
    }

    res.status(201).json({ success: true, message: 'Order placed successfully', data: order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get shop's B2B order history
// @route   GET /api/shop/orders
// @access  Private (Shop Owner)
exports.getOrders = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    const orders = await Order.findByShopId(shop.id);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get single B2B order with items
// @route   GET /api/shop/orders/:id
// @access  Private (Shop Owner)
exports.getOrder = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const order = await Order.findByIdWithItems(req.params.id);
    if (!order || order.shop_id !== shop.id) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = exports;
