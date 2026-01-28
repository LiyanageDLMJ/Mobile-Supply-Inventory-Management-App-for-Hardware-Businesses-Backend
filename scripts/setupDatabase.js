const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const pool = require('../config/database');
require('dotenv').config();

async function setupDatabase() {
  console.log('🔧 Setting up database...\n');

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Create tables in order (respecting foreign key dependencies)
    console.log('📋 Creating users table...');
    await User.createTable();
    
    console.log('📋 Creating shops table...');
    await Shop.createTable();
    
    console.log('📋 Creating products table...');
    await Product.createTable();
    
    console.log('📋 Creating suppliers table...');
    await Supplier.createTable();
    
    console.log('📋 Creating supplier catalog table...');
    await Supplier.createCatalogTable();
    
    console.log('📋 Creating orders table...');
    await Order.createTable();
    
    console.log('📋 Creating order items table...');
    await Order.createOrderItemsTable();
    
    console.log('📋 Creating reservations table...');
    await Reservation.createTable();
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('📊 Created tables: users, shops, products, suppliers, supplier_catalog, orders, order_items, reservations');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
