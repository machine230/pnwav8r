// Netlify serverless function — invites a new club member via Supabase Auth
// Requires environment variables (set in Netlify dashboard):
//   SUPABASE_URL            — Supabase project URL
//   SUPABASE_SERVICE_ROLE   — Supabase → Settings → API → service_role secret key
//   SITE_URL                — e.g. https://pnwav8r.com (used for invite redirect URL)

import { createClient } from '@supabase/supabase-js';

// Only requests bearing a valid Supabase JWT from an admin member are allowed.
// We verify this by initialising a per-request client with the caller's JWT
// and checking their role in the members table.

const ALLOWED_ORIGINS = [
    'https://pnwav8r.com',
    'https://www.pnwav8r.com',
    'http://localhost:8888',
    'http://localhost:3000'
];
const NETLIFY_PREVIEW_RE = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/;

function corsHeaders(event) {
    const origin = event.headers?.origin || '';
    const ok = ALLOWED_ORIGINS.includes(origin) || NETLIFY_PREVIEW_RE.test(origin);
    return {
        'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
}

export const handler = async (event) => {
    const cors = corsHeaders(event);

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
    if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

    // ── Env checks ──
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
    const supabaseUrl = process.env.SUPABASE_URL;
    const siteUrl     = process.env.SITE_URL || 'https://pnwav8r.netlify.app';

    if (!serviceRole || !supabaseUrl) {
        return { statusCode: 500, headers: cors,
            body: JSON.stringify({ error: 'Server not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE env vars in Netlify.' }) };
    }

    // ── Service role client (elevated — only used server-side) ──
    const admin = createClient(supabaseUrl, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    // ── Verify caller is an admin using their JWT ──
    const authHeader = event.headers?.authorization || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!jwt) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Not authenticated' }) };

    // Validate the JWT by calling the Supabase auth REST endpoint directly.
    // SDK-based approaches (auth.getUser / user-context client) have unreliable
    // behaviour server-side with a service-role client, so we call the endpoint raw.
    const anonKey = process.env.SUPABASE_ANON_KEY || serviceRole;
    let userId;
    try {
        const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${jwt}`,
                'apikey': anonKey
            }
        });
        if (!authRes.ok) {
            const body = await authRes.text();
            console.error('[inviteMember] auth/v1/user error:', authRes.status, body);
            return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Invalid session' }) };
        }
        const userData = await authRes.json();
        userId = userData?.id;
    } catch (e) {
        console.error('[inviteMember] fetch auth error:', e?.message || e);
        return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Auth check failed' }) };
    }
    if (!userId) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Invalid session' }) };

    const { data: callerMember } = await admin
        .from('members').select('role').eq('id', userId).single();
    if (callerMember?.role !== 'admin') {
        return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    // ── Parse body ──
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const name  = (body.name  || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const phone = (body.phone || '').trim() || null;
    const role  = ['member', 'ap', 'admin'].includes(body.role) ? body.role : 'member';

    if (!name  || name.length < 2 || name.length > 100)       return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Name must be 2–100 characters' }) };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Valid email required' }) };

    // 1. Upsert member record (create or update)
    const { error: dbErr } = await admin.from('members').upsert(
        { name, email, phone, role, membership_active: true, pic_status: false },
        { onConflict: 'email' }
    );
    if (dbErr) {
        console.error('[inviteMember] DB error:', dbErr);
        return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Failed to save member: ' + dbErr.message }) };
    }

    // 2. Send Supabase invite email
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth-callback.html`,
        data: { name }
    });

    if (inviteErr) {
        // Member already has an auth account — not a failure, just notify
        if (inviteErr.message?.includes('already been registered')) {
            return { statusCode: 200, headers: cors,
                body: JSON.stringify({ ok: true, alreadyExists: true,
                    message: `${name} already has an account. Member record updated.` }) };
        }
        console.error('[inviteMember] Auth invite error:', inviteErr);
        return { statusCode: 500, headers: cors,
            body: JSON.stringify({ error: 'Member record saved but invite email failed: ' + inviteErr.message }) };
    }

    return { statusCode: 200, headers: cors,
        body: JSON.stringify({ ok: true, message: `Invite sent to ${email}. They'll receive an email to set their password and log in.` }) };
};
