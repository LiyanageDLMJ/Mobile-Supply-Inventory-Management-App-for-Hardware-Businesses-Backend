const pool = require('../config/database');

async function checkTables() {
  try {
    console.log('📋 Checking existing database tables...\n');
    
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname='public' 
      ORDER BY tablename
    `);
    
    console.log('✅ Existing tables:');
    if (result.rows.length === 0) {
      console.log('   ⚠️  No tables found!');
    } else {
      result.rows.forEach(row => {
        console.log(`   - ${row.tablename}`);
      });
    }
    
    console.log('\n📊 Expected tables for the system:');
    const expectedTables = [
      'users',
      'shops',
      'products',
      'suppliers',
      'supplier_catalog',
      'orders',
      'order_items',
      'reservations'
    ];
    
    const existingTableNames = result.rows.map(r => r.tablename);
    expectedTables.forEach(table => {
      const exists = existingTableNames.includes(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkTables();
