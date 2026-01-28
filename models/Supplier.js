const pool = require('../config/database');

class Supplier {
  // Create suppliers table
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255) NOT NULL,
        business_reg_number VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        
        -- Contact
        contact_person VARCHAR(100),
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL,
        website VARCHAR(255),
        
        -- Address
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        province VARCHAR(100),
        postal_code VARCHAR(20),
        
        -- Business details
        categories TEXT, -- JSON array: ["Plumbing", "Electrical", "Tools"]
        minimum_order_amount DECIMAL(10, 2) DEFAULT 0,
        delivery_areas TEXT, -- JSON array of cities/provinces
        
        -- Ratings
        rating DECIMAL(3, 2) DEFAULT 0.00,
        total_ratings INTEGER DEFAULT 0,
        
        -- Status
        is_active BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);
      CREATE INDEX IF NOT EXISTS idx_suppliers_city ON suppliers(city);
      CREATE INDEX IF NOT EXISTS idx_suppliers_rating ON suppliers(rating);
    `;
    
    try {
      await pool.query(query);
      console.log('✅ Suppliers table created successfully');
    } catch (error) {
      console.error('❌ Error creating suppliers table:', error);
      throw error;
    }
  }

  // Create supplier catalog table
  static async createCatalogTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS supplier_catalog (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        
        product_name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        
        -- Wholesale pricing
        wholesale_price DECIMAL(10, 2) NOT NULL,
        minimum_order_quantity INTEGER DEFAULT 1,
        unit_of_measure VARCHAR(50) DEFAULT 'pcs',
        
        -- Stock
        stock_available INTEGER NOT NULL DEFAULT 0,
        
        -- Product identification
        sku VARCHAR(100),
        manufacturer VARCHAR(100),
        
        -- Media
        image_url TEXT,
        
        -- Status
        is_active BOOLEAN DEFAULT TRUE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_catalog_supplier ON supplier_catalog(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_catalog_category ON supplier_catalog(category);
      CREATE INDEX IF NOT EXISTS idx_catalog_active ON supplier_catalog(is_active);
    `;
    
    try {
      await pool.query(query);
      console.log('✅ Supplier catalog table created successfully');
    } catch (error) {
      console.error('❌ Error creating supplier catalog table:', error);
      throw error;
    }
  }

  // Create supplier
  static async create(supplierData) {
    const {
      userId, companyName, businessRegNumber, description, contactPerson,
      phone, email, website, address, city, province, postalCode,
      categories, minimumOrderAmount, deliveryAreas
    } = supplierData;

    const query = `
      INSERT INTO suppliers (
        user_id, company_name, business_reg_number, description, contact_person,
        phone, email, website, address, city, province, postal_code,
        categories, minimum_order_amount, delivery_areas
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      userId, companyName, businessRegNumber, description || null, contactPerson || null,
      phone, email, website || null, address, city, province || null, postalCode || null,
      categories || null, minimumOrderAmount || 0, deliveryAreas || null
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  }

  // Get all active suppliers
  static async findAll() {
    const query = `
      SELECT s.*, u.first_name, u.last_name
      FROM suppliers s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true
      ORDER BY s.rating DESC, s.company_name
    `;
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error finding suppliers:', error);
      throw error;
    }
  }

  // Get supplier by user ID
  static async findByUserId(userId) {
    const query = 'SELECT * FROM suppliers WHERE user_id = $1';
    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error finding supplier:', error);
      throw error;
    }
  }
}

module.exports = Supplier;
