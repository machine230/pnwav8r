// ─────────────────────────────────────────────
//  PNWAV8R — Supabase Configuration
//  Replace the two values below with your
//  Project URL and anon key from:
//  Supabase → Settings → API
// ─────────────────────────────────────────────

const SUPABASE_URL  = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Airplane ID — N7798E (set after first DB insert, or look up by tail number)
const AIRPLANE_TAIL = 'N7798E';
