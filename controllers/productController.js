const Product = require('../models/Product');
const Shop = require('../models/Shop');
const Notification = require('../models/Notification');
const supabase = require('../config/supabase');
const { maybeNotifyLowStock } = require('../utils/stockAlert');

// @desc    Get all products for shop owner
// @route   GET /api/products
// @access  Private (Shop Owner)
exports.getAllProducts = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const products = await Product.findByShopId(shop.id);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private (Shop Owner)
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Shop Owner)
exports.createProduct = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const {
      productName, description, category, subCategory,
      unitPrice, costPrice, quantityOnHand, lowStockThreshold,
      unitOfMeasure, sku, barcode, imageUrl,
    } = req.body;

    if (costPrice && parseFloat(unitPrice) < parseFloat(costPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Selling price cannot be lower than cost price. You would be selling at a loss.',
      });
    }
    if (parseFloat(unitPrice) <= 0) {
      return res.status(400).json({ success: false, message: 'Selling price must be greater than zero.' });
    }

    const product = await Product.create({
      shopId: shop.id, productName, description, category, subCategory,
      unitPrice, costPrice, quantityOnHand, lowStockThreshold,
      unitOfMeasure, sku, barcode, imageUrl,
    });

    // If they create a product already at/below its threshold, warn immediately.
    await maybeNotifyLowStock({
      userId: req.user.id,
      productName: product.product_name,
      newQty: product.quantity_on_hand,
      threshold: product.low_stock_threshold,
    });

    res.status(201).json({ success: true, message: 'Product created successfully', data: product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Shop Owner)
exports.updateProduct = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const product = await Product.findById(req.params.id);
    if (!product || product.shop_id !== shop.id) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const {
      productName, description, category, subCategory,
      unitPrice, costPrice, quantityOnHand, lowStockThreshold,
      unitOfMeasure, sku, barcode, imageUrl,
    } = req.body;

    const newUnitPrice = unitPrice !== undefined ? parseFloat(unitPrice) : product.unit_price;
    const newCostPrice = costPrice !== undefined ? parseFloat(costPrice) : product.cost_price;
    if (newCostPrice && newUnitPrice < newCostPrice) {
      return res.status(400).json({ success: false, message: 'Selling price cannot be lower than cost price.' });
    }

    const prevQty = product.quantity_on_hand;

    const updated = await Product.update(req.params.id, {
      product_name: productName,
      description,
      category,
      sub_category: subCategory,
      unit_price: unitPrice !== undefined ? parseFloat(unitPrice) : undefined,
      cost_price: costPrice !== undefined ? parseFloat(costPrice) : undefined,
      quantity_on_hand: quantityOnHand !== undefined ? parseInt(quantityOnHand) : undefined,
      low_stock_threshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : undefined,
      unit_of_measure: unitOfMeasure,
      sku,
      barcode,
      image_url: imageUrl,
    });

    // Editing quantity or threshold can cross the low-stock line — alert once.
    await maybeNotifyLowStock({
      userId: req.user.id,
      productName: updated.product_name,
      newQty: updated.quantity_on_hand,
      threshold: updated.low_stock_threshold,
      prevQty,
    });

    res.json({ success: true, message: 'Product updated successfully', data: updated });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update product quantity
// @route   PATCH /api/products/:id/quantity
// @access  Private (Shop Owner)
exports.updateQuantity = async (req, res) => {
  try {
    const { quantity, operation } = req.body;
    const product = await Product.updateQuantity(req.params.id, quantity, operation);

    // Crossing-guard alert — only fires when stock first drops to/below threshold.
    const { data: shopRow } = await supabase.from('shops').select('owner_id').eq('id', product.shop_id).single();
    if (shopRow) {
      await maybeNotifyLowStock({
        userId: shopRow.owner_id,
        productName: product.product_name,
        newQty: product.quantity_on_hand,
        threshold: product.low_stock_threshold,
        prevQty: product.previous_quantity,
      });
    }

    res.json({ success: true, message: 'Quantity updated successfully', data: product });
  } catch (error) {
    console.error('Update quantity error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Shop Owner)
exports.deleteProduct = async (req, res) => {
  try {
    await Product.delete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get low stock products
// @route   GET /api/products/low-stock
// @access  Private (Shop Owner)
exports.getLowStockProducts = async (req, res) => {
  try {
    const shop = await Shop.findByOwnerId(req.user.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    const lowStockItems = await Product.getLowStockItems(shop.id);
    res.json({ success: true, data: lowStockItems });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = exports;
