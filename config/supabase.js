const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Database access happens only on this Express server. Prefer a server-only
// key so protected tables can keep RLS enabled. SUPABASE_KEY is retained only
// as a compatibility fallback for older local setups.
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️  SUPABASE_URL or SUPABASE_KEY not set in .env');
}

if (supabaseKey?.startsWith('sb_publishable_')) {
  console.warn(
    'WARNING: Backend is using a publishable Supabase key. ' +
    'Set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) for server database access.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
module.exports = supabase;
