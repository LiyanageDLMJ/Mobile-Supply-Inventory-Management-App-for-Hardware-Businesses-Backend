const Product = require('../models/Product');
const Shop = require('../models/Shop');

// @desc    Get all products for shop owner
// @route   GET /api/products
// @access  Private (Shop Owner)
exports.getAllProducts = async (req, res) => {
  try {
    const userId = req.user.id;
    const shop = await Shop.findByOwnerId(userId);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    const products = await Product.findByShopId(shop.id);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private (Shop Owner)
exports.getProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Shop Owner)
exports.createProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const shop = await Shop.findByOwnerId(userId);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    const {
      productName, description, category, subCategory,
      unitPrice, costPrice, quantityOnHand, lowStockThreshold,
      unitOfMeasure, sku, barcode, imageUrl
    } = req.body;

    const product = await Product.create({
      shopId: shop.id,
      productName,
      description,
      category,
      subCategory,
      unitPrice,
      costPrice,
      quantityOnHand,
      lowStockThreshold,
      unitOfMeasure,
      sku,
      barcode,
      imageUrl,
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Shop Owner)
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updates = req.body;

    // Add update logic here (similar to User.update)
    
    res.json({
      success: true,
      message: 'Product updated successfully',
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Update product quantity
// @route   PATCH /api/products/:id/quantity
// @access  Private (Shop Owner)
exports.updateQuantity = async (req, res) => {
  try {
    const productId = req.params.id;
    const { quantity, operation } = req.body; // operation: 'set', 'add', 'subtract'

    const product = await Product.updateQuantity(productId, quantity, operation);

    res.json({
      success: true,
      message: 'Quantity updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Update quantity error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Shop Owner)
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    await Product.delete(productId);

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Get low stock products
// @route   GET /api/products/low-stock
// @access  Private (Shop Owner)
exports.getLowStockProducts = async (req, res) => {
  try {
    const userId = req.user.id;
    const shop = await Shop.findByOwnerId(userId);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    const lowStockItems = await Product.getLowStockItems(shop.id);

    res.json({
      success: true,
      data: lowStockItems,
    });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

module.exports = exports;
