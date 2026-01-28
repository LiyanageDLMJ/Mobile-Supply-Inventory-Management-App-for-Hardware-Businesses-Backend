const pool = require('../config/database');
require('dotenv').config();

async function migrateUserTable() {
  console.log('🔄 Migrating users table to add new columns...\n');

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Add new columns to users table
    console.log('📋 Adding business verification columns...');
    
    const alterTableQuery = `
      -- Add business_name column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='business_name') THEN
          ALTER TABLE users ADD COLUMN business_name VARCHAR(255);
        END IF;
      END $$;

      -- Add business_reg_number column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='business_reg_number') THEN
          ALTER TABLE users ADD COLUMN business_reg_number VARCHAR(100) UNIQUE;
        END IF;
      END $$;

      -- Add nic_number column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='nic_number') THEN
          ALTER TABLE users ADD COLUMN nic_number VARCHAR(20) UNIQUE;
        END IF;
      END $$;

      -- Add address column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='address') THEN
          ALTER TABLE users ADD COLUMN address TEXT;
        END IF;
      END $$;

      -- Add city column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='city') THEN
          ALTER TABLE users ADD COLUMN city VARCHAR(100);
        END IF;
      END $$;

      -- Add province column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='province') THEN
          ALTER TABLE users ADD COLUMN province VARCHAR(100);
        END IF;
      END $$;

      -- Add postal_code column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='postal_code') THEN
          ALTER TABLE users ADD COLUMN postal_code VARCHAR(20);
        END IF;
      END $$;

      -- Add profile_image_url column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='profile_image_url') THEN
          ALTER TABLE users ADD COLUMN profile_image_url TEXT;
        END IF;
      END $$;

      -- Add is_verified column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='is_verified') THEN
          ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;

      -- Add is_active column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='is_active') THEN
          ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        END IF;
      END $$;
    `;

    await pool.query(alterTableQuery);
    console.log('✅ Users table migration completed successfully!\n');

    // Create indexes if they don't exist
    console.log('📋 Creating indexes...');
    
    const indexQuery = `
      CREATE INDEX IF NOT EXISTS idx_users_business_reg ON users(business_reg_number);
      CREATE INDEX IF NOT EXISTS idx_users_nic ON users(nic_number);
    `;

    await pool.query(indexQuery);
    console.log('✅ Indexes created successfully!\n');

    // Display updated table structure
    console.log('📊 Verifying table structure...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    console.log('\n✅ Current users table structure:');
    console.table(result.rows);

    console.log('\n🎉 Migration completed successfully!');
    console.log('You can now register users with business verification fields.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateUserTable();
