/*
 * © 2026 gamer-09. All rights reserved.
 * Build-request form — submits to Supabase (insert only, enforced by RLS).
 * AI requests may attach an .env file (uploaded to Storage) or paste contents.
 */
(function () {
  'use strict';

  const form = document.getElementById('requestForm');
  if (!form) return;

  const cfg = window.WIPPY_CONFIG || {};
  const isConfigured =
    typeof cfg.supabaseUrl === 'string' && cfg.supabaseUrl.startsWith('http') &&
    typeof cfg.supabaseAnonKey === 'string' && cfg.supabaseAnonKey.length > 20;

  let client = null;
  if (isConfigured && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  const ENV_BUCKET = 'request-env';
  const ENV_MAX_BYTES = 100 * 1024; // 100 KB

  // ---- DOM ----
  const titleEl = document.getElementById('rfTitle');
  const descEl = document.getElementById('rfDesc');
  const scopeEl = document.getElementById('rfScope');
  const methodEl = document.getElementById('rfContactMethod');
  const contactEl = document.getElementById('rfContact');
  const contactLabelEl = document.getElementById('rfContactLabel');
  const contactHintEl = document.getElementById('rfContactHint');
  const ownerInfoEl = document.getElementById('rfOwnerInfo');
  const nameEl = document.getElementById('rfName');
  const ackEl = document.getElementById('rfAck');
  const overrideEl = document.getElementById('rfOverride');
  const warningEl = document.getElementById('rfWarning');
  const submitBtn = document.getElementById('rfSubmit');
  const statusEl = document.getElementById('rfStatus');
  const countEl = document.getElementById('rfCount');
  const usesAiEl = document.getElementById('rfUsesAi');
  const envGroup = document.getElementById('rfEnvGroup');
  const envFileEl = document.getElementById('rfEnvFile');
  const envNameEl = document.getElementById('rfEnvName');
  const envTextEl = document.getElementById('rfEnvText');

  // Requests that are too big for this scope (AI is allowed — see AI_TERMS).
  const OUT_OF_SCOPE = [
    'saas', 'enterprise', 'microservice', 'microservices', 'kubernetes', 'k8s',
    'blockchain', 'crypto', 'nft', 'big data', 'data lake', 'recommendation engine',
    'high[- ]?scale', 'multi[- ]?tenant', 'production[- ]?grade', 'soc ?2', 'hipaa',
    'gdpr compliance', 'distributed system', 'load balanc',
  ];
  const OOS_RE = new RegExp('\\b(' + OUT_OF_SCOPE.join('|') + ')\\b', 'i');

  // AI terms auto-enable the "bring your own key" section.
  const AI_TERMS = [
    'ai', 'a\\.i', 'artificial intelligence', 'machine learning', 'deep learning',
    'neural network', 'neural net', 'llm', 'gpt', 'chatgpt', 'openai', 'anthropic',
    'claude', 'gemini', 'stable diffusion', 'diffusion model', 'computer vision',
    'nlp', 'chatbot', 'embedding', 'prompt', 'rag', 'vector database',
  ];
  const AI_RE = new RegExp('\\b(' + AI_TERMS.join('|') + ')\\b', 'i');

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'rf-status' + (kind ? ' rf-status-' + kind : '');
  }

  function updateScopeWarning() {
    const text = titleEl.value + ' ' + descEl.value;
    const flagged = OOS_RE.test(text);
    warningEl.hidden = !flagged;
    if (!flagged) overrideEl.checked = false;
    return flagged;
  }

  function syncAiSection() {
    const text = titleEl.value + ' ' + descEl.value;
    if (AI_RE.test(text)) usesAiEl.checked = true;
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Sending…' : 'Send request';
  }

  function sanitizeName(name) {
    return (name || 'env').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'env';
  }

  // ---- Contact picker ----
  // Each platform reshapes the "contact detail" field and shows my own handle
  // (from WIPPY_CONFIG.contact) so the visitor knows who will reach out.
  const CONTACT_METHODS = {
    'Email': {
      name: 'Email', label: 'Your email', placeholder: 'you@example.com', type: 'email',
      ownerKey: 'email', intro: 'I’ll reply by email from',
      note: '— no follow or approval needed.',
      link: (h) => 'mailto:' + h,
    },
    'Discord': {
      name: 'Discord', label: 'Your Discord username', placeholder: 'username or username#0000', type: 'text',
      ownerKey: 'discord', intro: 'I’ll send a friend request from',
      note: '— Discord only allows DMs between friends or shared-server members, so accept it and I can DM you.',
    },
    'Telegram': {
      name: 'Telegram', label: 'Your Telegram handle', placeholder: '@username', type: 'text',
      ownerKey: 'telegram', intro: 'I’ll message you on Telegram at',
      alt: 'Email',
      link: (h) => 'https://t.me/' + h.replace(/^@/, ''),
    },
    'X / Twitter DM': {
      name: 'X (Twitter)', label: 'Your X (Twitter) handle', placeholder: '@username', type: 'text',
      ownerKey: 'x', intro: 'I’ll DM you on X from',
      note: '— X only delivers DMs if your account allows messages from anyone.',
      link: (h) => 'https://x.com/' + h.replace(/^@/, ''),
    },
    'GitHub': {
      name: 'GitHub', label: 'Your GitHub username', placeholder: '@username', type: 'text',
      ownerKey: 'github', intro: 'I’ll reply on GitHub as',
      note: '— GitHub has no DMs, so I’ll @mention you on the issue/PR instead.',
      link: (h) => 'https://github.com/' + h.replace(/^@/, ''),
    },
    'Instagram': {
      name: 'Instagram', label: 'Your Instagram username', placeholder: '@username', type: 'text',
      ownerKey: 'instagram', intro: 'I’ll DM you on Instagram from',
      note: '— Instagram only lets me DM people I follow or who’ve messaged me, so follow me and I’ll reach out.',
      link: (h) => 'https://www.instagram.com/' + h.replace(/^[@#]/, ''),
    },
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function buildLinkHtml(link, ownerKey, handle) {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle);
    const href = link && (ownerKey === 'email' || !isEmail) ? link(handle) : '';
    return href
      ? '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(handle) + '</a>'
      : '<strong>' + escapeHtml(handle) + '</strong>';
  }

  function updateContactField() {
    const spec = CONTACT_METHODS[methodEl.value];

    if (!spec) {
      contactLabelEl.textContent = 'Contact detail';
      contactEl.placeholder = 'you@example.com or @username';
      contactEl.type = 'text';
      contactEl.removeAttribute('inputmode');
      contactHintEl.textContent = "Where I'll send the repo link once it's built. Only I can see this.";
      ownerInfoEl.hidden = true;
      ownerInfoEl.textContent = '';
      return;
    }

    contactLabelEl.textContent = spec.label;
    contactEl.placeholder = spec.placeholder;
    contactEl.type = spec.type || 'text';
    if (spec.type === 'email') contactEl.setAttribute('inputmode', 'email');
    else contactEl.removeAttribute('inputmode');

    const handles = (window.WIPPY_CONFIG || {}).contact || {};
    const handle = String(handles[spec.ownerKey] || '').trim();

    if (!handle) {
      const alt = spec.alt ? CONTACT_METHODS[spec.alt] : null;
      const altHandle = alt ? String(handles[alt.ownerKey] || '').trim() : '';
      if (!alt || !altHandle) {
        ownerInfoEl.hidden = true;
        ownerInfoEl.textContent = '';
      } else {
        ownerInfoEl.innerHTML =
          '<span class="rf-owner-label">I\'m not on ' + escapeHtml(spec.name) + '.</span> ' +
          'Use ' + escapeHtml(alt.name) + ' instead: ' + buildLinkHtml(alt.link, alt.ownerKey, altHandle) +
          ' — pick <strong>' + escapeHtml(alt.name) + '</strong> above and I\'ll reply from there.';
        ownerInfoEl.hidden = false;
      }
      return;
    }

    ownerInfoEl.innerHTML =
      '<span class="rf-owner-label">' + escapeHtml(spec.intro) + '</span> ' + buildLinkHtml(spec.link, spec.ownerKey, handle) +
      (spec.note ? ' <span class="rf-owner-note">' + escapeHtml(spec.note) + '</span>' : '');
    ownerInfoEl.hidden = false;
  }

  // ---- Live UI ----
  descEl.addEventListener('input', () => {
    countEl.textContent = descEl.value.length;
    updateScopeWarning();
    syncAiSection();
  });
  titleEl.addEventListener('input', () => { updateScopeWarning(); syncAiSection(); });
  usesAiEl.addEventListener('change', syncAiSection);
  overrideEl.addEventListener('change', () => setStatus(''));
  envFileEl.addEventListener('change', () => {
    if (envNameEl) envNameEl.textContent = envFileEl.files[0] ? envFileEl.files[0].name : 'No file chosen';
  });
  methodEl.addEventListener('change', updateContactField);
  updateContactField();

  if (!isConfigured || !client) {
    submitBtn.disabled = true;
    setStatus('Requests are temporarily unavailable. Please try again later.', 'error');
  }

  // ---- Submit ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isConfigured || !client) return;

    const title = titleEl.value.trim();
    const description = descEl.value.trim();
    const scope = scopeEl.value;
    const contactMethod = methodEl.value;
    const contactValue = contactEl.value.trim();
    const usesAi = usesAiEl.checked;
    const envFile = envFileEl.files && envFileEl.files[0];
    const envText = envTextEl.value.trim();

    if (!title) { setStatus('Please add a short title for your request.', 'error'); titleEl.focus(); return; }
    if (!description) { setStatus('Please describe what you want built.', 'error'); descEl.focus(); return; }
    if (!scope) { setStatus('Please choose a scope.', 'error'); scopeEl.focus(); return; }
    if (!contactMethod) { setStatus('Please pick a preferred contact method.', 'error'); methodEl.focus(); return; }
    if (!contactValue) { setStatus('Please leave a contact detail so I can reach you.', 'error'); contactEl.focus(); return; }
    if (usesAi && !envFile && !envText) {
      setStatus('AI requests need your API key — upload a .env or paste its contents.', 'error');
      envGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (envFile && envFile.size > ENV_MAX_BYTES) {
      setStatus('That .env file is too large (max 100 KB).', 'error');
      return;
    }
    if (!ackEl.checked) { setStatus('Please confirm the request fits the scope above.', 'error'); ackEl.focus(); return; }

    if (updateScopeWarning() && !overrideEl.checked) {
      setStatus('This looks out of scope — simplify it or tick "Submit anyway".', 'error');
      return;
    }

    setStatus('');
    setBusy(true);
    try {
      // 1. Upload the .env file to private storage (optional).
      let envFilePath = null;
      let envFileName = null;
      if (envFile) {
        const path = crypto.randomUUID() + '/' + sanitizeName(envFile.name);
        const { error: upErr } = await client.storage
          .from(ENV_BUCKET)
          .upload(path, envFile, { upsert: false, contentType: envFile.type || 'text/plain' });
        if (upErr) throw upErr;
        envFilePath = path;
        envFileName = envFile.name;
      }

      // 2. Insert the request row.
      const { error } = await client.from('requests').insert({
        name: nameEl.value.trim() || null,
        title,
        description,
        scope,
        contact_method: contactMethod,
        contact_value: contactValue,
        uses_ai: usesAi,
        env_content: usesAi && !envFilePath && envText ? envText : null,
        env_file_path: envFilePath,
        env_file_name: envFileName,
        out_of_scope_flag: updateScopeWarning(),
      });
      if (error) throw error;

      form.reset();
      countEl.textContent = '0';
      warningEl.hidden = true;
      if (envNameEl) envNameEl.textContent = 'No file chosen';
      setStatus("Sent! I'll reach out via " + contactMethod + ' with the repo link once it\'s built.', 'success');
    } catch (err) {
      console.error('Request submission failed:', err);
      setStatus('Something went wrong sending your request. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  });
})();
