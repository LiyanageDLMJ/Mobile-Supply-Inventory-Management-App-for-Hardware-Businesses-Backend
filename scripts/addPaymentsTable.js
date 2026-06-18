const pool = require('../config/database');
require('dotenv').config();

async function migrate() {
  try {
    // Add payment_intent_id column to orders if it doesn't exist
    await pool.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255)
    `);
    console.log('✅ payment_intent_id column added to orders');

    // Create payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'LKR',
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments(payment_intent_id);
    `);
    console.log('✅ Payments table created');

    console.log('✅ Migration complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
