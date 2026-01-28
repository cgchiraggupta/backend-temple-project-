// Supabase Client Configuration
const { createClient } = require('@supabase/supabase-js');

// Read from environment (server loads ../.env)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL in environment');
}
if (!/^https?:\/\//i.test(SUPABASE_URL)) {
  throw new Error('Invalid SUPABASE_URL: must start with http(s)://');
}
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

module.exports = { supabase };


