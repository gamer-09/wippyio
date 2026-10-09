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
