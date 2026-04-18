// ─────────────────────────────────────────────────────────────
//  Club Configuration — edit this file for each new deployment
// ─────────────────────────────────────────────────────────────

const CLUB = {
  name:    'PNWAV8R Flying Club',
  short:   'PNWAV8R',           // nav logo text (before the span)
  span:    'AV8R',              // nav logo span text (accent color)
  airport: 'KBFI',             // home airport ICAO — used for weather
  aircraft: [
    { tail: 'N7798E', type: 'Cessna 150', year: 1959, rate: 65 }
  ]
};

// Supabase — Supabase → Settings → API
const SUPABASE_URL  = 'https://afwlrszavjyvskpousmy.supabase.co';
const SUPABASE_ANON = 'sb_publishable_DaOo8-TzLwJIEbtGsQtx3Q_nEF6Rx7a';

// Convenience shim — primary aircraft tail (used in queries throughout the app)
const AIRPLANE_TAIL = CLUB.aircraft[0].tail;
