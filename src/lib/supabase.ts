import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  );
}

// NOTE: Untyped client (no <Database> generic). The strict generic schema
// constraints in postgrest-js 2.106+ are hard to satisfy with handwritten
// types. To get autocomplete back, install the Supabase CLI and run:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
// then re-add the <Database> generic below.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
