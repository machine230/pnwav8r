// Auth helpers

// ── Security: HTML escaping to prevent XSS ──────────────────────────────────
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// ── Role helpers ─────────────────────────────────────────────────────────────
function isAdmin(member)     { return member?.role === 'admin'; }
function isAP(member)        { return member?.role === 'ap'; }
function isAdminOrAP(member) { return isAdmin(member) || isAP(member); }

// ── Auth ─────────────────────────────────────────────────────────────────────
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

async function requireAdminOrAP() {
    const session = await requireAuth();
    if (!session) return null;
    const { data: member } = await _supabase
        .from('members').select('role').eq('id', session.user.id).single();
    if (!member || !['admin','ap'].includes(member.role)) {
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
    window.location.href = '/index.html';
}

async function renderNavUser() {
    const member = await getCurrentMember();
    const el = document.getElementById('navUser');
    if (!el || !member) return;

    const roleStyles = {
        admin:  'background:linear-gradient(135deg,#667eea,#764ba2);color:white',
        ap:     'background:linear-gradient(135deg,#e67e22,#d35400);color:white',
        member: 'background:#e9ecef;color:#6c757d'
    };
    const roleLabels = { admin:'Admin', ap:'A&P', member:'Member' };
    const badgeStyle = roleStyles[member.role] || roleStyles.member;
    const badgeLabel = roleLabels[member.role] || 'Member';

    el.innerHTML = '';

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-weight:600;color:#2c3e50';
    nameSpan.textContent = member.name || member.email;

    const badgeSpan = document.createElement('span');
    badgeSpan.setAttribute('style', `margin-left:8px;${badgeStyle};font-size:0.7em;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.5px;text-transform:uppercase`);
    badgeSpan.textContent = badgeLabel;

    const signOutBtn = document.createElement('button');
    signOutBtn.setAttribute('style', 'margin-left:12px;background:none;border:1px solid #bdc3c7;padding:4px 14px;border-radius:20px;cursor:pointer;font-size:0.85em;color:#7f8c8d');
    signOutBtn.textContent = 'Sign out';
    signOutBtn.onclick = signOut;

    el.appendChild(nameSpan);
    el.appendChild(badgeSpan);
    el.appendChild(signOutBtn);
}
