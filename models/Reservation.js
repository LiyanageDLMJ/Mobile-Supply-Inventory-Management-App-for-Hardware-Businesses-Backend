const pool = require('../config/database');

class Reservation {
  // Create reservations table (B2C - customers reserving items from shops)
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        reservation_number VARCHAR(50) UNIQUE NOT NULL,
        
        -- Parties involved
        customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        
        -- Reservation details
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        
        -- Status tracking
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        -- Pending, Accepted, Rejected, Completed, Cancelled, Expired
        
        -- Pickup details
        pickup_date DATE,
        pickup_time TIME,
        actual_pickup_date TIMESTAMP,
        
        -- Notes
        customer_notes TEXT,
        shop_notes TEXT,
        rejection_reason TEXT,
        
        -- Expiry (auto-cancel if not picked up)
        expires_at TIMESTAMP,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_shop ON reservations(shop_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
      CREATE INDEX IF NOT EXISTS idx_reservations_number ON reservations(reservation_number);
    `;
    
    try {
      await pool.query(query);
      console.log('✅ Reservations table created successfully');
    } catch (error) {
      console.error('❌ Error creating reservations table:', error);
      throw error;
    }
  }

  // Generate reservation number
  static generateReservationNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `RES-${timestamp}-${random}`;
  }

  // Create new reservation
  static async create(reservationData) {
    const {
      customerId, shopId, productId, quantity, unitPrice, totalAmount,
      pickupDate, pickupTime, customerNotes
    } = reservationData;

    const reservationNumber = this.generateReservationNumber();
    
    // Set expiry to 48 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const query = `
      INSERT INTO reservations (
        reservation_number, customer_id, shop_id, product_id, quantity,
        unit_price, total_amount, pickup_date, pickup_time, customer_notes, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      reservationNumber, customerId, shopId, productId, quantity,
      unitPrice, totalAmount, pickupDate || null, pickupTime || null,
      customerNotes || null, expiresAt
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating reservation:', error);
      throw error;
    }
  }

  // Get reservations by shop
  static async findByShopId(shopId, status = null) {
    let query = `
      SELECT r.*, 
             u.first_name || ' ' || u.last_name as customer_name,
             u.phone as customer_phone,
             p.product_name, p.image_url
      FROM reservations r
      JOIN users u ON r.customer_id = u.id
      JOIN products p ON r.product_id = p.id
      WHERE r.shop_id = $1
    `;
    
    const values = [shopId];
    
    if (status) {
      query += ' AND r.status = $2';
      values.push(status);
    }
    
    query += ' ORDER BY r.created_at DESC';

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error finding reservations:', error);
      throw error;
    }
  }

  // Get reservations by customer
  static async findByCustomerId(customerId) {
    const query = `
      SELECT r.*, 
             s.shop_name,
             p.product_name, p.image_url
      FROM reservations r
      JOIN shops s ON r.shop_id = s.id
      JOIN products p ON r.product_id = p.id
      WHERE r.customer_id = $1
      ORDER BY r.created_at DESC
    `;

    try {
      const result = await pool.query(query, [customerId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding customer reservations:', error);
      throw error;
    }
  }

  // Accept reservation
  static async accept(reservationId, shopNotes = null) {
    const query = `
      UPDATE reservations 
      SET status = 'Accepted', 
          shop_notes = $1, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    try {
      const result = await pool.query(query, [shopNotes, reservationId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error accepting reservation:', error);
      throw error;
    }
  }

  // Reject reservation
  static async reject(reservationId, rejectionReason) {
    const query = `
      UPDATE reservations 
      SET status = 'Rejected', 
          rejection_reason = $1, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    try {
      const result = await pool.query(query, [rejectionReason, reservationId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error rejecting reservation:', error);
      throw error;
    }
  }

  // Complete reservation (item picked up)
  static async complete(reservationId) {
    const query = `
      UPDATE reservations 
      SET status = 'Completed', 
          actual_pickup_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    try {
      const result = await pool.query(query, [reservationId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error completing reservation:', error);
      throw error;
    }
  }
}

module.exports = Reservation;
