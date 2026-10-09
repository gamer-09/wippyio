/*
 * © 2026 gamer-09. All rights reserved.
 * Admin dashboard — email/password login via Supabase Auth, read/update requests.
 */
(function () {
  'use strict';

  const cfg = window.WIPPY_CONFIG || {};
  const isConfigured =
    typeof cfg.supabaseUrl === 'string' && cfg.supabaseUrl.startsWith('http') &&
    typeof cfg.supabaseAnonKey === 'string' && cfg.supabaseAnonKey.length > 20;

  if (!isConfigured || !window.supabase || !window.supabase.createClient) {
    document.body.innerHTML =
      '<div style="max-width:560px;margin:18vh auto;padding:2rem;font-family:system-ui;text-align:center;color:#a0a0b8">' +
      '<h2 style="color:#f0f0f5">Admin not configured</h2>' +
      '<p>Add your Supabase URL and anon key to <code>supabase-config.js</code>. See SETUP.md.</p></div>';
    return;
  }

  // Memory-only session: the login never persists across page loads, so
  // leaving/navigating away/reloading automatically logs you out.
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // ---- DOM ----
  const $ = (s) => document.querySelector(s);
  const loginView = $('#adminLogin');
  const dashView = $('#adminDash');
  const loginForm = $('#loginForm');
  const loginStatus = $('#loginStatus');
  const loginBtn = $('#loginBtn');
  const logoutBtn = $('#adminLogout');
  const refreshBtn = $('#adminRefresh');
  const listEl = $('#adminList');
  const emptyEl = $('#adminEmpty');
  const statsEl = $('#adminStats');
  const searchEl = $('#adminSearch');
  const statusFilter = $('#adminStatusFilter');

  const STATUSES = ['new', 'reviewing', 'accepted', 'done', 'rejected'];
  let allRequests = [];
  let searchQuery = '';
  let statusValue = 'all';

  // ---- Theme ----
  function getPreferredTheme() {
    const saved = localStorage.getItem('portfolio-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('portfolio-theme', theme);
  }
  applyTheme(getPreferredTheme());
  $('#adminTheme').addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ---- Helpers ----
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escA(s) { return esc(s).replace(/'/g, '&#39;'); }
  function fmtDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  }

  // ---- Auth ----
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#adminEmail').value.trim();
    const password = $('#adminPassword').value;
    if (!email || !password) {
      loginStatus.textContent = 'Enter your email and password.';
      loginStatus.className = 'rf-status rf-status-error';
      return;
    }
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in…';
    loginStatus.textContent = '';
    const { error } = await client.auth.signInWithPassword({ email, password });
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log in';
    if (error) {
      loginStatus.textContent = error.message;
      loginStatus.className = 'rf-status rf-status-error';
    }
  });

  logoutBtn.addEventListener('click', () => client.auth.signOut());

  client.auth.onAuthStateChange((_event, session) => {
    showSession(session);
  });

  // Leaving the page (navigate away, close tab, reload) ends the session.
  window.addEventListener('pagehide', () => {
    try { client.auth.signOut(); } catch (e) { /* ignore */ }
  });
  // If restored from back/forward cache, force a clean (logged-out) load.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });

  function showSession(session) {
    const loggedIn = !!session;
    loginView.hidden = loggedIn;
    dashView.hidden = !loggedIn;
    logoutBtn.hidden = !loggedIn;
    refreshBtn.hidden = !loggedIn;
    if (loggedIn) {
      $('#adminPassword').value = '';
      loadRequests();
    }
  }

  // ---- Data ----
  async function loadRequests() {
    listEl.innerHTML = '<p class="admin-loading">Loading…</p>';
    const { data, error } = await client
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      listEl.innerHTML = '<p class="rf-status rf-status-error">Failed to load: ' + esc(error.message) + '</p>';
      return;
    }
    allRequests = data || [];
    renderStats();
    render();
  }

  refreshBtn.addEventListener('click', loadRequests);

  searchEl.addEventListener('input', () => {
    searchQuery = searchEl.value.trim().toLowerCase();
    render();
  });
  statusFilter.addEventListener('change', () => {
    statusValue = statusFilter.value;
    render();
  });

  function renderStats() {
    const counts = {};
    STATUSES.forEach((s) => (counts[s] = 0));
    allRequests.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    statsEl.innerHTML =
      '<div class="admin-stat"><span class="admin-stat-num">' + allRequests.length + '</span><span class="admin-stat-lbl">Total</span></div>' +
      '<div class="admin-stat admin-stat-new"><span class="admin-stat-num">' + counts.new + '</span><span class="admin-stat-lbl">New</span></div>' +
      '<div class="admin-stat"><span class="admin-stat-num">' + counts.accepted + '</span><span class="admin-stat-lbl">Accepted</span></div>' +
      '<div class="admin-stat admin-stat-done"><span class="admin-stat-num">' + counts.done + '</span><span class="admin-stat-lbl">Done</span></div>';
  }

  function render() {
    const filtered = allRequests.filter((r) => {
      if (statusValue !== 'all' && r.status !== statusValue) return false;
      if (searchQuery) {
        const hay = [r.name, r.title, r.description, r.scope, r.contact_method, r.contact_value, r.status]
          .join(' ').toLowerCase();
        return hay.includes(searchQuery);
      }
      return true;
    });

    emptyEl.hidden = filtered.length !== 0;
    listEl.innerHTML = filtered.map(cardHTML).join('');

    listEl.querySelectorAll('[data-status]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.status;
        const status = sel.value;
        sel.disabled = true;
        const { error } = await client.from('requests').update({ status }).eq('id', id);
        sel.disabled = false;
        if (error) { alert('Update failed: ' + error.message); return; }
        const req = allRequests.find((x) => x.id === id);
        if (req) req.status = status;
        renderStats();
      });
    });

    listEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.del;
        if (!confirm('Delete this request permanently?')) return;
        btn.disabled = true;
        const req = allRequests.find((x) => x.id === id);
        if (req && req.env_file_path) {
          await client.storage.from('request-env').remove([req.env_file_path]).catch(() => {});
        }
        const { error } = await client.from('requests').delete().eq('id', id);
        if (error) { alert('Delete failed: ' + error.message); btn.disabled = false; return; }
        allRequests = allRequests.filter((x) => x.id !== id);
        renderStats();
        render();
      });
    });

    listEl.querySelectorAll('[data-envfile]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const path = btn.dataset.envfile;
        const old = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Opening…';
        const { data, error } = await client.storage.from('request-env').createSignedUrl(path, 120);
        btn.disabled = false;
        btn.textContent = old;
        if (error) { alert('Could not open file: ' + error.message); return; }
        window.open(data.signedUrl, '_blank', 'noopener');
      });
    });

    listEl.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          const old = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => (btn.textContent = old), 1200);
        } catch { /* clipboard blocked */ }
      });
    });
  }

  function cardHTML(r) {
    const status = STATUSES.includes(r.status) ? r.status : 'new';
    const opts = STATUSES.map((s) =>
      '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + s[0].toUpperCase() + s.slice(1) + '</option>'
    ).join('');
    const flag = r.out_of_scope_flag ? '<span class="admin-flag">⚠︎ flagged</span>' : '';
    const aiBadge = r.uses_ai ? '<span class="admin-flag admin-flag-ai">🤖 AI</span>' : '';
    const contact = r.contact_method + ': ' + r.contact_value;

    let envHTML = '';
    if (r.uses_ai) {
      let inner = '<span class="admin-env-label">🔑 AI key</span>';
      if (r.env_file_path) {
        inner += '<button class="admin-mini" data-envfile="' + escA(r.env_file_path) + '">Download ' + esc(r.env_file_name || '.env') + '</button>';
      }
      if (r.env_content) {
        inner += '<button class="admin-mini" data-copy="' + escA(r.env_content) + '">Copy pasted key</button>';
      }
      if (!r.env_file_path && !r.env_content) {
        inner += '<span class="admin-env-missing">no key provided</span>';
      }
      envHTML = '<div class="admin-env">' + inner + '</div>';
    }

    return '<article class="admin-card" data-id="' + escA(r.id) + '">' +
      '<div class="admin-card-top">' +
        '<div>' +
          '<h3 class="admin-card-title">' + (r.title ? esc(r.title) : '(untitled)') + '</h3>' +
          '<div class="admin-card-meta">' +
            '<span>' + (r.name ? esc(r.name) : 'Anonymous') + '</span>' +
            '<span>·</span><span>' + esc(fmtDate(r.created_at)) + '</span>' +
            '<span>·</span><span class="admin-scope">' + esc(r.scope || '—') + '</span>' +
            aiBadge + flag +
          '</div>' +
        '</div>' +
        '<select class="admin-status admin-status-' + status + '" data-status="' + escA(r.id) + '">' + opts + '</select>' +
      '</div>' +
      '<p class="admin-card-desc">' + esc(r.description || '') + '</p>' +
      envHTML +
      '<div class="admin-card-foot">' +
        '<div class="admin-contact">' +
          '<span class="admin-contact-label">Contact</span>' +
          '<span class="admin-contact-value">' + esc(contact) + '</span>' +
          '<button class="admin-mini" data-copy="' + escA(r.contact_value || '') + '">Copy</button>' +
        '</div>' +
        '<button class="admin-mini admin-mini-danger" data-del="' + escA(r.id) + '">Delete</button>' +
      '</div>' +
    '</article>';
  }

  // ---- Boot ----
  client.auth.getSession().then(({ data }) => showSession(data.session));
})();
