// ─────────────────────────────────────────────
//  Auth helpers — shared across all club pages
// ─────────────────────────────────────────────

// Redirect to login if no active session
async function requireAuth() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    return session;
}

// Redirect to login if no active session AND not admin
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
    const { data: { session } } = await _supabase.auth.getSession();
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
        <span style="font-weight:600;color:#2c3e50">${member.name}</span>
        <button onclick="signOut()" style="margin-left:12px;background:none;border:1px solid #bdc3c7;
            padding:4px 14px;border-radius:20px;cursor:pointer;font-size:0.85em;color:#7f8c8d">
            Sign out
        </button>`;
}
