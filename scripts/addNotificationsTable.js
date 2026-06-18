require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

async function run(client, sql, label) {
  await client.query(sql);
  console.log('✅', label);
}

async function migrate() {
  const client = await pool.connect();
  try {
    await run(client,
      `CREATE TABLE IF NOT EXISTS notifications (
         id SERIAL PRIMARY KEY,
         user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         type VARCHAR(50) NOT NULL,
         title VARCHAR(255) NOT NULL,
         message TEXT NOT NULL,
         is_read BOOLEAN DEFAULT FALSE,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`,
      'notifications table'
    );

    await run(client,
      `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
      'notifications index'
    );

    await run(client,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0`,
      'loyalty_points column'
    );

    await run(client,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(50) DEFAULT 'Bronze'`,
      'loyalty_tier column'
    );

    console.log('✅ All migrations complete');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

migrate();
