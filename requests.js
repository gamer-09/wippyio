/*
 * © 2026 gamer-09. All rights reserved.
 * Build-request form — submits to Supabase (insert only, enforced by RLS).
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

  // Terms that signal an out-of-scope request. Matched on word boundaries.
  const OUT_OF_SCOPE = [
    'ai', 'a\\.i', 'artificial intelligence', 'machine learning', 'deep learning',
    'neural network', 'neural net', 'llm', 'gpt', 'chatgpt', 'chatbot', 'openai',
    'anthropic', 'stable diffusion', 'diffusion model', 'computer vision', 'nlp',
    'model training', 'train a model', 'fine[- ]?tune', 'saas', 'enterprise',
    'microservice', 'microservices', 'kubernetes', 'k8s', 'blockchain', 'crypto',
    'nft', 'big data', 'data lake', 'recommendation engine', 'high[- ]?scale',
    'multi[- ]?tenant', 'production[- ]?grade', 'soc ?2', 'hipaa', 'gdpr compliance',
  ];
  const OOS_RE = new RegExp('\\b(' + OUT_OF_SCOPE.join('|') + ')\\b', 'i');

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'rf-status' + (kind ? ' rf-status-' + kind : '');
  }

  function updateWarning() {
    const text = (titleEl.value + ' ' + descEl.value);
    const flagged = OOS_RE.test(text);
    warningEl.hidden = !flagged;
    if (!flagged) overrideEl.checked = false;
    return flagged;
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Sending…' : 'Send request';
  }

  // ---- Live UI ----
  descEl.addEventListener('input', () => {
    countEl.textContent = descEl.value.length;
    updateWarning();
  });
  titleEl.addEventListener('input', updateWarning);
  overrideEl.addEventListener('change', () => setStatus(''));

  if (!isConfigured || !client) {
    submitBtn.disabled = true;
    setStatus('Requests are temporarily unavailable. Please try again later.', 'error');
  }

  // ---- Submit ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isConfigured || !client) return;

    // Manual validation (form is novalidate for friendlier messages).
    const title = titleEl.value.trim();
    const description = descEl.value.trim();
    const scope = scopeEl.value;
    const contactMethod = methodEl.value;
    const contactValue = contactEl.value.trim();

    if (!title) return setStatus('Please add a short title for your request.', 'error'), titleEl.focus();
    if (!description) return setStatus('Please describe what you want built.', 'error'), descEl.focus();
    if (!scope) return setStatus('Please choose a scope.', 'error'), scopeEl.focus();
    if (!contactMethod) return setStatus('Please pick a preferred contact method.', 'error'), methodEl.focus();
    if (!contactValue) return setStatus('Please leave a contact detail so I can reach you.', 'error'), contactEl.focus();
    if (!ackEl.checked) return setStatus('Please confirm the request fits the scope above.', 'error'), ackEl.focus();

    if (updateWarning() && !overrideEl.checked) {
      return setStatus('This looks out of scope — simplify it or tick "Submit anyway".', 'error');
    }

    setStatus('');
    setBusy(true);
    try {
      const { error } = await client.from('requests').insert({
        name: nameEl.value.trim() || null,
        title,
        description,
        scope,
        contact_method: contactMethod,
        contact_value: contactValue,
        out_of_scope_flag: updateWarning(),
      });
      if (error) throw error;

      form.reset();
      countEl.textContent = '0';
      warningEl.hidden = true;
      setStatus("Sent! I'll reach out via " + contactMethod + ' with the repo link once it\'s built.', 'success');
    } catch (err) {
      console.error('Request submission failed:', err);
      setStatus('Something went wrong sending your request. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  });
})();
