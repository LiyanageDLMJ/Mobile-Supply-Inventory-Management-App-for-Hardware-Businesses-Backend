const supabase = require('../config/supabase');
require('dotenv').config();

async function addLocationColumns() {
  console.log('🌍 Adding location columns to shops and suppliers...\n');

  try {
    // Add location columns to shops table
    console.log('📍 Adding latitude/longitude to shops table...');
    const { error: shopsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE shops
        ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
        ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
      `
    });

    if (shopsError && !shopsError.message.includes('already exists')) {
      throw shopsError;
    }
    console.log('✅ Shops table updated\n');

    // Add location columns to suppliers table
    console.log('📍 Adding latitude/longitude to suppliers table...');
    const { error: suppliersError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
        ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
      `
    });

    if (suppliersError && !suppliersError.message.includes('already exists')) {
      throw suppliersError;
    }
    console.log('✅ Suppliers table updated\n');

    console.log('🎉 Location columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add location columns:', error.message);
    console.log('\n📝 Alternative: Run this SQL directly in Supabase SQL Editor:');
    console.log(`
ALTER TABLE shops ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8), ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8), ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
    `);
    process.exit(1);
  }
}

addLocationColumns();
