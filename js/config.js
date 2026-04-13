// ─────────────────────────────────────────────
//  PNWAV8R — Supabase Configuration
//  Replace the two values below with your
//  Project URL and anon key from:
//  Supabase → Settings → API
// ─────────────────────────────────────────────

const SUPABASE_URL  = 'https://afwlrszavjyvskpousmy.supabase.co';
const SUPABASE_ANON = 'sb_publishable_DaOo8-TzLwJIEbtGsQtx3Q_nEF6Rx7a';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Airplane ID — N7798E (set after first DB insert, or look up by tail number)
const AIRPLANE_TAIL = 'N7798E';
