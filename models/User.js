const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Create users table with business verification fields
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('SHOP_OWNER', 'SUPPLIER', 'CUSTOMER', 'ADMIN')),
        
        -- Business verification for Shop Owners and Suppliers
        business_name VARCHAR(255),
        business_reg_number VARCHAR(100) UNIQUE,
        
        -- NIC verification for Customers
        nic_number VARCHAR(20) UNIQUE,
        
        -- Additional profile fields
        address TEXT,
        city VARCHAR(100),
        province VARCHAR(100),
        postal_code VARCHAR(20),
        profile_image_url TEXT,
        
        -- Account status
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_business_reg ON users(business_reg_number);
      CREATE INDEX IF NOT EXISTS idx_users_nic ON users(nic_number);
    `;
    
    try {
      await pool.query(query);
      console.log('✅ Users table created successfully');
    } catch (error) {
      console.error('❌ Error creating users table:', error);
      throw error;
    }
  }

  // Create new user
  static async create(userData) {
    const { 
      firstName, lastName, username, email, phone, password, accountType,
      businessName, businessRegNumber, nicNumber, address, city, province, postalCode
    } = userData;
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const query = `
      INSERT INTO users (
        first_name, last_name, username, email, phone, password, role,
        business_name, business_reg_number, nic_number, address, city, province, postal_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, first_name, last_name, username, email, phone, role, 
                business_name, business_reg_number, nic_number, created_at
    `;
    
    const values = [
      firstName, lastName, username, email, phone || null, hashedPassword, accountType,
      businessName || null, businessRegNumber || null, nicNumber || null,
      address || null, city || null, province || null, postalCode || null
    ];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        // Unique violation
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
        if (error.constraint === 'users_username_key') {
          throw new Error('Username already exists');
        }
      }
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    
    try {
      const result = await pool.query(query, [email]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find user by username
  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    
    try {
      const result = await pool.query(query, [username]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find user by business registration number
  static async findByBusinessRegNumber(businessRegNumber) {
    const query = 'SELECT * FROM users WHERE business_reg_number = $1';
    
    try {
      const result = await pool.query(query, [businessRegNumber]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find user by NIC
  static async findByNIC(nicNumber) {
    const query = 'SELECT * FROM users WHERE nic_number = $1';
    
    try {
      const result = await pool.query(query, [nicNumber]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    const query = 'SELECT id, first_name, last_name, username, email, phone, role, created_at FROM users WHERE id = $1';
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update user
  static async update(id, updates) {
    const { firstName, lastName, phone } = updates;
    
    const query = `
      UPDATE users 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          phone = COALESCE($3, phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, first_name, last_name, username, email, phone, role, updated_at
    `;
    
    const values = [firstName, lastName, phone, id];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
