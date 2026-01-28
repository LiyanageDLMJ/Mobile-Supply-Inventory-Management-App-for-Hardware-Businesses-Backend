const pool = require('../config/database');

class Product {
  // Create products table for shop inventory
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        
        -- Product details
        product_name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        
        -- Pricing
        unit_price DECIMAL(10, 2) NOT NULL,
        cost_price DECIMAL(10, 2),
        currency VARCHAR(10) DEFAULT 'LKR',
        
        -- Inventory
        quantity_on_hand INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 10,
        unit_of_measure VARCHAR(50) DEFAULT 'pcs', -- pcs, kg, liters, etc.
        
        -- Product identification
        sku VARCHAR(100),
        barcode VARCHAR(100),
        
        -- Media
        image_url TEXT,
        images TEXT, -- JSON array of image URLs
        
        -- Status
        is_active BOOLEAN DEFAULT TRUE,
        is_available BOOLEAN DEFAULT TRUE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(quantity_on_hand, low_stock_threshold);
    `;
    
    try {
      await pool.query(query);
      console.log('✅ Products table created successfully');
    } catch (error) {
      console.error('❌ Error creating products table:', error);
      throw error;
    }
  }

  // Create new product
  static async create(productData) {
    const {
      shopId, productName, description, category, subCategory,
      unitPrice, costPrice, quantityOnHand, lowStockThreshold,
      unitOfMeasure, sku, barcode, imageUrl
    } = productData;

    const query = `
      INSERT INTO products (
        shop_id, product_name, description, category, sub_category,
        unit_price, cost_price, quantity_on_hand, low_stock_threshold,
        unit_of_measure, sku, barcode, image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      shopId, productName, description || null, category, subCategory || null,
      unitPrice, costPrice || null, quantityOnHand, lowStockThreshold || 10,
      unitOfMeasure || 'pcs', sku || null, barcode || null, imageUrl || null
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Get all products for a shop
  static async findByShopId(shopId) {
    const query = 'SELECT * FROM products WHERE shop_id = $1 ORDER BY product_name';
    try {
      const result = await pool.query(query, [shopId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding products:', error);
      throw error;
    }
  }

  // Get low stock items
  static async getLowStockItems(shopId) {
    const query = `
      SELECT * FROM products 
      WHERE shop_id = $1 AND quantity_on_hand <= low_stock_threshold
      ORDER BY quantity_on_hand ASC
    `;
    try {
      const result = await pool.query(query, [shopId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding low stock items:', error);
      throw error;
    }
  }

  // Update quantity
  static async updateQuantity(productId, quantity, operation = 'set') {
    let query;
    if (operation === 'add') {
      query = `
        UPDATE products 
        SET quantity_on_hand = quantity_on_hand + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
    } else if (operation === 'subtract') {
      query = `
        UPDATE products 
        SET quantity_on_hand = GREATEST(quantity_on_hand - $1, 0), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
    } else {
      query = `
        UPDATE products 
        SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
    }

    try {
      const result = await pool.query(query, [quantity, productId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating quantity:', error);
      throw error;
    }
  }

  // Delete product
  static async delete(productId) {
    const query = 'DELETE FROM products WHERE id = $1 RETURNING *';
    try {
      const result = await pool.query(query, [productId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Get product by ID
  static async findById(productId) {
    const query = 'SELECT * FROM products WHERE id = $1';
    try {
      const result = await pool.query(query, [productId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error finding product:', error);
      throw error;
    }
  }
}

module.exports = Product;
