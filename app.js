/* ==========================================================================
   wippy — client logic
   ========================================================================== */

(function () {
  'use strict';

  // ---- Color Palette for Projects ----
  const PROJECT_COLORS = [
    { accent: '#ff6b35', glow: 'rgba(255,107,53,0.12)', tagBg: 'rgba(255,107,53,0.1)', tagBorder: 'rgba(255,107,53,0.18)' },
    { accent: '#9b5de5', glow: 'rgba(155,93,229,0.12)', tagBg: 'rgba(155,93,229,0.1)', tagBorder: 'rgba(155,93,229,0.18)' },
    { accent: '#00bbf9', glow: 'rgba(0,187,249,0.12)', tagBg: 'rgba(0,187,249,0.1)', tagBorder: 'rgba(0,187,249,0.18)' },
    { accent: '#00e5a0', glow: 'rgba(0,229,160,0.12)', tagBg: 'rgba(0,229,160,0.1)', tagBorder: 'rgba(0,229,160,0.18)' },
    { accent: '#ff006e', glow: 'rgba(255,0,110,0.12)', tagBg: 'rgba(255,0,110,0.1)', tagBorder: 'rgba(255,0,110,0.18)' },
    { accent: '#ffc857', glow: 'rgba(255,200,87,0.12)', tagBg: 'rgba(255,200,87,0.1)', tagBorder: 'rgba(255,200,87,0.18)' },
    { accent: '#e05520', glow: 'rgba(224,85,32,0.12)', tagBg: 'rgba(224,85,32,0.1)', tagBorder: 'rgba(224,85,32,0.18)' },
    { accent: '#06b6d4', glow: 'rgba(6,182,212,0.12)', tagBg: 'rgba(6,182,212,0.1)', tagBorder: 'rgba(6,182,212,0.18)' },
  ];

  const LANG_COLORS = {
    'javascript': { c: '#f0db4f', bg: 'rgba(240,219,79,0.1)', border: 'rgba(240,219,79,0.2)' },
    'typescript': { c: '#3178c6', bg: 'rgba(49,120,198,0.1)', border: 'rgba(49,120,198,0.2)' },
    'python': { c: '#3572A5', bg: 'rgba(53,114,165,0.1)', border: 'rgba(53,114,165,0.2)' },
    'html': { c: '#e34c26', bg: 'rgba(227,76,38,0.1)', border: 'rgba(227,76,38,0.2)' },
    'css': { c: '#563d7c', bg: 'rgba(86,61,124,0.1)', border: 'rgba(86,61,124,0.2)' },
    'java': { c: '#b07219', bg: 'rgba(176,114,25,0.1)', border: 'rgba(176,114,25,0.2)' },
    'c++': { c: '#f34b7d', bg: 'rgba(243,75,125,0.1)', border: 'rgba(243,75,125,0.2)' },
    'c#': { c: '#178600', bg: 'rgba(23,134,0,0.1)', border: 'rgba(23,134,0,0.2)' },
    'go': { c: '#00ADD8', bg: 'rgba(0,173,216,0.1)', border: 'rgba(0,173,216,0.2)' },
    'rust': { c: '#dea584', bg: 'rgba(222,165,132,0.1)', border: 'rgba(222,165,132,0.2)' },
    'ruby': { c: '#CC342D', bg: 'rgba(204,52,45,0.1)', border: 'rgba(204,52,45,0.2)' },
    'php': { c: '#4F5D95', bg: 'rgba(79,93,149,0.1)', border: 'rgba(79,93,149,0.2)' },
    'swift': { c: '#F05138', bg: 'rgba(240,81,56,0.1)', border: 'rgba(240,81,56,0.2)' },
    'kotlin': { c: '#A97BFF', bg: 'rgba(169,123,255,0.1)', border: 'rgba(169,123,255,0.2)' },
    'dart': { c: '#00B4AB', bg: 'rgba(0,180,171,0.1)', border: 'rgba(0,180,171,0.2)' },
    'lua': { c: '#000080', bg: 'rgba(0,0,128,0.1)', border: 'rgba(0,0,128,0.2)' },
    'shell': { c: '#89e051', bg: 'rgba(137,224,81,0.1)', border: 'rgba(137,224,81,0.2)' },
    'json': { c: '#999', bg: 'rgba(153,153,153,0.1)', border: 'rgba(153,153,153,0.2)' },
    'markdown': { c: '#083fa1', bg: 'rgba(8,63,161,0.1)', border: 'rgba(8,63,161,0.2)' },
  };

  // ---- State ----
  let allProjects = [];
  let activeFilter = 'all';
  let searchQuery = '';
  let sortBy = 'newest';
  let viewMode = 'grid';

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
    themeTransition.classList.remove('sweep');
    void themeTransition.offsetWidth;
    themeTransition.classList.add('sweep');
    themeTransition.addEventListener('animationend', () => themeTransition.classList.remove('sweep'), { once: true });
    applyTheme(next);
  });

  // ---- Cursor Trail ----
  const trailCanvas = $('#cursorTrail');
  const ctx = trailCanvas.getContext('2d');
  let trailPoints = [];
  let mouseX = -100, mouseY = -100;

  function resizeCanvas() {
    trailCanvas.width = window.innerWidth;
    trailCanvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    trailPoints.push({ x: mouseX, y: mouseY, age: 0, color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)].accent });
    if (trailPoints.length > 30) trailPoints.shift();
  });

  function drawTrail() {
    ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    for (let i = trailPoints.length - 1; i >= 0; i--) {
      const p = trailPoints[i];
      p.age++;
      if (p.age > 25) { trailPoints.splice(i, 1); continue; }
      const alpha = (1 - p.age / 25) * 0.3;
      const size = (1 - p.age / 25) * 4 + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(drawTrail);
  }
  drawTrail();

  // ---- Scroll Reveal (IntersectionObserver) ----
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  function initReveals() {
    $$('.reveal').forEach((el) => revealObserver.observe(el));
  }
  initReveals();

  // ---- Card Scroll Reveal ----
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0) scale(1)';
        cardObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

  // ---- Color Assignment ----
  const projectColorMap = new Map();
  let colorIndex = 0;
  function getColorForProject(p) {
    if (projectColorMap.has(p.id)) return projectColorMap.get(p.id);
    // Deterministic based on project name
    let hash = 0;
    for (let i = 0; i < p.name.length; i++) hash = ((hash << 5) - hash + p.name.charCodeAt(i)) | 0;
    const idx = Math.abs(hash) % PROJECT_COLORS.length;
    const color = PROJECT_COLORS[idx];
    projectColorMap.set(p.id, color);
    return color;
  }
  function getLangColor(name) {
    const key = name.toLowerCase().replace(/[^a-z+#]/g, '');
    return LANG_COLORS[key] || { c: '#888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.2)' };
  }

  const EMOJI_MAP = {
    'web': '🌐', 'api': '⚡', 'server': '🖥️', 'app': '📱',
    'game': '🎮', 'bot': '🤖', 'chat': '💬', 'mail': '📧',
    'security': '🔒', 'camera': '📷', 'music': '🎵', 'video': '🎬',
    'photo': '📸', 'weather': '🌤️', 'timer': '⏱️', 'quiz': '❓',
    'todo': '✅', 'note': '📝', 'search': '🔍', 'share': '🔗',
    'qr': '📱', 'countdown': '🕐', 'calendar': '📅', 'recipe': '🍳',
    'shop': '🛒', 'blog': '✍️', 'portfolio': '💼', 'manga': '📚',
    'phone': '📱', 'organizer': '📂', 'dashboard': '📊', 'finance': '💰',
    'health': '❤️', 'fitness': '💪', 'travel': '✈️', 'movie': '🎬',
    'book': '📚', 'news': '📰', 'ai': '🧠', 'data': '📈', 'test': '🧪',
  };
  function getProjectEmoji(name, fileTypes) {
    const lower = (name || '').toLowerCase();
    for (const [kw, em] of Object.entries(EMOJI_MAP)) {
      if (lower.includes(kw)) return em;
    }
    if (fileTypes && fileTypes.some((f) => ['html', 'css', 'js'].includes((f.name || '').toLowerCase()))) return '🌐';
    if (fileTypes && fileTypes.some((f) => ['py'].includes((f.name || '').toLowerCase()))) return '🐍';
    return '📁';
  }

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
    skeletonGrid.classList.add('hiding');
    skeletonGrid.addEventListener('animationend', () => { skeletonGrid.style.display = 'none'; }, { once: true });
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
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---- Sorting ----
  function sortProjects(arr) {
    const sorted = [...arr];
    switch (sortBy) {
      case 'newest': sorted.sort((a, b) => dateVal(b) - dateVal(a)); break;
      case 'oldest': sorted.sort((a, b) => dateVal(a) - dateVal(b)); break;
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'size': sorted.sort((a, b) => (b.totalBytes || 0) - (a.totalBytes || 0)); break;
      case 'size-asc': sorted.sort((a, b) => (a.totalBytes || 0) - (b.totalBytes || 0)); break;
    }
    return sorted;
  }
  function dateVal(p) { return p.createdAt ? new Date(p.createdAt).getTime() : 0; }

  // ---- Bento Size Logic ----
  function getBentoSize(index, project) {
    if (index === 0) return 'bento-large';
    if (index === 1 || index === 2) return 'bento-wide';
    return '';
  }

  // ---- Rendering ----
  function render() {
    const filtered = allProjects.filter((p) => {
      if (activeFilter === 'completed' && p.completionStatus !== 'completed') return false;
      if (activeFilter === 'not-completed' && p.completionStatus === 'completed') return false;
      if (searchQuery) {
        const hay = [p.name, p.summary, p.completionStatus, p.completionReason, p.githubUrl, p.repoVisibility,
          ...(p.topLanguages || []).map((l) => l.name),
          ...(p.topFileTypes || []).map((f) => f.name)
        ].join(' ').toLowerCase();
        return hay.includes(searchQuery);
      }
      return true;
    });

    const sorted = sortProjects(filtered);

    filterCount.textContent = filtered.length === allProjects.length
      ? `${allProjects.length} projects`
      : `${filtered.length} / ${allProjects.length}`;

    if (sorted.length === 0) {
      grid.innerHTML = '';
      list.innerHTML = '';
      timeline.innerHTML = '';
      emptyState.style.display = '';
      $('#emptyTitle').textContent = searchQuery ? `No matches for "${searchInput.value.trim()}"` : 'No projects in the vault';
      return;
    }
    emptyState.style.display = 'none';

    grid.style.display = 'none';
    list.style.display = 'none';
    timeline.style.display = 'none';

    if (viewMode === 'grid') {
      grid.style.display = '';
      grid.innerHTML = sorted.map((p, i) => bentoCardHTML(p, i)).join('');
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
    container.querySelectorAll('[data-id]').forEach((el, i) => {
      el.addEventListener('click', (e) => {
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

      // Scroll reveal for cards
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px) scale(0.97)';
      el.style.transition = `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 40}ms, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 40}ms`;
      cardObserver.observe(el);
    });
  }

  // ---- Bento Card HTML ----
  function bentoCardHTML(p, i) {
    const color = getColorForProject(p);
    const date = fmtDate(p.createdAt);
    const badge = p.completionStatus === 'completed' ? { cls: 'badge-done', label: 'Done' } : { cls: 'badge-wip', label: 'WIP' };
    const summary = esc(truncate(p.summary || 'No summary yet.', 220));
    const langs = (p.topLanguages || []).slice(0, 4).map((l) => {
      const lc = getLangColor(l.name);
      return `<span class="lang-tag" style="--tag-bg:${lc.bg};--tag-color:${lc.c};--tag-border:${lc.border}">${esc(l.name)}</span>`;
    }).join('');
    const ghLink = p.githubUrl
      ? `<a class="bento-card-gh" href="${escA(p.githubUrl)}" target="_blank" rel="noopener noreferrer" title="GitHub" onclick="event.stopPropagation()">
           <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
         </a>` : '';
    const sizeClass = getBentoSize(i, p);

    // Thumbnail
    const thumbHTML = p.thumbnail
      ? `<img class="bento-card-thumb" src="${escA(p.thumbnail)}" alt="${escA(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="bento-card-no-thumb" style="display:none">${getProjectEmoji(p.name, p.topFileTypes)}</div>`
      : `<div class="bento-card-no-thumb">${getProjectEmoji(p.name, p.topFileTypes)}</div>`;

    // Repo visibility badge
    const visBadge = p.repoVisibility === 'private'
      ? `<span class="bento-card-badge badge-private">🔒 Private</span>`
      : p.repoVisibility === 'public'
        ? `<span class="bento-card-badge badge-public">🌐 Public</span>`
        : '';
    // Updated badge
    const updatedBadge = p.isUpdated
      ? `<span class="bento-card-badge badge-updated">✨ Updated</span>`
      : '';

    return `<article class="bento-card ${sizeClass}" data-id="${escA(p.id)}" style="--card-accent:${color.accent};--card-accent-glow:${color.glow}">
      ${thumbHTML}
      <div class="bento-card-top">
        <span class="bento-card-num">#${String(i + 1).padStart(2, '0')}</span>
        <div class="bento-card-badges">
          ${updatedBadge}${visBadge}<span class="bento-card-badge ${badge.cls}">${badge.label}</span>
        </div>
      </div>
      <h3 class="bento-card-name">${esc(p.name)}</h3>
      <p class="bento-card-summary">${summary}</p>
      <div class="bento-card-tags">${langs}</div>
      <div class="bento-card-footer">
        <span class="bento-card-date">📅 ${date}</span>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span class="bento-card-size">${esc(p.totalSizeLabel || '')}</span>
          ${ghLink}
        </div>
      </div>
    </article>`;
  }

  // ---- List HTML ----
  function listHTML(p, i) {
    const color = getColorForProject(p);
    const date = fmtDate(p.createdAt);
    const badge = p.completionStatus === 'completed' ? { cls: 'badge-done', label: 'Done' } : { cls: 'badge-wip', label: 'WIP' };
    const langs = (p.topLanguages || []).slice(0, 3).map((l) => l.name).join(', ');
    const ghLink = p.githubUrl
      ? `<a class="bento-card-gh" href="${escA(p.githubUrl)}" target="_blank" rel="noopener noreferrer" title="GitHub" onclick="event.stopPropagation()">
           <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
         </a>` : '';

    return `<article class="list-item" data-id="${escA(p.id)}">
      <span class="list-item-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="list-item-dot" style="background:${color.accent}"></span>
      <div class="list-item-info">
        <div class="list-item-name">${p.isUpdated ? '<span class="badge-updated-dot"></span>' : ''}${esc(p.name)}${p.repoVisibility ? `<span class="list-vis-icon">${p.repoVisibility === 'private' ? '🔒' : '🌐'}</span>` : ''}</div>
        <div class="list-item-meta">
          <span>${date}</span>
          <span>${p.fileCount || 0} files</span>
          <span>${esc(p.totalSizeLabel || '')}</span>
          ${langs ? `<span>${esc(langs)}</span>` : ''}
        </div>
      </div>
      <div class="list-item-right">
        ${p.isUpdated ? '<span class="bento-card-badge badge-updated">✨ Updated</span>' : ''}
        ${p.repoVisibility === 'private' ? '<span class="bento-card-badge badge-private">🔒 Private</span>' : ''}
        <span class="bento-card-badge ${badge.cls}">${badge.label}</span>
        ${ghLink}
      </div>
    </article>`;
  }

  // ---- Timeline HTML ----
  function timelineHTML(projects) {
    const groups = [];
    let lastKey = '';
    for (const p of projects) {
      const d = p.createdAt ? new Date(p.createdAt) : null;
      const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}` : 'unknown';
      const label = d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Unknown date';
      if (key !== lastKey) { groups.push({ key, label, items: [] }); lastKey = key; }
      groups[groups.length - 1].items.push(p);
    }

    let html = '<div class="tl-track">';
    let globalIdx = 0;

    for (const group of groups) {
      html += `<div class="tl-group"><div class="tl-date-marker"><span class="tl-date-dot"></span><span class="tl-date-label">${esc(group.label)}</span></div>`;
      for (const p of group.items) {
        const color = getColorForProject(p);
        const badge = p.completionStatus === 'completed' ? { cls: 'badge-done', label: 'Done' } : { cls: 'badge-wip', label: 'WIP' };
        const date = fmtDateShort(p.createdAt);
        const langs = (p.topLanguages || []).slice(0, 2).map((l) => l.name).join(', ');
        const ghLink = p.githubUrl
          ? `<a class="tl-gh" href="${escA(p.githubUrl)}" target="_blank" rel="noopener noreferrer" title="GitHub" onclick="event.stopPropagation()">
               <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
             </a>` : '';

        html += `<div class="tl-item" data-id="${escA(p.id)}">
          <div class="tl-connector"><span class="tl-dot ${p.completionStatus === 'completed' ? 'tl-dot-done' : ''}"></span></div>
          <div class="tl-card" style="border-left:3px solid ${color.accent}">
            <div class="tl-card-top">
              <span class="tl-card-date">${esc(date)}</span>
              <span class="bento-card-badge ${badge.cls}" style="font-size:0.6rem;padding:0.12rem 0.45rem">${badge.label}</span>
            </div>
            <h4 class="tl-card-name">${esc(p.name)}</h4>
            <p class="tl-card-summary">${esc(truncate(p.summary || 'No summary yet.', 120))}</p>
            <div class="tl-card-bottom">
              <span>${esc(p.totalSizeLabel || '')} · ${p.fileCount || 0} files</span>
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
    const color = getColorForProject(p);
    const date = fmtDate(p.createdAt);
    const badge = p.completionStatus === 'completed' ? { cls: 'badge-done', label: 'Completed' } : { cls: 'badge-wip', label: 'In Progress' };
    const summaryHTML = renderMarkdown(p.summary || 'No summary available.');
    const langs = (p.topLanguages || []).map((l) => {
      const lc = getLangColor(l.name);
      return `<span class="lang-tag" style="--tag-bg:${lc.bg};--tag-color:${lc.c};--tag-border:${lc.border}">${esc(l.name)} <span style="opacity:0.6">${l.count}</span></span>`;
    }).join('');
    const fts = (p.topFileTypes || []).map((f) =>
      `<span class="lang-tag" style="--tag-bg:rgba(136,136,136,0.1);--tag-color:#888;--tag-border:rgba(136,136,136,0.2)">${esc(f.name)} <span style="opacity:0.6">${f.count}</span></span>`
    ).join('');

    let reasonHTML = '';
    if (p.completionStatus !== 'completed' && p.completionReason) {
      reasonHTML = `<div class="popup-reason">⚠️ ${esc(p.completionReason)}</div>`;
    }

    let ghHTML = '';
    if (p.githubUrl) {
      ghHTML = `<a class="popup-gh-link" href="${escA(p.githubUrl)}" target="_blank" rel="noopener noreferrer" style="background:${color.accent}">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        <span>View on GitHub</span>
      </a>`;
    }

    const popupThumbHTML = p.thumbnail
      ? `<img class="popup-thumb" src="${escA(p.thumbnail)}" alt="${escA(p.name)}" onerror="this.style.display='none'" />`
      : '';

    const popupVisBadge = p.repoVisibility === 'private' ? '<span class="bento-card-badge badge-private">🔒 Private Repo</span>' : p.repoVisibility === 'public' ? '<span class="bento-card-badge badge-public">🌐 Public Repo</span>' : '';
    const popupUpdatedBadge = p.isUpdated ? '<span class="bento-card-badge badge-updated">✨ Updated</span>' : '';

    popupBody.innerHTML = `
      ${popupThumbHTML}
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap">
        <span style="width:10px;height:10px;border-radius:50%;background:${color.accent};flex-shrink:0"></span>
        <span class="bento-card-badge ${badge.cls}">${badge.label}</span>
        ${popupVisBadge}
        ${popupUpdatedBadge}
      </div>
      <h2>${esc(p.name)}</h2>
      <div class="popup-meta">
        <span class="meta-pill">📅 ${date}</span>
        <span class="meta-pill">📁 ${p.fileCount || 0} files</span>
        <span class="meta-pill">💾 ${esc(p.totalSizeLabel || 'Unknown')}</span>
        ${p.updatedAt && p.isUpdated ? `<span class="meta-pill">🔄 Last updated: ${fmtDate(p.updatedAt)}</span>` : ''}
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
    h = h.replace(/`([^`]+)`/g, '<code style="background:var(--accent-glow);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.88rem;font-family:var(--mono)">$1</code>');
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
