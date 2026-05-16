// Netlify function — FlightBoard lead intake + email notification
// POST /.netlify/functions/intakeAgent
// Public endpoint — no auth required.
// Env vars: RESEND_API_KEY, ADMIN_EMAIL

const ALLOWED_ORIGINS = [
    'https://flightboard.app',
    'https://www.flightboard.app',
    'http://localhost:8888',
    'http://localhost:3000'
];
const NETLIFY_PREVIEW_RE = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/;

function getCorsHeaders(event) {
    const origin  = event.headers?.origin || '';
    const allowed = (ALLOWED_ORIGINS.includes(origin) || NETLIFY_PREVIEW_RE.test(origin)) ? origin : '';
    return {
        'Access-Control-Allow-Origin':  allowed,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type':                 'application/json'
    };
}

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// ── Whitelist validation for dropdowns ──────────────────────────────────────
const MEMBERS_OPTS  = ['1–4', '5–15', '16–30', '31–50', '50+'];
const AIRCRAFT_OPTS = ['1', '2', '3', '4', '5+'];
const SOFTWARE_OPTS = ['Spreadsheets / email', 'AircraftClubs', 'FlightCircle', 'Coflyt', 'OpenFlyers', 'Nothing yet', 'Other'];

// ── Pre-written lead reply ──────────────────────────────────────────────────
function buildReplyText(firstName, club) {
    return `Hi ${firstName},

Thanks for reaching out about FlightBoard for ${club}! I'm glad you found us.

I set up and configure each club personally — it usually takes less than a day to get everything running. I'll be in touch within one business day to walk you through the setup and answer any questions you have.

Looking forward to getting ${club} off the ground on FlightBoard!

Manju | FlightBoard
hello@flightboard.app`;
}

// ── Resend email helper ─────────────────────────────────────────────────────
async function sendEmail({ apiKey, from, to, subject, html }) {
    const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ from, to, subject, html })
    });
    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Resend ${res.status}: ${err}`);
    }
    return res.json();
}

// ── Email HTML: personalized response to lead ───────────────────────────────
function buildLeadHtml(replyText) {
    const bodyHtml = replyText
        .split(/\n{2,}/)
        .map(p => `<p style="margin:0 0 16px;line-height:1.7">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:'Open Sans',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0C1F14,#0D2030);padding:26px 32px;text-align:center">
      <span style="font-family:Arial,sans-serif;font-weight:900;font-size:1.35em;color:#fff;letter-spacing:0.5px">
        Flight<span style="color:#5BB8E8">Board</span>
      </span>
    </div>
    <div style="padding:32px 36px;color:#1E293B;font-size:0.95em">
      ${bodyHtml}
    </div>
    <div style="padding:18px 36px 26px;border-top:1px solid #E2E8F0;font-size:0.78em;color:#94A3B8;text-align:center">
      FlightBoard · hello@flightboard.app ·
      <a href="https://flightboard.app" style="color:#5BB8E8;text-decoration:none">flightboard.app</a>
    </div>
  </div>
</body></html>`;
}

// ── Email HTML: lead notification to admin ──────────────────────────────────
function buildAdminHtml(data, aiPreview) {
    const f = {
        name:     esc(data.name),
        club:     esc(data.club),
        email:    esc(data.email),
        members:  esc(data.members  || '—'),
        aircraft: esc(data.aircraft || '—'),
        software: esc(data.software || '—'),
        message:  esc(data.message  || '(none)'),
        preview:  esc(aiPreview.slice(0, 350)) + (aiPreview.length > 350 ? '…' : '')
    };
    const row = (label, val, shaded) =>
        `<tr style="${shaded ? 'background:#F8FAFC' : ''}">
           <td style="padding:9px 8px;width:140px;color:#64748B;font-weight:600;font-size:0.88em">${label}</td>
           <td style="padding:9px 8px;font-size:0.9em">${val}</td>
         </tr>`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,sans-serif">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.07)">
    <div style="background:#0C1F14;padding:20px 28px">
      <p style="margin:0;color:#5BB8E8;font-weight:700;font-size:1em">✈️ New FlightBoard Lead</p>
    </div>
    <div style="padding:28px;color:#1E293B">
      <table style="width:100%;border-collapse:collapse">
        ${row('Name',     f.name,     false)}
        ${row('Club',     f.club,     true)}
        ${row('Email',    `<a href="mailto:${f.email}" style="color:#2A7A52">${f.email}</a>`, false)}
        ${row('Members',  f.members,  true)}
        ${row('Aircraft', f.aircraft, false)}
        ${row('Software', f.software, true)}
      </table>
      <div style="margin-top:16px;padding:14px;background:#F8FAFC;border-radius:8px;border-left:3px solid #5BB8E8">
        <p style="margin:0 0 6px;font-weight:700;color:#64748B;font-size:0.82em">MESSAGE</p>
        <p style="margin:0;font-size:0.9em;white-space:pre-wrap">${f.message}</p>
      </div>
      <div style="margin-top:14px;padding:14px;background:#F0FDF4;border-radius:8px;border-left:3px solid #2A7A52">
        <p style="margin:0 0 6px;font-weight:700;color:#64748B;font-size:0.82em">REPLY SENT TO LEAD</p>
        <p style="margin:0;font-size:0.88em;color:#374151">${f.preview}</p>
      </div>
    </div>
  </div>
</body></html>`;
}

// ── Main handler ────────────────────────────────────────────────────────────
export const handler = async (event) => {
    const cors = getCorsHeaders(event);

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
    if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const ADMIN_EMAIL   = process.env.ADMIN_EMAIL;

    if (!RESEND_API_KEY || !ADMIN_EMAIL) {
        console.error('[intakeAgent] Missing env vars');
        return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Server not configured' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    // ── Honeypot — silent success for bots ──
    if (body.website && body.website.trim() !== '') {
        console.log('[intakeAgent] Honeypot triggered');
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }

    // ── Validate required fields ──
    const name  = (body.name  || '').trim();
    const club  = (body.club  || '').trim();
    const email = (body.email || '').trim().toLowerCase();

    if (!name  || name.length > 100)  return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Name required (max 100 chars)' }) };
    if (!club  || club.length > 120)  return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Club name required (max 120 chars)' }) };
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Valid email required' }) };

    // ── Validate optional dropdowns against whitelists ──
    const members  = body.members  || '';
    const aircraft = body.aircraft || '';
    const software = body.software || '';
    const message  = (body.message || '').trim();

    if (members  && !MEMBERS_OPTS.includes(members))   return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid members value' }) };
    if (aircraft && !AIRCRAFT_OPTS.includes(aircraft)) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid aircraft value' }) };
    if (software && !SOFTWARE_OPTS.includes(software)) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid software value' }) };
    if (message.length > 1000) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Message too long (1000 char max)' }) };

    const data      = { name, club, email, members, aircraft, software, message };
    const firstName = name.split(/\s+/)[0];
    const replyText = buildReplyText(firstName, club);

    // ── Send both emails concurrently ────────────────────────────────────────
    const FROM = 'FlightBoard <hello@pnwav8r.com>';

    const results = await Promise.allSettled([
        sendEmail({
            apiKey:  RESEND_API_KEY,
            from:    FROM,
            to:      [email],
            subject: `Hi ${firstName} — let's get ${club} set up on FlightBoard`,
            html:    buildLeadHtml(replyText)
        }),
        sendEmail({
            apiKey:  RESEND_API_KEY,
            from:    FROM,
            to:      [ADMIN_EMAIL],
            subject: `✈️ New lead: ${name} — ${club}`,
            html:    buildAdminHtml(data, replyText)
        })
    ]);

    results.forEach((r, i) => {
        if (r.status === 'rejected')
            console.error(`[intakeAgent] ${i === 0 ? 'lead' : 'admin'} email failed:`, r.reason?.message);
    });

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
};
