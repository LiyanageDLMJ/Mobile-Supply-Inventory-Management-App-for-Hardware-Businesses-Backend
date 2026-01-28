const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const pool = require('../config/database');

// @desc    Get shop owner dashboard stats
// @route   GET /api/shop/dashboard/stats
// @access  Private (Shop Owner)
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get shop
    const shop = await Shop.findByOwnerId(userId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    // Get product statistics
    const productStats = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN quantity_on_hand <= low_stock_threshold THEN 1 END) as low_stock_count
      FROM products
      WHERE shop_id = $1
    `, [shop.id]);

    // Get pending reservations count
    const reservationStats = await pool.query(`
      SELECT 
        COUNT(*) as pending_orders,
        COUNT(CASE WHEN status = 'Pending' AND created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as urgent_orders
      FROM reservations
      WHERE shop_id = $1 AND status = 'Pending'
    `, [shop.id]);

    // Calculate today's sales (mock for now - would need order/payment tracking)
    const todaysSales = 0; // TODO: Implement when payment tracking is added
    const salesChange = 0; // TODO: Calculate from historical data

    const stats = {
      todaysSales,
      salesChange,
      pendingOrders: parseInt(reservationStats.rows[0].pending_orders) || 0,
      urgentOrders: parseInt(reservationStats.rows[0].urgent_orders) || 0,
      lowStockCount: parseInt(productStats.rows[0].low_stock_count) || 0,
      totalProducts: parseInt(productStats.rows[0].total_products) || 0,
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get shop owner dashboard
// @route   GET /api/shop/dashboard
// @access  Private (Shop Owner)
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get shop
    const shop = await Shop.findByOwnerId(userId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    // Get products
    const products = await Product.findByShopId(shop.id);
    
    // Get low stock items
    const lowStockItems = await Product.getLowStockItems(shop.id);
    
    // Get pending reservations
    const pendingReservations = await Reservation.findByShopId(shop.id, 'Pending');
    
    // Calculate stats
    const stats = {
      totalProducts: products.length,
      lowStockCount: lowStockItems.length,
      pendingReservationsCount: pendingReservations.length,
      totalInventoryValue: products.reduce((sum, p) => sum + (p.quantity_on_hand * p.unit_price), 0),
      loyaltyPoints: shop.loyalty_points,
      loyaltyTier: shop.loyalty_tier,
    };

    res.json({
      success: true,
      data: {
        shop,
        stats,
        lowStockItems: lowStockItems.slice(0, 10), // Top 10 low stock items
        pendingReservations: pendingReservations.slice(0, 5), // Recent 5 reservations
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get shop profile
// @route   GET /api/shop/profile
// @access  Private (Shop Owner)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const shop = await Shop.findByOwnerId(userId);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    res.json({
      success: true,
      data: shop,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update shop profile
// @route   PUT /api/shop/profile
// @access  Private (Shop Owner)
exports.updateProfile = async (req, res) => {
  try {
    // Implementation for updating shop profile
    res.json({ success: true, message: 'Profile update endpoint' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = exports;
