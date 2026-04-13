// Netlify function — sends email to admin when a squawk is reported
// Requires RESEND_API_KEY and ADMIN_EMAIL environment variables in Netlify

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;

    if (!RESEND_API_KEY || !ADMIN_EMAIL) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, skipped: 'Email not configured' }) };
    }

    const { description, reporter, go_no_go, tail } = JSON.parse(event.body || '{}');

    const goNoGoLabel = { go: '✅ GO — Safe to fly', no_go: '🛑 NO-GO — Recommend grounding', caution: '⚠️ CAUTION — Use judgement' };
    const label = goNoGoLabel[go_no_go] || 'Not specified';

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from:    'PNWAV8R <onboarding@resend.dev>',
            to:      [ADMIN_EMAIL],
            subject: `🛩️ New Squawk Reported — ${tail}`,
            html:    `
                <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
                    <h2 style="color:#2c3e50">New Squawk — ${tail}</h2>
                    <p><strong>Reported by:</strong> ${reporter || 'Unknown'}</p>
                    <p><strong>Description:</strong><br>${description}</p>
                    <p><strong>Pilot recommendation:</strong><br>${label}</p>
                    <hr>
                    <a href="https://pnwav8r.com/admin.html" style="background:#667eea;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">
                        View in Admin Panel
                    </a>
                </div>`
        })
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: res.ok }) };
};
