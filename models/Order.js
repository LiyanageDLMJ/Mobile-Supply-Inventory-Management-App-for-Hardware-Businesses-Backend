const pool = require('../config/database');

class Order {
  // Create orders table (B2B orders from shops to suppliers)
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        
        -- Parties involved
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        
        -- Order details
        total_amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'LKR',
        
        -- Status tracking
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        -- Pending, Confirmed, Processing, Shipped, Delivered, Cancelled
        
        -- Delivery
        delivery_address TEXT NOT NULL,
        delivery_city VARCHAR(100),
        estimated_delivery_date DATE,
        actual_delivery_date DATE,
        
        -- Payment
        payment_method VARCHAR(50), -- COD, Bank Transfer, Online
        payment_status VARCHAR(50) DEFAULT 'Pending', -- Pending, Paid, Failed
        
        -- Notes
        notes TEXT,
        cancellation_reason TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
      CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
    `;
    
    try {
      await pool.query(query);
      console.log('✅ Orders table created successfully');
    } catch (error) {
      console.error('❌ Error creating orders table:', error);
      throw error;
    }
  }

  // Create order items table
  static async createOrderItemsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        catalog_item_id INTEGER NOT NULL REFERENCES supplier_catalog(id),
        
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    `;
    
    try {
      await pool.query(query);
      console.log('✅ Order items table created successfully');
    } catch (error) {
      console.error('❌ Error creating order items table:', error);
      throw error;
    }
  }

  // Generate order number
  static generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD-${timestamp}-${random}`;
  }

  // Create new order
  static async create(orderData) {
    const {
      shopId, supplierId, totalAmount, deliveryAddress, deliveryCity,
      estimatedDeliveryDate, paymentMethod, notes, items
    } = orderData;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const orderNumber = this.generateOrderNumber();
      
      // Insert order
      const orderQuery = `
        INSERT INTO orders (
          order_number, shop_id, supplier_id, total_amount, delivery_address,
          delivery_city, estimated_delivery_date, payment_method, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const orderValues = [
        orderNumber, shopId, supplierId, totalAmount, deliveryAddress,
        deliveryCity || null, estimatedDeliveryDate || null, paymentMethod || 'COD', notes || null
      ];
      
      const orderResult = await client.query(orderQuery, orderValues);
      const order = orderResult.rows[0];

      // Insert order items
      if (items && items.length > 0) {
        const itemQuery = `
          INSERT INTO order_items (order_id, catalog_item_id, product_name, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        for (const item of items) {
          await client.query(itemQuery, [
            order.id, item.catalogItemId, item.productName,
            item.quantity, item.unitPrice, item.totalPrice
          ]);
        }
      }

      await client.query('COMMIT');
      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get orders by shop
  static async findByShopId(shopId) {
    const query = `
      SELECT o.*, s.company_name as supplier_name
      FROM orders o
      JOIN suppliers s ON o.supplier_id = s.id
      WHERE o.shop_id = $1
      ORDER BY o.created_at DESC
    `;
    try {
      const result = await pool.query(query, [shopId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding orders:', error);
      throw error;
    }
  }

  // Get order with items
  static async findByIdWithItems(orderId) {
    const orderQuery = `
      SELECT o.*, s.company_name as supplier_name, sh.shop_name
      FROM orders o
      JOIN suppliers s ON o.supplier_id = s.id
      JOIN shops sh ON o.shop_id = sh.id
      WHERE o.id = $1
    `;
    
    const itemsQuery = 'SELECT * FROM order_items WHERE order_id = $1';
    
    try {
      const orderResult = await pool.query(orderQuery, [orderId]);
      const itemsResult = await pool.query(itemsQuery, [orderId]);
      
      if (orderResult.rows.length === 0) return null;
      
      return {
        ...orderResult.rows[0],
        items: itemsResult.rows
      };
    } catch (error) {
      console.error('Error finding order:', error);
      throw error;
    }
  }

  // Update order status
  static async updateStatus(orderId, status) {
    const query = `
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    try {
      const result = await pool.query(query, [status, orderId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
}

module.exports = Order;
