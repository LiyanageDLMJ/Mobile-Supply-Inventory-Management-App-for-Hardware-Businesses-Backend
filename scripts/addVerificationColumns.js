// Verifies that the verification columns exist on the users table.
// The actual ALTER TABLE statements must be run via Supabase Studio
// SQL Editor (see scripts/verification_migration.sql) — the supabase-js
// client cannot execute DDL.
//
// Usage: node scripts/addVerificationColumns.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

async function check() {
  console.log('🔎 Checking verification columns on users table...\n');

  const { data, error } = await supabase
    .from('users')
    .select('id, verification_status, verification_docs, rejection_reason, submitted_at, verified_at, verified_by')
    .limit(1);

  if (error) {
    console.error('❌ Verification columns are NOT present on users table.');
    console.error('   Error:', error.message);
    console.log('\n📋 To add them, open Supabase Studio → SQL Editor → paste & run:\n');
    const sql = fs.readFileSync(path.join(__dirname, 'verification_migration.sql'), 'utf8');
    console.log(sql);
    process.exit(1);
  }

  console.log('✅ Verification columns are present.');
  console.log('   Sample row:', data && data[0] ? data[0] : '(table empty)');
  process.exit(0);
}

check();
