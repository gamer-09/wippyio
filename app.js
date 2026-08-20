/* ==========================================================================
   Portfolio Hub — Client Logic
   ========================================================================== */

(function () {
  'use strict';

  // ---- State ----
  let allProjects = [];
  let activeFilter = 'all';
  let searchQuery = '';

  // ---- DOM refs ----
  const grid = document.getElementById('projectGrid');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const statsBar = document.getElementById('statsBar');
  const popupOverlay = document.getElementById('popupOverlay');
  const popupBody = document.getElementById('popupBody');
  const popupClose = document.getElementById('popupClose');
  const themeToggle = document.getElementById('themeToggle');

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

  // Apply immediately to avoid flash
  applyTheme(getPreferredTheme());

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  // ---- Init ----
  loadProjects();

  // ---- Event listeners ----
  searchInput.addEventListener('input', debounce(() => {
    searchQuery = searchInput.value.trim().toLowerCase();
    render();
  }, 200));

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  popupClose.addEventListener('click', closePopup);
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) closePopup();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopup();
  });

  // ---- Data Loading ----
  async function loadProjects() {
    try {
      const res = await fetch('data/projects.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const db = await res.json();
      allProjects = Array.isArray(db.projects) ? db.projects : [];
    } catch (err) {
      console.error('Failed to load projects:', err);
      allProjects = [];
    }
    render();
  }

  // ---- Rendering ----
  function render() {
    const filtered = allProjects.filter((p) => {
      // Completion filter
      if (activeFilter === 'completed' && p.completionStatus !== 'completed') return false;
      if (activeFilter === 'not-completed' && p.completionStatus === 'completed') return false;

      // Search
      if (searchQuery) {
        const hay = [
          p.name,
          p.summary,
          p.completionStatus,
          p.completionReason,
          ...(p.topLanguages || []).map((l) => l.name),
          ...(p.topFileTypes || []).map((f) => f.name)
        ].join(' ').toLowerCase();
        return hay.includes(searchQuery);
      }
      return true;
    });

    // Stats
    const completed = allProjects.filter((p) => p.completionStatus === 'completed').length;
    const inProgress = allProjects.length - completed;
    statsBar.textContent = `${allProjects.length} projects · ${completed} completed · ${inProgress} in progress`;

    // Grid
    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = '';
      emptyState.querySelector('p').textContent = searchQuery
        ? `No projects match "${searchInput.value.trim()}".`
        : 'No projects in the vault yet.';
      return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = filtered.map(cardHTML).join('');

    // Attach click handlers
    grid.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const project = allProjects.find((p) => p.id === id);
        if (project) openPopup(project);
      });
    });
  }

  function cardHTML(p) {
    const date = formatDate(p.createdAt);
    const badge = completionBadge(p.completionStatus);
    const summary = escapeHTML(truncate(p.summary || 'No summary yet.', 220));
    const languages = (p.topLanguages || []).slice(0, 4).map((l) =>
      `<span class="meta-pill">${escapeHTML(l.name)} <span class="count">${l.count}</span></span>`
    ).join('');

    return `
      <article class="card" data-id="${escapeAttr(p.id)}">
        <div class="card-header">
          <h3 class="card-title">${escapeHTML(p.name)}</h3>
          <span class="card-badge ${badge.cls}">${badge.label}</span>
        </div>
        <p class="card-summary">${summary}</p>
        <div class="card-meta">${languages}</div>
        <div class="card-footer">
          <span class="date">📅 ${date}</span>
          <span class="size">${escapeHTML(p.totalSizeLabel || '')}</span>
        </div>
      </article>`;
  }

  // ---- Popup ----
  function openPopup(p) {
    const date = formatDate(p.createdAt);
    const badge = completionBadge(p.completionStatus);
    const summaryHTML = renderMarkdown(p.summary || 'No summary available.');
    const languages = (p.topLanguages || []).map((l) =>
      `<span class="meta-pill">${escapeHTML(l.name)} <span class="count">${l.count}</span></span>`
    ).join('');
    const fileTypes = (p.topFileTypes || []).map((f) =>
      `<span class="meta-pill">${escapeHTML(f.name)} <span class="count">${f.count}</span></span>`
    ).join('');

    let reasonHTML = '';
    if (p.completionStatus !== 'completed' && p.completionReason) {
      reasonHTML = `<p class="popup-reason">⚠️ ${escapeHTML(p.completionReason)}</p>`;
    }

    popupBody.innerHTML = `
      <h2>${escapeHTML(p.name)}</h2>
      <div class="card-header" style="margin:0">
        <span class="card-badge ${badge.cls}" style="font-size:0.8rem;padding:0.3rem 0.8rem">${badge.label}</span>
      </div>
      <div class="popup-meta">
        <span class="meta-pill">📅 ${date}</span>
        <span class="meta-pill">📁 ${p.fileCount || 0} files</span>
        <span class="meta-pill">💾 ${escapeHTML(p.totalSizeLabel || 'Unknown')}</span>
      </div>
      ${reasonHTML}
      <div class="popup-summary">${summaryHTML}</div>
      ${languages ? `
        <div class="popup-section-title">Languages</div>
        <div class="popup-languages">${languages}</div>
      ` : ''}
      ${fileTypes ? `
        <div class="popup-section-title">File Types</div>
        <div class="popup-filetypes">${fileTypes}</div>
      ` : ''}
    `;

    popupOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePopup() {
    popupOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ---- Helpers ----
  function completionBadge(status) {
    if (status === 'completed') return { cls: 'badge-completed', label: 'Completed' };
    return { cls: 'badge-not-completed', label: 'In Progress' };
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  function truncate(text, max) {
    if (!text) return '';
    const clean = text.replace(/[#*_`>\-]/g, '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max) + '…' : clean;
  }

  function renderMarkdown(md) {
    if (!md) return '';
    // Lightweight markdown → HTML for summaries
    let html = escapeHTML(md);
    // Headers
    html = html.replace(/^## (.+)$/gm, '<strong style="display:block;margin-top:1rem;font-size:1rem;color:var(--accent)">$1</strong>');
    html = html.replace(/^### (.+)$/gm, '<strong style="display:block;margin-top:0.75rem">$1</strong>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:var(--code-bg);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.88rem">$1</code>');
    // Bullet points
    html = html.replace(/^- (.+)$/gm, '<span style="display:block;padding-left:1rem">• $1</span>');
    // Newlines
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHTML(str).replace(/'/g, '&#39;');
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }
})();
