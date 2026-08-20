/* ==========================================================================
   Portfolio Hub — Modern Client Logic
   ========================================================================== */

(function () {
  'use strict';

  // ---- State ----
  let allProjects = [];
  let activeFilter = 'all';
  let searchQuery = '';
  let sortBy = 'newest';
  let viewMode = 'grid'; // 'grid' | 'list'

  // ---- DOM ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const skeletonGrid = $('#skeletonGrid');
  const grid = $('#projectGrid');
  const list = $('#projectList');
  const timeline = $('#projectTimeline');
  const emptyState = $('#emptyState');
  const searchInput = $('#searchInput');
  const searchClear = $('#searchClear');
  const filterCount = $('#filterCount');
  const sortSelect = $('#sortSelect');
  const popupOverlay = $('#popupOverlay');
  const popupBody = $('#popupBody');
  const themeToggle = $('#themeToggle');

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

  const themeTransition = $('#themeTransition');
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    // Play sweep animation
    themeTransition.classList.remove('sweep');
    void themeTransition.offsetWidth; // force reflow
    themeTransition.classList.add('sweep');
    themeTransition.addEventListener('animationend', () => {
      themeTransition.classList.remove('sweep');
    }, { once: true });
    applyTheme(next);
  });

  // ---- Init ----
  loadProjects();

  // ---- Events ----
  searchInput.addEventListener('input', debounce(() => {
    searchQuery = searchInput.value.trim().toLowerCase();
    searchClear.classList.toggle('visible', searchInput.value.length > 0);
    render();
  }, 180));
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.remove('visible');
    render();
    searchInput.focus();
  });

  $$('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  sortSelect.addEventListener('change', () => {
    sortBy = sortSelect.value;
    render();
  });

  $$('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.view-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      viewMode = btn.dataset.view;
      render();
    });
  });

  $('#popupClose').addEventListener('click', closePopup);
  popupOverlay.addEventListener('click', (e) => { if (e.target === popupOverlay) closePopup(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopup(); });

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
    // Fade out skeleton, then render
    skeletonGrid.classList.add('hiding');
    skeletonGrid.addEventListener('animationend', () => {
      skeletonGrid.style.display = 'none';
    }, { once: true });
    // Small delay so the fade-out is visible even on fast loads
    await new Promise((r) => setTimeout(r, 150));
    render();
    animateCounters();
  }

  // ---- Animated Counters ----
  function animateCounters() {
    const completed = allProjects.filter((p) => p.completionStatus === 'completed').length;
    const inProgress = allProjects.length - completed;
    const langs = new Set();
    allProjects.forEach((p) => (p.topLanguages || []).forEach((l) => langs.add(l.name)));

    animateNumber($('#statTotal'), allProjects.length);
    animateNumber($('#statCompleted'), completed);
    animateNumber($('#statProgress'), inProgress);
    animateNumber($('#statLanguages'), langs.size);
  }

  function animateNumber(el, target) {
    const duration = 800;
    const start = performance.now();
    const from = 0;
    el.dataset.target = target;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(from + (target - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---- Sorting ----
  function sortProjects(arr) {
    const sorted = [...arr];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => dateVal(b) - dateVal(a)); break;
      case 'oldest':
        sorted.sort((a, b) => dateVal(a) - dateVal(b)); break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'size':
        sorted.sort((a, b) => (b.totalBytes || 0) - (a.totalBytes || 0)); break;
      case 'size-asc':
        sorted.sort((a, b) => (a.totalBytes || 0) - (b.totalBytes || 0)); break;
    }
    return sorted;
  }
  function dateVal(p) { return p.createdAt ? new Date(p.createdAt).getTime() : 0; }

  // ---- Rendering ----
  function render() {
    const filtered = allProjects.filter((p) => {
      if (activeFilter === 'completed' && p.completionStatus !== 'completed') return false;
      if (activeFilter === 'not-completed' && p.completionStatus === 'completed') return false;
      if (searchQuery) {
        const hay = [p.name, p.summary, p.completionStatus, p.completionReason, p.githubUrl,
          ...(p.topLanguages || []).map((l) => l.name),
          ...(p.topFileTypes || []).map((f) => f.name)
        ].join(' ').toLowerCase();
        return hay.includes(searchQuery);
      }
      return true;
    });

    const sorted = sortProjects(filtered);

    // Filter count
    filterCount.textContent = filtered.length === allProjects.length
      ? `${allProjects.length} projects`
      : `${filtered.length} of ${allProjects.length}`;

    // Empty
    if (sorted.length === 0) {
      grid.innerHTML = '';
      list.innerHTML = '';
      timeline.innerHTML = '';
      emptyState.style.display = '';
      $('#emptyTitle').textContent = searchQuery ? `No matches for "${searchInput.value.trim()}"` : 'No projects in the vault';
      return;
    }
    emptyState.style.display = 'none';

    // Hide all views first
    grid.style.display = 'none';
    list.style.display = 'none';
    timeline.style.display = 'none';

    // Render view
    if (viewMode === 'grid') {
      grid.style.display = '';
      grid.innerHTML = sorted.map((p, i) => cardHTML(p, i)).join('');
      attachCardEvents(grid);
    } else if (viewMode === 'list') {
      list.style.display = '';
      list.innerHTML = sorted.map((p, i) => listHTML(p, i)).join('');
      attachCardEvents(list);
    } else {
      timeline.style.display = '';
      timeline.innerHTML = timelineHTML(sorted);
      attachCardEvents(timeline);
    }
  }

  function attachCardEvents(container) {
    container.querySelectorAll('[data-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        // Don't open popup if clicking a link
        if (e.target.closest('a')) return;
        const id = el.dataset.id;
        const project = allProjects.find((p) => p.id === id);
        if (project) openPopup(project);
      });

      // Mouse glow follow
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        el.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      });

      // Ripple on click
      el.addEventListener('mousedown', (e) => {
        const rect = el.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        el.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  }

  // ---- Card HTML ----
  function cardHTML(p, i) {
    const date = fmtDate(p.createdAt);
    const badge = completionBadge(p.completionStatus);
    const summary = esc(truncate(p.summary || 'No summary yet.', 180));
    const langs = (p.topLanguages || []).slice(0, 3).map((l) =>
      `<span class="meta-pill">${esc(l.name)} <span class="count">${l.count}</span></span>`
    ).join('');
    const ghLink = p.githubUrl
      ? `<a class="card-gh" href="${escA(p.githubUrl)}" target="_blank" rel="noopener noreferrer" title="View on GitHub" onclick="event.stopPropagation()">
           <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
         </a>` : '';
    const delay = Math.min(i, 14) * 35;

    return `<article class="card" data-id="${escA(p.id)}" style="animation-delay:${delay}ms">
      <div class="card-header">
        <h3 class="card-title">${esc(p.name)}</h3>
        <span class="card-badge ${badge.cls}">${badge.label}</span>
      </div>
      <p class="card-summary">${summary}</p>
      <div class="card-meta">${langs}</div>
      <div class="card-footer">
        <span class="date">📅 ${date}</span>
        <div class="card-footer-right">
          <span class="size">${esc(p.totalSizeLabel || '')}</span>
          ${ghLink}
        </div>
      </div>
    </article>`;
  }

  // ---- List HTML ----
  function listHTML(p, i) {
    const date = fmtDate(p.createdAt);
    const badge = completionBadge(p.completionStatus);
    const langs = (p.topLanguages || []).slice(0, 3).map((l) => l.name).join(', ');
    const ghLink = p.githubUrl
      ? `<a class="card-gh" href="${escA(p.githubUrl)}" target="_blank" rel="noopener noreferrer" title="GitHub" onclick="event.stopPropagation()">
           <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
         </a>` : '';
    const delay = Math.min(i, 14) * 30;

    return `<article class="list-item" data-id="${escA(p.id)}" style="animation-delay:${delay}ms">
      <div class="list-item-info">
        <div class="list-item-name">${esc(p.name)}</div>
        <div class="list-item-meta">
          <span>${date}</span>
          <span>${p.fileCount || 0} files</span>
          <span>${esc(p.totalSizeLabel || '')}</span>
          ${langs ? `<span>${esc(langs)}</span>` : ''}
        </div>
      </div>
      <div class="list-item-right">
        <span class="card-badge ${badge.cls}">${badge.label}</span>
        ${ghLink}
      </div>
    </article>`;
  }

  // ---- Timeline HTML ----
  function timelineHTML(projects) {
    // Group projects by month
    const groups = [];
    let lastKey = '';
    for (const p of projects) {
      const d = p.createdAt ? new Date(p.createdAt) : null;
      const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}` : 'unknown';
      const label = d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Unknown date';
      if (key !== lastKey) {
        groups.push({ key, label, items: [] });
        lastKey = key;
      }
      groups[groups.length - 1].items.push(p);
    }

    let html = '<div class="tl-track">';
    let globalIdx = 0;

    for (const group of groups) {
      html += `<div class="tl-group">
        <div class="tl-date-marker">
          <span class="tl-date-dot"></span>
          <span class="tl-date-label">${esc(group.label)}</span>
        </div>`;

      for (const p of group.items) {
        const badge = completionBadge(p.completionStatus);
        const date = fmtDateShort(p.createdAt);
        const langs = (p.topLanguages || []).slice(0, 2).map((l) => l.name).join(', ');
        const side = globalIdx % 2 === 0 ? 'left' : 'right';
        const ghLink = p.githubUrl
          ? `<a class="tl-gh" href="${escA(p.githubUrl)}" target="_blank" rel="noopener noreferrer" title="GitHub" onclick="event.stopPropagation()">
               <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
             </a>` : '';
        const delay = Math.min(globalIdx, 16) * 50;

        html += `<div class="tl-item tl-${side}" data-id="${escA(p.id)}" style="animation-delay:${delay}ms">
          <div class="tl-connector"><span class="tl-dot ${p.completionStatus === 'completed' ? 'tl-dot-done' : ''}"></span></div>
          <div class="tl-card">
            <div class="tl-card-top">
              <span class="tl-card-date">${esc(date)}</span>
              <span class="card-badge ${badge.cls}" style="font-size:0.65rem;padding:0.15rem 0.5rem">${badge.label}</span>
            </div>
            <h4 class="tl-card-name">${esc(p.name)}</h4>
            <p class="tl-card-summary">${esc(truncate(p.summary || 'No summary yet.', 120))}</p>
            <div class="tl-card-bottom">
              <span class="tl-card-meta">${esc(p.totalSizeLabel || '')} · ${p.fileCount || 0} files</span>
              ${langs ? `<span class="tl-card-langs">${esc(langs)}</span>` : ''}
              ${ghLink}
            </div>
          </div>
        </div>`;
        globalIdx++;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // ---- Popup ----
  function openPopup(p) {
    const date = fmtDate(p.createdAt);
    const badge = completionBadge(p.completionStatus);
    const summaryHTML = renderMarkdown(p.summary || 'No summary available.');
    const langs = (p.topLanguages || []).map((l) =>
      `<span class="meta-pill">${esc(l.name)} <span class="count">${l.count}</span></span>`
    ).join('');
    const fts = (p.topFileTypes || []).map((f) =>
      `<span class="meta-pill">${esc(f.name)} <span class="count">${f.count}</span></span>`
    ).join('');

    let reasonHTML = '';
    if (p.completionStatus !== 'completed' && p.completionReason) {
      reasonHTML = `<div class="popup-reason">⚠️ ${esc(p.completionReason)}</div>`;
    }

    let ghHTML = '';
    if (p.githubUrl) {
      ghHTML = `<a class="popup-gh-link" href="${escA(p.githubUrl)}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        <span>View on GitHub</span>
      </a>`;
    }

    popupBody.innerHTML = `
      <h2>${esc(p.name)}</h2>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
        <span class="card-badge ${badge.cls}" style="font-size:0.78rem;padding:0.25rem 0.7rem">${badge.label}</span>
      </div>
      <div class="popup-meta">
        <span class="meta-pill">📅 ${date}</span>
        <span class="meta-pill">📁 ${p.fileCount || 0} files</span>
        <span class="meta-pill">💾 ${esc(p.totalSizeLabel || 'Unknown')}</span>
      </div>
      ${ghHTML}
      ${reasonHTML}
      <div class="popup-summary">${summaryHTML}</div>
      ${langs ? `<div class="popup-section-title">Languages</div><div class="popup-languages">${langs}</div>` : ''}
      ${fts ? `<div class="popup-section-title">File Types</div><div class="popup-filetypes">${fts}</div>` : ''}
    `;
    popupOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePopup() {
    popupOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ---- Helpers ----
  function completionBadge(s) {
    if (s === 'completed') return { cls: 'badge-completed', label: 'Completed' };
    return { cls: 'badge-not-completed', label: 'In Progress' };
  }
  function fmtDate(d) {
    if (!d) return 'Unknown';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
  }
  function fmtDateShort(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  }
  function truncate(t, max) {
    if (!t) return '';
    const c = t.replace(/[#*_`>\-]/g, '').replace(/\s+/g, ' ').trim();
    return c.length > max ? c.slice(0, max) + '…' : c;
  }
  function renderMarkdown(md) {
    if (!md) return '';
    let h = esc(md);
    h = h.replace(/^## (.+)$/gm, '<strong style="display:block;margin-top:1rem;font-size:1rem;color:var(--accent)">$1</strong>');
    h = h.replace(/^### (.+)$/gm, '<strong style="display:block;margin-top:0.75rem">$1</strong>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/`([^`]+)`/g, '<code style="background:var(--accent-dim);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.88rem">$1</code>');
    h = h.replace(/^- (.+)$/gm, '<span style="display:block;padding-left:1rem">• $1</span>');
    h = h.replace(/\n/g, '<br>');
    return h;
  }
  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escA(s) { return esc(s).replace(/'/g, '&#39;'); }
  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
})();
