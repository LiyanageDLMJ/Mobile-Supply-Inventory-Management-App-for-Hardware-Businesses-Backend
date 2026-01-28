const pool = require('../config/database');

class Shop {
  // Create shops table
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shop_name VARCHAR(255) NOT NULL,
        business_reg_number VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        phone VARCHAR(20),
        email VARCHAR(255),
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        province VARCHAR(100),
        postal_code VARCHAR(20),
        
        -- Business hours
        opening_time TIME,
        closing_time TIME,
        working_days VARCHAR(100), -- JSON string: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        
        -- Loyalty program
        loyalty_points INTEGER DEFAULT 0,
        loyalty_tier VARCHAR(50) DEFAULT 'Bronze', -- Bronze, Silver, Gold, Platinum
        
        -- Status
        is_active BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(owner_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);
      CREATE INDEX IF NOT EXISTS idx_shops_city ON shops(city);
      CREATE INDEX IF NOT EXISTS idx_shops_loyalty_tier ON shops(loyalty_tier);
    `;
    
    try {
      await pool.query(query);
      console.log('✅ Shops table created successfully');
    } catch (error) {
      console.error('❌ Error creating shops table:', error);
      throw error;
    }
  }

  // Create new shop
  static async create(shopData) {
    const {
      ownerId, shopName, businessRegNumber, description, phone, email,
      address, city, province, postalCode, openingTime, closingTime, workingDays
    } = shopData;

    const query = `
      INSERT INTO shops (
        owner_id, shop_name, business_reg_number, description, phone, email,
        address, city, province, postal_code, opening_time, closing_time, working_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      ownerId, shopName, businessRegNumber, description || null, phone, email,
      address, city, province || null, postalCode || null,
      openingTime || null, closingTime || null, workingDays || null
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating shop:', error);
      throw error;
    }
  }

  // Get shop by owner ID
  static async findByOwnerId(ownerId) {
    const query = 'SELECT * FROM shops WHERE owner_id = $1';
    try {
      const result = await pool.query(query, [ownerId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error finding shop by owner:', error);
      throw error;
    }
  }

  // Update loyalty points
  static async updateLoyaltyPoints(shopId, points) {
    const query = `
      UPDATE shops 
      SET loyalty_points = loyalty_points + $1,
          loyalty_tier = CASE
            WHEN loyalty_points + $1 >= 5000 THEN 'Platinum'
            WHEN loyalty_points + $1 >= 2000 THEN 'Gold'
            WHEN loyalty_points + $1 >= 500 THEN 'Silver'
            ELSE 'Bronze'
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [points, shopId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating loyalty points:', error);
      throw error;
    }
  }
}

module.exports = Shop;
