// Auth helpers

async function getSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    return session;
}

async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    return session;
}

async function requireAdmin() {
    const session = await requireAuth();
    if (!session) return null;
    const { data: member } = await _supabase
        .from('members').select('role').eq('id', session.user.id).single();
    if (!member || member.role !== 'admin') {
        window.location.href = '/dashboard.html';
        return null;
    }
    return session;
}

async function getCurrentMember() {
    const session = await getSession();
    if (!session) return null;
    const { data } = await _supabase
        .from('members').select('*').eq('id', session.user.id).single();
    return data;
}

async function signOut() {
    await _supabase.auth.signOut();
    window.location.href = '/login.html';
}

async function renderNavUser() {
    const member = await getCurrentMember();
    const el = document.getElementById('navUser');
    if (!el || !member) return;
    const roleBadge = member.role === 'admin'
        ? `<span style="margin-left:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-size:0.7em;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.5px;text-transform:uppercase">Admin</span>`
        : `<span style="margin-left:8px;background:#e9ecef;color:#6c757d;font-size:0.7em;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.5px;text-transform:uppercase">Member</span>`;
    el.innerHTML = `
        <span style="font-weight:600;color:#2c3e50">${member.name || member.email}</span>
        ${roleBadge}
        <button onclick="signOut()" style="margin-left:12px;background:none;border:1px solid #bdc3c7;
            padding:4px 14px;border-radius:20px;cursor:pointer;font-size:0.85em;color:#7f8c8d">
            Sign out
        </button>`;
}
