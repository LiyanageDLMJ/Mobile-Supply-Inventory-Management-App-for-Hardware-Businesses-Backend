// Seeds (creates or updates) the single admin user.
// Reads ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME, ADMIN_FIRST_NAME,
// ADMIN_LAST_NAME from .env.
//
// Usage:
//   node scripts/seedAdmin.js
//
// Re-running this script with the same email will reset the admin
// password to the value in .env — handy if you forget it.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const firstName = process.env.ADMIN_FIRST_NAME || 'System';
  const lastName = process.env.ADMIN_LAST_NAME || 'Admin';

  if (!email || !password) {
    console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('❌ ADMIN_PASSWORD must be at least 6 characters');
    process.exit(1);
  }

  console.log(`🔧 Seeding admin user: ${email} (${username})\n`);

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  // Check existing
  const { data: existing, error: findErr } = await supabase
    .from('users').select('id, role').eq('email', email).maybeSingle();

  if (findErr) {
    console.error('❌ Lookup failed:', findErr.message);
    process.exit(1);
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from('users')
      .update({
        password: hashed,
        role: 'ADMIN',
        verification_status: 'VERIFIED',
        username,
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updErr) {
      console.error('❌ Update failed:', updErr.message);
      process.exit(1);
    }
    console.log(`✅ Existing user (id ${existing.id}) promoted to ADMIN and password reset.`);
  } else {
    const { data, error: insErr } = await supabase.from('users').insert({
      first_name: firstName,
      last_name: lastName,
      username,
      email,
      password: hashed,
      role: 'ADMIN',
      verification_status: 'VERIFIED',
    }).select('id').single();

    if (insErr) {
      console.error('❌ Insert failed:', insErr.message);
      if (insErr.message && insErr.message.includes('verification_status')) {
        console.error('   → It looks like the verification migration has NOT been run yet.');
        console.error('   → Run scripts/verification_migration.sql in Supabase SQL Editor first.');
      }
      process.exit(1);
    }
    console.log(`✅ Admin created (id ${data.id}).`);
  }

  console.log('\n👤 Login with:');
  console.log(`    email:    ${email}`);
  console.log(`    password: (the ADMIN_PASSWORD value from .env)`);
  console.log('\n💡 On the login screen pick any role — the backend recognises admins by their stored role.');
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
