/* ==========================================================================
   wippy — Custom Visitor Tracking
   Lightweight, privacy-friendly, no external dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'wippy_stats';
  var FINGERPRINT_KEY = 'wippy_fp';

  // ---- Simple browser fingerprint for unique visitor detection ----
  function getFingerprint() {
    var stored = sessionStorage.getItem(FINGERPRINT_KEY);
    if (stored) return stored;
    var raw = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      !!window.indexedDB,
      !!navigator.cookieEnabled
    ].join('|');
    var hash = 0;
    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    var fp = 'fp_' + Math.abs(hash).toString(36);
    sessionStorage.setItem(FINGERPRINT_KEY, fp);
    return fp;
  }

  // ---- Stats Storage ----
  function getStats() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) { /* quota exceeded, ignore */ }
  }

  function initStats() {
    var stats = getStats();
    if (!stats) {
      stats = {
        totalViews: 0,
        uniqueVisitors: [],
        pageViews: {},
        searches: [],
        clicks: [],
        filters: [],
        firstVisit: new Date().toISOString(),
        lastVisit: null,
        sessions: 0
      };
    }
    return stats;
  }

  // ---- Track a page view ----
  function trackPageView(page) {
    var stats = initStats();
    var fp = getFingerprint();

    stats.totalViews++;
    stats.lastVisit = new Date().toISOString();
    stats.sessions++;

    // Unique visitor tracking
    if (stats.uniqueVisitors.indexOf(fp) === -1) {
      stats.uniqueVisitors.push(fp);
    }

    // Page-specific views
    if (!stats.pageViews[page]) stats.pageViews[page] = 0;
    stats.pageViews[page]++;

    saveStats(stats);
    updatePublicCounter(stats.totalViews);
  }

  // ---- Track an event (search, click, filter) ----
  function trackEvent(type, data) {
    var stats = initStats();
    var entry = {
      time: new Date().toISOString(),
      page: window.location.pathname.split('/').pop() || 'index.html'
    };

    // Merge data
    for (var k in data) {
      if (data.hasOwnProperty(k)) entry[k] = data[k];
    }

    if (type === 'search') {
      stats.searches.push(entry);
      // Keep last 200 searches
      if (stats.searches.length > 200) stats.searches = stats.searches.slice(-200);
    } else if (type === 'click') {
      stats.clicks.push(entry);
      if (stats.clicks.length > 500) stats.clicks = stats.clicks.slice(-500);
    } else if (type === 'filter') {
      stats.filters.push(entry);
      if (stats.filters.length > 200) stats.filters = stats.filters.slice(-200);
    }

    saveStats(stats);
  }

  // ---- Update public counter in footer ----
  function updatePublicCounter(count) {
    var el = document.getElementById('visitorCount');
    if (el) el.textContent = formatNumber(count);
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  // ---- Auto-track page view on load ----
  var page = window.location.pathname.split('/').pop() || 'index.html';
  trackPageView(page);

  // ---- Expose tracking functions globally ----
  window.WippyTrack = {
    search: function (query, resultCount) {
      trackEvent('search', { query: query, results: resultCount });
    },
    click: function (projectName, projectId) {
      trackEvent('click', { project: projectName, id: projectId });
    },
    filter: function (filterType) {
      trackEvent('filter', { type: filterType });
    },
    getStats: function () {
      return getStats();
    }
  };
})();
