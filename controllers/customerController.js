const Reservation = require('../models/Reservation');
const { calculateDistance, validateCoordinates } = require('../utils/geolocation');
const supabase = require('../config/supabase');
const Rating = require('../models/Rating');

// @desc    Search products across all active shops
// @route   GET /api/customer/products/search?q=cement&city=colombo&category=Tools
// @access  Private (Customer)
exports.searchProducts = async (req, res) => {
  try {
    const { q, city, category } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
    }

    const term = q.trim().toLowerCase();

    // Step 1: get IDs of active shops (filter by city if provided)
    let shopQuery = supabase.from('shops').select('id, shop_name, city, address, phone, email, opening_time, closing_time').eq('is_active', true);
    if (city) shopQuery = shopQuery.ilike('city', `%${city.trim()}%`);
    const { data: shops, error: shopError } = await shopQuery;
    if (shopError) throw shopError;
    if (!shops || shops.length === 0) return res.json({ success: true, data: [] });

    const shopIds = shops.map(s => s.id);
    const shopMap = shops.reduce((m, s) => { m[s.id] = s; return m; }, {});

    // Step 2: search products in those shops
    let productQuery = supabase.from('products')
      .select('id, product_name, description, category, sub_category, unit_price, quantity_on_hand, unit_of_measure, image_url, shop_id')
      .in('shop_id', shopIds)
      .gt('quantity_on_hand', 0)
      .or(`product_name.ilike.%${term}%,category.ilike.%${term}%,description.ilike.%${term}%`)
      .limit(100);

    if (category) productQuery = productQuery.ilike('category', `%${category.trim()}%`);

    const { data: products, error: productError } = await productQuery;
    if (productError) throw productError;

    // Step 3: flatten with shop info
    const summaries = await Rating.getSummaryMap('SHOP', shopIds);
    const result = (products || []).map(p => ({
      ...p,
      shop_id:      p.shop_id,
      shop_name:    shopMap[p.shop_id]?.shop_name,
      city:         shopMap[p.shop_id]?.city,
      address:      shopMap[p.shop_id]?.address,
      phone:        shopMap[p.shop_id]?.phone,
      email:        shopMap[p.shop_id]?.email,
      opening_time: shopMap[p.shop_id]?.opening_time,
      closing_time: shopMap[p.shop_id]?.closing_time,
      ...(summaries.get(Number(p.shop_id)) || { rating_average: null, rating_count: 0 }),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Browse available products across all active shops (no search term).
//          Lets customers discover what shops are stocking, e.g. "Liyanage HW has a fan".
// @route   GET /api/customer/products/browse?category=Tools
// @access  Private (Customer)
exports.browseProducts = async (req, res) => {
  try {
    const { category } = req.query;

    // Get active shops first so we can attach shop info to each product
    const { data: shops, error: shopError } = await supabase.from('shops')
      .select('id, shop_name, city, address, phone, opening_time, closing_time')
      .eq('is_active', true);
    if (shopError) throw shopError;
    if (!shops || shops.length === 0) return res.json({ success: true, data: [] });

    const shopIds = shops.map(s => s.id);
    const shopMap = shops.reduce((m, s) => { m[s.id] = s; return m; }, {});

    let productQuery = supabase.from('products')
      .select('id, product_name, description, category, sub_category, unit_price, quantity_on_hand, unit_of_measure, image_url, shop_id, created_at')
      .in('shop_id', shopIds)
      .gt('quantity_on_hand', 0)
      .order('created_at', { ascending: false })
      .limit(60);

    if (category) productQuery = productQuery.ilike('category', `%${category.trim()}%`);

    const { data: products, error: productError } = await productQuery;
    if (productError) throw productError;

    const summaries = await Rating.getSummaryMap('SHOP', shopIds);
    const result = (products || []).map(p => ({
      ...p,
      shop_name:    shopMap[p.shop_id]?.shop_name,
      city:         shopMap[p.shop_id]?.city,
      address:      shopMap[p.shop_id]?.address,
      phone:        shopMap[p.shop_id]?.phone,
      opening_time: shopMap[p.shop_id]?.opening_time,
      closing_time: shopMap[p.shop_id]?.closing_time,
      ...(summaries.get(Number(p.shop_id)) || { rating_average: null, rating_count: 0 }),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Browse products error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    List all active shops
// @route   GET /api/customer/shops
// @access  Private (Customer)
exports.getShops = async (req, res) => {
  try {
    const { city } = req.query;
    let query = supabase.from('shops')
      .select('id, shop_name, description, phone, email, address, city, province, opening_time, closing_time, working_days')
      .eq('is_active', true).order('shop_name');
    if (city) query = query.ilike('city', `%${city.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    const shops = data || [];
    const summaries = await Rating.getSummaryMap('SHOP', shops.map(s => s.id));
    res.json({ success: true, data: shops.map(shop => ({
      ...shop,
      ...(summaries.get(Number(shop.id)) || { rating_average: null, rating_count: 0 }),
    })) });
  } catch (error) {
    console.error('Get shops error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get a shop's public product listing
// @route   GET /api/customer/shops/:shopId/products
// @access  Private (Customer)
exports.getShopProducts = async (req, res) => {
  try {
    const { shopId } = req.params;

    const { data: shop, error: shopError } = await supabase.from('shops')
      .select('id, shop_name, city, address, phone, opening_time, closing_time')
      .eq('id', shopId).eq('is_active', true).maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const { data: products, error: productError } = await supabase.from('products')
      .select('id, product_name, description, category, sub_category, unit_price, quantity_on_hand, unit_of_measure, image_url')
      .eq('shop_id', shopId).gt('quantity_on_hand', 0).order('category').order('product_name');
    if (productError) throw productError;

    // Ratings are supplementary. A rating schema/configuration issue must not
    // prevent customers from opening a shop's product catalog.
    let ratingSummary = { rating_average: null, rating_count: 0 };
    try {
      const summaries = await Rating.getSummaryMap('SHOP', [shop.id]);
      ratingSummary = summaries.get(Number(shop.id)) || ratingSummary;
    } catch (ratingError) {
      console.warn('Shop catalog rating summary unavailable:', ratingError.message);
    }
    res.json({ success: true, data: {
      shop: { ...shop, ...ratingSummary },
      products: products || [],
    } });
  } catch (error) {
    console.error('Get shop products error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Create a product reservation
// @route   POST /api/customer/reservations
// @access  Private (Customer)
exports.createReservation = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, shopId, quantity, pickupDate, pickupTime, customerNotes } = req.body;

    if (!productId || !shopId || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'productId, shopId, and a positive quantity are required' });
    }

    const { data: product, error } = await supabase.from('products')
      .select('*').eq('id', productId).eq('shop_id', shopId).maybeSingle();
    if (error) throw error;
    if (!product) return res.status(404).json({ success: false, message: 'Product not found in this shop' });

    if (product.quantity_on_hand < quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.quantity_on_hand} units available. Cannot reserve ${quantity}.` });
    }

    const totalAmount = parseFloat(product.unit_price) * quantity;
    // Guard against DB numeric overflow (column max ~9,999,999,999.99)
    if (totalAmount > 9_999_999_999) {
      return res.status(400).json({
        success: false,
        message: 'Reservation total exceeds the maximum allowed amount. Please reduce the quantity.',
      });
    }

    const reservation = await Reservation.create({
      customerId, shopId, productId, quantity,
      unitPrice: product.unit_price,
      totalAmount,
      pickupDate: pickupDate || null,
      pickupTime: pickupTime || null,
      customerNotes: customerNotes || null,
    });

    res.status(201).json({ success: true, message: 'Reservation created successfully', data: reservation });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get customer's own reservations
// @route   GET /api/customer/reservations
// @access  Private (Customer)
exports.getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.findByCustomerId(req.user.id);
    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Cancel a reservation (only if >1 hour before pickup — BR-02)
// @route   DELETE /api/customer/reservations/:id
// @access  Private (Customer)
exports.cancelReservation = async (req, res) => {
  try {
    const { data: reservation, error } = await supabase.from('reservations')
      .select('*').eq('id', req.params.id).eq('customer_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found' });

    if (!['Pending', 'Accepted'].includes(reservation.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a reservation with status "${reservation.status}"` });
    }

    if (reservation.pickup_date && reservation.pickup_time) {
      const pickup = new Date(`${reservation.pickup_date}T${reservation.pickup_time}`);
      if (pickup - new Date() < 60 * 60 * 1000) {
        return res.status(400).json({ success: false, message: 'Cancellation is not allowed less than 1 hour before pickup time' });
      }
    }

    await supabase.from('reservations')
      .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.json({ success: true, message: 'Reservation cancelled successfully' });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get customer loyalty info
// @route   GET /api/customer/loyalty
// @access  Private (Customer)
exports.getLoyalty = async (req, res) => {
  try {
    const { data, error } = await supabase.from('users')
      .select('loyalty_points, loyalty_tier').eq('id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get loyalty error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get nearby shops within a radius
// @route   GET /api/customer/shops/nearby?latitude=X&longitude=Y&radiusKm=10
// @access  Private (Customer)
exports.getNearbyShops = async (req, res) => {
  try {
    const { latitude, longitude, radiusKm } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const validation = validateCoordinates(latitude, longitude);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const radius = Math.max(1, Math.min(parseInt(radiusKm) || 10, 100)); // Clamp between 1-100 km

    // Fetch all active shops with location data
    const { data: shops, error } = await supabase.from('shops')
      .select('id, shop_name, description, address, city, phone, latitude, longitude')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      // Column doesn't exist yet — migration not run
      if (error.message && error.message.includes('latitude')) {
        return res.status(503).json({
          success: false,
          message: 'Location feature not yet enabled. Run the database migration to add latitude/longitude columns.',
        });
      }
      throw error;
    }
    if (!shops || shops.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Calculate distance and filter by radius
    const shopsWithDistance = shops
      .map(shop => ({
        ...shop,
        distance_km: calculateDistance(
          validation.latitude,
          validation.longitude,
          shop.latitude,
          shop.longitude
        ),
      }))
      .filter(shop => shop.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 50); // Limit to top 50 results

    // Get product counts for each shop
    const shopIds = shopsWithDistance.map(s => s.id);
    const { data: productCounts } = await supabase.from('products')
      .select('shop_id')
      .in('shop_id', shopIds.length ? shopIds : [0])
      .gt('quantity_on_hand', 0);

    const countMap = (productCounts || []).reduce((m, p) => {
      m[p.shop_id] = (m[p.shop_id] || 0) + 1;
      return m;
    }, {});

    const summaries = await Rating.getSummaryMap('SHOP', shopIds);
    const result = shopsWithDistance.map(shop => ({
      ...shop,
      products_count: countMap[shop.id] || 0,
      ...(summaries.get(Number(shop.id)) || { rating_average: null, rating_count: 0 }),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get nearby shops error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = exports;
