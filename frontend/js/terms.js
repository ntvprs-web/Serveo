(function () {
  'use strict';

  const legal = window.SERVEO_LEGAL;
  if (!legal) return;
  const TERMS_VERSION = legal.version;
  const page = location.pathname.split('/').pop().toLowerCase();
  const isLegalDocument = page === 'terms.html' || page === 'privacy.html';
  const apiBase = window.SERVEO_API_BASE || (['localhost', '127.0.0.1'].includes(location.hostname) && location.port !== '3000'
    ? `${location.protocol}//${location.hostname}:3000`
    : (location.origin && location.origin !== 'null' ? location.origin : 'http://localhost:3000'));
  const GUEST_KEY = 'serveo_terms_guest_id';
  const SHOWN_SESSION_KEY = 'serveo_terms_prompt_shown_this_session';
  let guestId;

  function createGuestId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const random = new Uint8Array(16);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(random);
    else for (let i = 0; i < random.length; i++) random[i] = Math.floor(Math.random() * 256);
    random[6] = (random[6] & 0x0f) | 0x40;
    random[8] = (random[8] & 0x3f) | 0x80;
    return Array.from(random, value => value.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function guestIdentity() {
    if (guestId) return guestId;
    try {
      guestId = localStorage.getItem(GUEST_KEY);
      if (!guestId || !/^[0-9a-f-]{36}$/i.test(guestId)) {
        guestId = createGuestId();
        localStorage.setItem(GUEST_KEY, guestId);
      }
    } catch {
      guestId = createGuestId();
    }
    return guestId;
  }

  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      const token = localStorage.getItem('serveo_token');
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* The authenticated cookie may still be available. */ }
    return headers;
  }

  function renderSections(sections) {
    return sections.map(([heading, copy]) => `<section class="legal-section"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(copy)}</p></section>`).join('');
  }

  async function renderLegalDocument() {
    const article = document.getElementById('legal-document');
    if (!article) return;
    const sections = page === 'privacy.html' ? legal.privacy : legal.terms;
    const contacts = await fetchLegalContacts();
    article.innerHTML = `${renderSections(sections)}<section class="legal-section"><h2>Contact and report an issue</h2><p>Use the options below for event, donation, listing accuracy or privacy concerns. For immediate danger, contact local emergency services.</p>${contactOptions(contacts)}</section>`;
    document.querySelectorAll('[data-legal-version]').forEach(node => { node.textContent = `Version ${TERMS_VERSION}`; });
  }

  async function fetchLegalContacts() {
    try {
      const response = await fetch(`${apiBase}/api/legal/contact`, { headers: authHeaders(), credentials: 'include' });
      if (!response.ok) throw new Error('Contact settings unavailable');
      return await response.json();
    } catch {
      return { supportEmail: '', privacyEmail: '' };
    }
  }

  function contactOptions(contacts) {
    const support = String(contacts.supportEmail || '').trim();
    const privacy = String(contacts.privacyEmail || '').trim();
    const makeLink = (email, subject) => email
      ? `<a href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}">${escapeHtml(email)}</a>`
      : '<span>Official contact email is not configured yet.</span>';
    return `<div class="terms-contacts" aria-label="Contact and reporting options">
      <div class="terms-contact-card"><strong>Suspicious event or incorrect event information</strong>${makeLink(support, 'SERVEO event report')}</div>
      <div class="terms-contact-card"><strong>Donation or urgent blood concern</strong>${makeLink(support, 'SERVEO donation or urgent blood report')}</div>
      <div class="terms-contact-card"><strong>Privacy concern or personal-data request</strong>${makeLink(privacy, 'SERVEO privacy request')}</div>
      <div class="terms-contact-card"><strong>Other support</strong>${makeLink(support, 'SERVEO support request')}</div>
    </div>`;
  }

  function buildGate(contacts) {
    const backdrop = document.createElement('div');
    backdrop.className = 'terms-backdrop';
    backdrop.id = 'serveo-terms-backdrop';
    backdrop.innerHTML = `<section class="terms-sheet terms-suggestion" role="region" aria-labelledby="terms-sheet-title" aria-describedby="terms-sheet-intro">
      <header class="terms-sheet-header">
        <div class="terms-grabber" aria-hidden="true"></div>
        <div class="terms-brand-row"><div class="terms-brand"><span class="terms-brand-mark" aria-hidden="true">🌍</span><span>SERVEO</span></div><span class="terms-version">Terms version ${escapeHtml(TERMS_VERSION)}</span></div>
        <h2 id="terms-sheet-title">Terms &amp; Conditions</h2>
        <p class="terms-intro" id="terms-sheet-intro">Please take a moment to review SERVEO’s Terms &amp; Conditions and separate Privacy Policy before exploring.</p>
      </header>
      <div class="terms-progress" role="progressbar" aria-label="Terms reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="terms-progress-fill"></div></div>
      <div class="terms-sheet-body" id="terms-sheet-scroll">
        <div class="terms-copy is-collapsed" id="terms-sheet-copy">${legal.terms.map(([heading, copy]) => `<h3>${escapeHtml(heading)}</h3><p>${escapeHtml(copy)}</p>`).join('')}${contactOptions(contacts)}</div>
        <button type="button" class="terms-readmore" id="terms-readmore" aria-expanded="false" aria-controls="terms-sheet-copy">Read more</button>
        <p class="terms-reading-hint" id="terms-reading-hint">Read more to explore the full terms. You can continue using SERVEO at any time.</p>
      </div>
      <footer class="terms-footer">
        <div class="terms-agreement"><input type="checkbox" id="terms-agree" aria-label="I have read and agree to the Terms and Conditions and Privacy Policy"><span>I have read and agree to the <a href="terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>. Check to continue.</span></div>
        <p class="terms-status" id="terms-status" role="status" aria-live="polite"></p>
      </footer>
    </section>`;
    document.body.appendChild(backdrop);

    const copy = backdrop.querySelector('#terms-sheet-copy');
    const scroller = backdrop.querySelector('#terms-sheet-scroll');
    const readMore = backdrop.querySelector('#terms-readmore');
    const hint = backdrop.querySelector('#terms-reading-hint');
    const agreement = backdrop.querySelector('#terms-agree');
    const status = backdrop.querySelector('#terms-status');
    const progress = backdrop.querySelector('.terms-progress');
    const fill = backdrop.querySelector('.terms-progress-fill');
    let expanded = false;

    const updateReading = () => {
      const range = scroller.scrollHeight - scroller.clientHeight;
      const percent = range <= 0 ? 100 : Math.min(100, Math.round((scroller.scrollTop / range) * 100));
      fill.style.width = `${percent}%`;
      progress.setAttribute('aria-valuenow', String(percent));
      if (expanded && range > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8) {
        hint.textContent = 'You’ve reached the end of the terms. Thanks for reviewing them.';
      }
    };

    readMore.addEventListener('click', () => {
      expanded = !expanded;
      copy.classList.toggle('is-collapsed', !expanded);
      readMore.textContent = expanded ? 'Show less' : 'Read more';
      readMore.setAttribute('aria-expanded', String(expanded));
      requestAnimationFrame(updateReading);
    });
    scroller.addEventListener('scroll', updateReading, { passive: true });
    window.addEventListener('resize', updateReading, { passive: true });
    agreement.addEventListener('change', async () => {
      if (!agreement.checked) return;
      status.classList.remove('is-error');
      status.textContent = 'Thanks for reviewing SERVEO’s terms.';
      backdrop.classList.remove('is-visible');
      window.setTimeout(() => backdrop.remove(), 280);
      try {
        const response = await fetch(`${apiBase}/api/terms/accept`, {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: authHeaders(),
          body: JSON.stringify({ guestId: guestIdentity() })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.version !== TERMS_VERSION) throw new Error(result.message || 'Acceptance could not be saved. Please retry.');
      } catch (error) {
        // This is a suggestion rather than a platform lock: keep the site usable
        // even if the optional agreement record cannot be reached right now.
        console.warn('SERVEO terms acknowledgement was not saved:', error);
      }
    });

    requestAnimationFrame(() => {
      backdrop.classList.add('is-visible');
      updateReading();
    });
  }

  async function startGate() {
    if (isLegalDocument) {
      renderLegalDocument();
      return;
    }
    // The first-visit suggestion belongs only on the Home page. The legal
    // documents remain directly accessible from their links on any page.
    if (page !== 'index.html' && page !== '') return;
    try {
      if (sessionStorage.getItem(SHOWN_SESSION_KEY) === '1') return;
    } catch { /* Fall back to the server acceptance record if storage is unavailable. */ }
    try {
      const contacts = await fetchLegalContacts();
      const response = await fetch(`${apiBase}/api/terms/status?guestId=${encodeURIComponent(guestIdentity())}`, {
        credentials: 'include', headers: authHeaders()
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.version !== TERMS_VERSION) throw new Error(result.message || 'Unable to verify your agreement right now.');
      if (!result.accepted) {
        try { sessionStorage.setItem(SHOWN_SESSION_KEY, '1'); } catch { /* The sheet still works without session storage. */ }
        buildGate(contacts);
      }
    } catch {
      // The informational sheet should not block SERVEO if the API is offline.
      try { sessionStorage.setItem(SHOWN_SESSION_KEY, '1'); } catch { /* The page remains usable without session storage. */ }
      buildGate({ supportEmail: '', privacyEmail: '' });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startGate, { once: true });
  else startGate();
})();
