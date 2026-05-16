// Netlify function — FlightBoard lead intake + AI personalized response
// POST /.netlify/functions/intakeAgent
// Public endpoint — no auth required.
// Env vars: ANTHROPIC_API_KEY, RESEND_API_KEY, ADMIN_EMAIL, SITE_URL

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

// ── Claude system prompt ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Manju, the founder of FlightBoard — a modern, affordable flight club management platform built specifically for small flying clubs.

Your job is to write a warm, personal, conversational reply to someone who just filled out our early-access request form. You are a pilot and aviation enthusiast yourself, so you "get it."

Your reply should:
- Open by addressing them by first name warmly (e.g. "Hi Sarah,")
- Acknowledge the specific details they shared (club name, members, aircraft count, current software) — make it feel like you read their form carefully, not a template
- Speak naturally and briefly about how FlightBoard directly addresses their situation (1–2 specific sentences, not a feature list)
- Mention that you personally set up each club and will reach out within one business day to get them onboarded
- Close with genuine enthusiasm and a light aviation touch
- Sign off as:
  Manju | FlightBoard
  hello@flightboard.app

Tone: warm, direct, knowledgeable, not salesy. Like a message from a founder who genuinely cares — not a marketing email.
Length: 4–6 short paragraphs maximum. No bullet lists.
Do NOT include a subject line. Do NOT start with "Subject:". Output only the email body.`;

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
function buildLeadHtml(aiText) {
    const bodyHtml = aiText
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
        <p style="margin:0 0 6px;font-weight:700;color:#64748B;font-size:0.82em">CLAUDE RESPONSE SENT TO LEAD</p>
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

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const RESEND_API_KEY    = process.env.RESEND_API_KEY;
    const ADMIN_EMAIL       = process.env.ADMIN_EMAIL;

    if (!ANTHROPIC_API_KEY || !RESEND_API_KEY || !ADMIN_EMAIL) {
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

    const data = { name, club, email, members, aircraft, software, message };
    const firstName = name.split(/\s+/)[0];

    // ── Call Claude API ──────────────────────────────────────────────────────
    let aiText = '';
    try {
        const userPrompt = `Write a personalized early-access reply to this lead:

Name: ${name}
Club: ${club}
Members: ${members || 'not specified'}
Aircraft: ${aircraft || 'not specified'}
Current software: ${software || 'not specified'}
Their message: ${message || '(none provided)'}

Reply as Manju, founder of FlightBoard.`;

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method:  'POST',
            headers: {
                'x-api-key':         ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type':      'application/json'
            },
            body: JSON.stringify({
                model:    'claude-3-5-haiku-20241022',
                max_tokens: 500,
                system:   SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userPrompt }]
            })
        });

        if (!claudeRes.ok) throw new Error(`Claude API ${claudeRes.status}`);
        const claudeData = await claudeRes.json();
        aiText = claudeData?.content?.[0]?.text || '';
        if (!aiText) throw new Error('Empty Claude response');

    } catch (e) {
        console.error('[intakeAgent] Claude error:', e?.message);
        // Fallback — lead still gets a reply
        aiText = `Hi ${firstName},\n\nThank you for reaching out about FlightBoard for ${club}! We received your request and I'll be in touch personally within one business day to walk you through the setup — it takes less than a day to get your club flying.\n\nLooking forward to connecting!\n\nManju | FlightBoard\nhello@flightboard.app`;
    }

    // ── Send both emails concurrently ────────────────────────────────────────
    const FROM = 'FlightBoard <onboarding@resend.dev>';

    const results = await Promise.allSettled([
        sendEmail({
            apiKey:  RESEND_API_KEY,
            from:    FROM,
            to:      [email],
            subject: `Hi ${firstName} — let's get ${club} set up on FlightBoard`,
            html:    buildLeadHtml(aiText)
        }),
        sendEmail({
            apiKey:  RESEND_API_KEY,
            from:    FROM,
            to:      [ADMIN_EMAIL],
            subject: `✈️ New lead: ${name} — ${club}`,
            html:    buildAdminHtml(data, aiText)
        })
    ]);

    results.forEach((r, i) => {
        if (r.status === 'rejected')
            console.error(`[intakeAgent] ${i === 0 ? 'lead' : 'admin'} email failed:`, r.reason?.message);
    });

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
};
