// ─────────────────────────────────────────────
//  Auth helpers — shared across all club pages
// ─────────────────────────────────────────────

// Wait for Supabase to resolve the session (handles magic link hash in URL)
function getSession() {
    return new Promise((resolve) => {
        _supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) { resolve(session); return; }

            // No session yet — wait for SIGNED_IN event (INITIAL_SESSION with null must be ignored)
            const { data: { subscription } } = _supabase.auth.onAuthStateChange((event, session) => {
                if (session) {
                    subscription.unsubscribe();
                    resolve(session);
                }
                // Don't resolve null here — INITIAL_SESSION fires with null before storage loads
            });

            // Fallback: if no session established in 5 seconds, resolve null
            setTimeout(() => { subscription.unsubscribe(); resolve(null); }, 5000);
        });
    });
}

// Redirect to login if no active session
async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    return session;
}

// Redirect to dashboard if not admin
async function requireAdmin() {
    const session = await requireAuth();
    if (!session) return null;
    const { data: member } = await _supabase
        .from('members')
        .select('role')
        .eq('id', session.user.id)
        .single();
    if (!member || member.role !== 'admin') {
        window.location.href = '/dashboard.html';
        return null;
    }
    return session;
}

// Get the current member's full record
async function getCurrentMember() {
    const session = await getSession();
    if (!session) return null;
    const { data } = await _supabase
        .from('members')
        .select('*')
        .eq('id', session.user.id)
        .single();
    return data;
}

// Sign out
async function signOut() {
    await _supabase.auth.signOut();
    window.location.href = '/login.html';
}

// Render nav user pill
async function renderNavUser() {
    const member = await getCurrentMember();
    const el = document.getElementById('navUser');
    if (!el || !member) return;
    el.innerHTML = `
        <span style="font-weight:600;color:#2c3e50">${member.name || member.email}</span>
        <button onclick="signOut()" style="margin-left:12px;background:none;border:1px solid #bdc3c7;
            padding:4px 14px;border-radius:20px;cursor:pointer;font-size:0.85em;color:#7f8c8d">
            Sign out
        </button>`;
}
