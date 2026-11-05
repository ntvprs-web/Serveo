/* ============================================
   NAVBAR
   ============================================ */
const SERVEO_THEME_STORAGE_KEY = 'serveo_theme';
const SERVEO_THEME_OPTIONS = [
  { id: 'neumorphic', label: 'Neumorphic Slate' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'light', label: 'Pearl Light' },
  { id: 'ocean', label: 'Deep Ocean' },
  { id: 'violet', label: 'Amethyst' },
  { id: 'forest', label: 'Forest' },
];
const SERVEO_LOCAL_API_BASE = (() => {
  const { protocol, hostname, origin, port } = window.location;
  if (protocol === 'file:' || origin === 'null') return 'http://localhost:3000';
  return ['localhost', '127.0.0.1'].includes(hostname) && port !== '3000'
    ? `${protocol}//${hostname}:3000`
    : origin;
})();
window.SERVEO_API_BASE = SERVEO_LOCAL_API_BASE;

/* Translation disabled at the user's request.
function getServeoLanguage() {
  try {
    const saved = sessionStorage.getItem('serveo_language');
    if (['en', 'hi'].includes(saved)) return saved;
    sessionStorage.setItem('serveo_language', 'en');
    return 'en';
  } catch { return 'en'; }
}
function clearGoogleTranslateState() {
  // Google Translate persists its own language in this cookie. Remove stale
  // Hindi state whenever SERVEO's session preference is English.
  const host = location.hostname.split('.');
  const scopes = [''];
  for (let i = 0; i < host.length - 1; i++) scopes.push(`; domain=.${host.slice(i).join('.')}`);
  for (const scope of scopes) {
    document.cookie = `googtrans=; Max-Age=0; path=/${scope}`;
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${scope}`;
  }
}
function applyServeoLanguage(language = getServeoLanguage(), attempts = 80) {
  if (!['en', 'hi'].includes(language)) language = 'en';
  const combo = document.querySelector('#google_translate_element .goog-te-combo');
  const target = language === 'en' ? '' : 'hi';
  const ready = combo && Array.from(combo.options).some(option => option.value === target);
  if (!ready) {
    if (attempts > 0) window.setTimeout(() => applyServeoLanguage(getServeoLanguage(), attempts - 1), 250);
    return;
  }
  const changeGoogleLanguage = value => {
    combo.value = value;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
  };
  if (language === 'en') {
    // Google Translate replaces its original-language option with a blank
    // option. Its widget requires two change events to restore the source DOM.
    changeGoogleLanguage('');
    changeGoogleLanguage('');
    window.setTimeout(clearGoogleTranslateState, 1500);
  } else {
    changeGoogleLanguage(target);
  }
}
window.applyServeoLanguage = applyServeoLanguage;

function protectServeoBrand(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!/\bSERVEO\b/.test(node.nodeValue || '') || node.parentElement?.closest('[translate="no"], .notranslate, script, style, textarea')) continue;
    textNodes.push(node);
  }
  for (const node of textNodes) {
    const parts = node.nodeValue.split(/(\bSERVEO\b)/g);
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (part === 'SERVEO') {
        const brand = document.createElement('span');
        brand.className = 'notranslate';
        brand.setAttribute('translate', 'no');
        brand.textContent = part;
        fragment.appendChild(brand);
      } else if (part) fragment.appendChild(document.createTextNode(part));
    }
    node.replaceWith(fragment);
  }
}

function initializeServeoTranslator() {
  if (document.getElementById('google_translate_element')) return;
  const mount = document.createElement('div');
  mount.id = 'google_translate_element';
  mount.hidden = true;
  document.body.appendChild(mount);
  window.googleTranslateElementInit = () => {
    new google.translate.TranslateElement({
      pageLanguage: 'en', includedLanguages: 'hi', autoDisplay: false,
    }, 'google_translate_element');
    applyServeoLanguage(getServeoLanguage());
  };
  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.head.appendChild(script);
}
*/
function getServeoTheme() {
  try {
    const saved = localStorage.getItem(SERVEO_THEME_STORAGE_KEY);
    return SERVEO_THEME_OPTIONS.some(theme => theme.id === saved) ? saved : 'neumorphic';
  } catch { return 'neumorphic'; }
}

function setServeoTheme(themeId) {
  const theme = SERVEO_THEME_OPTIONS.some(item => item.id === themeId) ? themeId : 'neumorphic';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(SERVEO_THEME_STORAGE_KEY, theme); } catch { }
  window.dispatchEvent(new CustomEvent('serveo:themechange', { detail: { theme } }));
}

setServeoTheme(getServeoTheme());

function loadServeoMotionScript(id, src, globalName) {
  if (window[globalName]) return Promise.resolve(true);
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve(Boolean(window[globalName]));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function wireServeoPressMotion(gsap) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const pressed = new Map();
  const selector = 'button:not(:disabled), .btn:not([aria-disabled="true"]), [role="button"]:not([aria-disabled="true"]), input[type="submit"]:not(:disabled)';
  const findButton = target => target instanceof Element ? target.closest(selector) : null;

  const release = button => {
    if (!button || !button.isConnected) return;
    gsap.killTweensOf(button);
    gsap.to(button, {
      scale: 1,
      y: 0,
      duration: 0.22,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => gsap.set(button, { clearProps: 'transform,transformOrigin' })
    });
  };

  document.addEventListener('pointerdown', event => {
    const button = findButton(event.target);
    if (!button || button.closest('.mapboxgl-ctrl, .side-drawer-backdrop') || button.getAttribute('aria-disabled') === 'true') return;
    pressed.set(event.pointerId, button);
    gsap.killTweensOf(button);
    gsap.to(button, { scale: 0.975, y: 1.5, duration: 0.08, ease: 'power2.out', overwrite: true, transformOrigin: '50% 50%' });
  }, { passive: true });

  const finishPointer = event => {
    const button = pressed.get(event.pointerId);
    if (!button) return;
    pressed.delete(event.pointerId);
    release(button);
  };
  document.addEventListener('pointerup', finishPointer, { passive: true });
  document.addEventListener('pointercancel', finishPointer, { passive: true });
  window.addEventListener('blur', () => {
    pressed.forEach(release);
    pressed.clear();
  });

  document.addEventListener('click', event => {
    if (event.detail !== 0) return;
    const button = findButton(event.target);
    if (!button || button.getAttribute('aria-disabled') === 'true') return;
    gsap.fromTo(button, { scale: 0.975, y: 1 }, {
      scale: 1,
      y: 0,
      duration: 0.22,
      ease: 'power2.out',
      clearProps: 'transform,transformOrigin'
    });
  }, true);
}

function initServeoMotion() {
  if (window.serveoMotionInitialized) return;
  window.serveoMotionInitialized = true;

  Promise.all([
    loadServeoMotionScript('serveo-gsap', '/vendor/gsap.min.js', 'gsap'),
    loadServeoMotionScript('serveo-lenis', '/vendor/lenis.min.js', 'Lenis')
  ]).then(() => {
    if (window.Lenis && !window.serveoLenis) {
      try {
        window.serveoLenis = new window.Lenis({
          autoRaf: true,
          anchors: true,
          lerp: 0.13,
          respectReducedMotion: true,
          stopInertiaOnNavigate: true,
          prevent: node => node instanceof Element && Boolean(node.closest('.side-drawer, .mapboxgl-map, .leaflet-container, .volunteer-dialog, .auth-modal, [data-lenis-prevent]'))
        });
      } catch (error) {
        console.warn('SERVEO smooth scrolling could not initialize.', error);
      }
    }
    if (window.gsap) wireServeoPressMotion(window.gsap);
  });
}

function getNavbarHTML(active) {
  const primaryLinks = [
    { id: 'home', href: 'index.html', label: 'Home' },
    { id: 'map', href: 'map.html', label: 'Live Map' },
    { id: 'events', href: 'events.html', label: 'Events' },
  ];
  const links = [
    { id: 'impact', href: 'impact.html', label: 'Impact', icon: '↗' },
    { id: 'urgent-blood', href: 'urgent-blood.html', label: 'Urgent Blood Requests', icon: '🩸' },
    { id: 'badges', href: 'badges.html', label: 'Verified Badge Shop', icon: '🏅' },
    { id: 'about', href: 'about.html', label: 'About', icon: 'ⓘ' },
    { id: 'organizer', href: 'organizer.html', label: 'Organizer Dashboard', icon: '▣' },
    { id: 'org-login', href: 'login.html?role=organizer', label: 'Organization Login', icon: '🏥' },
  ];
  const currentTheme = getServeoTheme();

  const linksHTML = links.map(l =>
    `<a href="${l.href}" class="drawer-link ${active === l.id ? 'active' : ''}"><span class="drawer-link-icon" aria-hidden="true">${l.icon}</span><span>${l.label}</span></a>`
  ).join('');
  const primaryLinksHTML = primaryLinks.map(l =>
    `<a href="${l.href}" class="primary-nav-link ${active === l.id ? 'active' : ''}">${l.label}</a>`
  ).join('');
  const themeSelectorHTML = `
    <div class="lang-selector-wrap">
      <select id="serveo-theme-select" class="lang-select" aria-label="Choose website theme">
        ${SERVEO_THEME_OPTIONS.map(theme => `<option value="${theme.id}" ${currentTheme === theme.id ? 'selected' : ''}>${theme.label}</option>`).join('')}
      </select>
    </div>
  `;

  const premiumLabel = isServeoPremium() ? 'Premium Active' : 'Upgrade to Premium';

  return `
    <nav class="navbar">
      <div class="navbar-inner">
        <a href="index.html" class="navbar-brand">
          <span class="navbar-brand-mark pulse-ring" style="color: rgba(0,212,170,0.6)">🌍</span>
          <span class="brand-full">SERVEO</span>
        </a>
        <nav class="navbar-primary-nav" aria-label="Primary navigation">
          ${primaryLinksHTML}
        </nav>
        <div class="navbar-actions">
          <a id="notif-toggle-btn" class="navbar-emergency-alert" href="urgent-blood.html" title="Open urgent blood emergency requests" aria-label="Open urgent blood emergency requests">
            <span class="emergency-alert-icon" aria-hidden="true">🚨</span><span class="emergency-alert-label">Emergency Alerts</span><span class="emergency-alert-dot" aria-hidden="true"></span>
          </a>
          <a href="post-event.html" class="btn btn-primary btn-sm navbar-post-event" title="Post an Event" aria-label="Post an Event"><span class="navbar-post-event-icon" aria-hidden="true">📢</span><span class="navbar-post-event-label">Post an Event</span></a>
          <button class="side-menu-toggle" id="side-menu-toggle" type="button" aria-label="Open navigation menu" aria-controls="site-side-drawer" aria-expanded="false">
            <span class="side-menu-glyph" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
        </div>
      </div>
    </nav>
    <button class="side-drawer-backdrop" id="side-drawer-backdrop" type="button" aria-label="Close navigation menu" tabindex="-1"></button>
    <aside class="side-drawer" id="site-side-drawer" aria-label="Navigation" aria-hidden="true">
        <div class="drawer-header">
          <div class="drawer-profile-mark">🌍</div>
          <div class="drawer-profile-copy">
            <span class="drawer-eyebrow"><span>SERVEO</span> <span>COMMUNITY</span></span>
            <strong id="drawer-user-status">Explore as guest</strong>
          </div>
          <button class="drawer-close" id="side-drawer-close" type="button" aria-label="Close navigation menu">×</button>
        </div>
        <a href="premium.html" class="drawer-premium-card ${active === 'premium' ? 'active' : ''}">
          <span class="drawer-premium-icon" aria-hidden="true">✦</span>
          <span><strong>${premiumLabel}</strong><small>Unlock longer event search distances</small></span>
          <span class="drawer-chevron" aria-hidden="true">›</span>
        </a>
        <nav class="drawer-nav" aria-label="Main menu">
          ${linksHTML}
        </nav>
        <section class="drawer-activity" aria-labelledby="drawer-activity-title">
          <div class="drawer-activity-heading"><span id="drawer-activity-title">YOUR ACTIVITY</span><span id="drawer-activity-count">3 records</span></div>
          <div class="drawer-activity-filters" role="group" aria-label="Filter activity records">
            <button class="is-active" type="button" data-activity-kind="all" aria-pressed="true">All</button>
            <button type="button" data-activity-kind="volunteer" aria-pressed="false">Volunteered</button>
            <button type="button" data-activity-kind="organized" aria-pressed="false">Organized</button>
          </div>
          <div class="drawer-activity-list" id="drawer-activity-list" aria-live="polite"></div>
        </section>
        <div class="drawer-utilities">
          <div class="drawer-language drawer-theme">
            <label for="serveo-theme-select"><span aria-hidden="true">◐</span> <span>Theme</span></label>
            ${themeSelectorHTML}
          </div>
          <a href="login.html" class="drawer-auth-link" id="drawer-login-link"><span aria-hidden="true">🔑</span> <span>Login / Register</span></a>
          <button class="drawer-auth-link drawer-logout-button" id="drawer-logout-button" type="button" hidden><span aria-hidden="true">↪</span> <span>Logout</span></button>
        </div>
    </aside>`;
}

function isServeoPremium() {
  try { return localStorage.getItem('serveo_premium_status') === 'active'; }
  catch { return false; }
}

/* ============================================
   FOOTER
   ============================================ */
function getFooterHTML() {
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-about">
            <div class="footer-brand">
              <span class="navbar-brand-mark">🌍</span>
              <span>SERVEO</span>
            </div>
            <p>A crowdsourced, location-based platform mapping public-service events in real time — closing the gap between wanting to help and actually helping.</p>
            <div class="footer-sdg" title="Mapped to UN SDGs 3, 11, 16 &amp; 17">
              <span style="background:#4c9f38">3</span>
              <span style="background:#fd9d24">11</span>
              <span style="background:#00689d">16</span>
              <span style="background:#19486a">17</span>
            </div>
          </div>
          <div class="footer-col">
            <h4>Platform</h4>
            <a href="map.html">Live Map</a>
            <a href="events.html">Browse Events</a>
            <a href="post-event.html">Post an Event</a>
            <a href="impact.html">Impact Dashboard</a>
          </div>
          <div class="footer-col">
            <h4>Organizers</h4>
            <a href="login.html?role=organizer">Organization Login</a>
            <a href="organizer.html">Organizer Dashboard</a>
            <a href="post-event.html">Get Verified</a>
            <a href="about.html">Trust &amp; Safety</a>
          </div>
          <div class="footer-col">
            <h4>About</h4>
            <a href="about.html">Our Mission</a>
            <a href="about.html">Tech Stack</a>
            <a href="about.html">Roadmap</a>
            <a href="terms.html">Terms &amp; Conditions</a>
            <a href="privacy.html">Privacy Policy</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 SERVEO — Mini Project, ABES Institute of Technology, Ghaziabad</span>
          <div class="footer-bottom-links">
            <span>Built for community, not commerce</span>
          </div>
        </div>
      </div>
    </footer>`;
}

/* ============================================
   ACTIVITY RECORDS IN THE SIDE DRAWER
   ============================================ */
const SERVEO_ACTIVITY_STORAGE_KEY = 'serveo_volunteer_activity';
const SERVEO_ACTIVITY_FILTER_KEY = 'serveo_activity_filter';
let drawerActivityUser = null;
let drawerActivityEvents = [];
let drawerActivityEventsAreSample = false;
let drawerServerVolunteerRecords = [];
let drawerActivityFilter = 'all';

const SAMPLE_DRAWER_ACTIVITY = [
  { id: 'sample-current-tech', kind: 'volunteer', title: 'Tech for Good Community Workshop', category: 'tech', organizer: 'Spark Youth Collective', date: '2026-10-24', activityStatus: 'Participating', sample: true },
  { id: 'sample-attended-book-drive', kind: 'volunteer', title: 'Neighbourhood Book Drive', category: 'education', organizer: 'Community Learning Circle', date: '2026-09-12', activityStatus: 'Attended', sample: true },
  { id: 'sample-organized-blood-camp', kind: 'organized', title: 'Community Blood Donation Camp', category: 'blood', organizer: 'SERVEO Community', date: '2026-10-03', activityStatus: 'Hosted', sample: true },
];

function drawerEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function recordOrganizedEvent(event) {
  if (!event?.id) return;
  try {
    const records = JSON.parse(localStorage.getItem(SERVEO_ACTIVITY_STORAGE_KEY) || '[]');
    const current = Array.isArray(records) ? records : [];
    const id = String(event.id);
    const record = {
      id,
      kind: 'organized',
      title: String(event.title || 'Community event'),
      category: String(event.category || 'other'),
      organizer: String(event.organizer || ''),
      date: String(event.date || ''),
      city: String(event.city || ''),
      address: String(event.address || ''),
      activityStatus: event.status === 'pending' ? 'Awaiting approval' : 'Hosted',
      createdAt: new Date().toISOString(),
    };
    const updated = current.filter(item => !(String(item.id) === id && item.kind === 'organized'));
    updated.unshift(record);
    localStorage.setItem(SERVEO_ACTIVITY_STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
    window.dispatchEvent(new CustomEvent('serveo:activity-updated'));
  } catch { }
}

window.serveoRecordOrganizedEvent = recordOrganizedEvent;

function getDrawerActivityRecords() {
  let records = [];
  try {
    const stored = JSON.parse(localStorage.getItem(SERVEO_ACTIVITY_STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) records = stored.filter(record => record && record.id).map(record => ({ ...record, id: String(record.id) }));
  } catch { }

  for (const record of drawerServerVolunteerRecords) {
    const normalized = {
      ...record,
      id: String(record.id),
      kind: 'volunteer',
      activityStatus: record.status === 'registered' ? 'Registered' : (record.status || 'Registered'),
    };
    if (!records.some(item => item.kind === 'volunteer' && item.id === normalized.id)) records.push(normalized);
  }

  // Migrate older volunteer joins, which stored only event ids.
  try {
    const joined = JSON.parse(localStorage.getItem('serveo_joined') || '[]');
    const allEvents = [...drawerActivityEvents, ...(typeof EVENTS_DATA !== 'undefined' ? EVENTS_DATA : [])];
    for (const id of Array.isArray(joined) ? joined : []) {
      if (records.some(record => record.id === String(id))) continue;
      const event = allEvents.find(item => String(item.id) === String(id));
      if (event) records.push({
        id: String(event.id), kind: 'volunteer', title: event.title, category: event.category,
        organizer: event.organizer, date: event.date, city: event.city, address: event.address,
        activityStatus: 'Registered',
        sample: drawerActivityEventsAreSample || Boolean(event.isSample),
      });
    }
  } catch { }

  const user = drawerActivityUser;
  const userName = String(user?.name || '').trim().toLowerCase();
  const organized = drawerActivityEvents.filter(event =>
    (user?.id && String(event.ownerId || '') === String(user.id)) ||
    (userName && String(event.organizer || '').trim().toLowerCase() === userName)
  ).map(event => ({
    id: String(event.id), kind: 'organized', title: event.title, category: event.category,
    organizer: event.organizer, date: event.date, city: event.city, address: event.address,
    activityStatus: event.status === 'pending' ? 'Awaiting approval' : 'Hosted',
    sample: drawerActivityEventsAreSample,
  }));

  const approvedById = new Map(organized.map(event => [event.id, event]));
  const refreshedRecords = records.map(record => {
    const approved = record.kind === 'organized' ? approvedById.get(record.id) : null;
    return approved ? { ...record, activityStatus: 'Hosted' } : record;
  });
  const actual = [...refreshedRecords, ...organized.filter(event => !records.some(record => record.kind === 'organized' && record.id === event.id))];
  return actual.length ? actual : SAMPLE_DRAWER_ACTIVITY;
}

function drawerRecordStatus(record) {
  if (record.activityStatus && !['Registered', 'Registered · upcoming', 'Past registration'].includes(record.activityStatus)) return record.activityStatus;
  if (!record.date) return 'Registered';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(`${record.date}T12:00:00`);
  if (Number.isNaN(eventDay.getTime())) return 'Registered';
  eventDay.setHours(0, 0, 0, 0);
  if (eventDay.getTime() === today.getTime()) return 'Currently volunteering';
  if (eventDay > today) return 'Registered · upcoming';
  return 'Past signup';
}

function renderDrawerActivity() {
  const list = document.getElementById('drawer-activity-list');
  const count = document.getElementById('drawer-activity-count');
  if (!list || !count) return;

  const records = getDrawerActivityRecords();
  const filtered = drawerActivityFilter === 'all' ? records : records.filter(record => record.kind === drawerActivityFilter);
  count.textContent = `${records.length} ${(records.length === 1 ? 'record' : 'records')}`;

  if (!filtered.length) {
    list.innerHTML = `<p class="drawer-activity-empty">${'No records in this section yet.'}</p>`;
    return;
  }

  list.innerHTML = filtered.slice(0, 8).map(record => {
    const category = typeof getCategoryInfo === 'function' ? getCategoryInfo(record.category) : { icon: '🌍', label: 'Community' };
    const dateLabel = record.date ? new Date(`${record.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Date pending';
    const url = record.sample ? 'events.html' : `event-detail.html?id=${encodeURIComponent(record.id)}`;
    const kindLabel = (record.kind === 'organized' ? 'Organized' : 'Volunteering');
    const statusLabel = drawerRecordStatus(record);
    const communityEvent = 'Community event';
    const demoLabel = 'DEMO';
    return `<a class="drawer-activity-item" href="${url}">
      <span class="drawer-activity-icon" aria-hidden="true">${category.icon}</span>
      <span class="drawer-activity-copy"><strong>${drawerEscape(record.title || communityEvent)}</strong><small>${kindLabel} · ${drawerEscape(statusLabel)} · ${drawerEscape(dateLabel)}</small></span>
      ${record.sample ? `<span class="drawer-activity-demo">${demoLabel}</span>` : ''}
    </a>`;
  }).join('');
}

/* ============================================
   SIDE NAVIGATION & SESSION ACTIONS
   ============================================ */
function initSideDrawer() {
  const drawer = document.getElementById('site-side-drawer');
  const toggle = document.getElementById('side-menu-toggle');
  const backdrop = document.getElementById('side-drawer-backdrop');
  const closeButton = document.getElementById('side-drawer-close');
  if (!drawer || !toggle || !backdrop || !closeButton) return;

  const setOpen = (open) => {
    drawer.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-visible', open);
    drawer.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', (open ? 'Close navigation menu' : 'Open navigation menu'));
    document.body.classList.toggle('drawer-open', open);
    if (open) closeButton.focus();
    else toggle.focus();
  };

  toggle.addEventListener('click', () => setOpen(drawer.getAttribute('aria-hidden') === 'true'));
  closeButton.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  drawer.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) setOpen(false);
  });

  const loginLink = document.getElementById('drawer-login-link');
  const logoutButton = document.getElementById('drawer-logout-button');
  const userStatus = document.getElementById('drawer-user-status');
  const themeSelect = document.getElementById('serveo-theme-select');
  themeSelect.value = getServeoTheme();
  themeSelect.addEventListener('change', () => setServeoTheme(themeSelect.value));

  try { drawerActivityFilter = localStorage.getItem(SERVEO_ACTIVITY_FILTER_KEY) || 'all'; } catch { drawerActivityFilter = 'all'; }
  if (!['all', 'volunteer', 'organized'].includes(drawerActivityFilter)) drawerActivityFilter = 'all';
  const activityFilters = drawer.querySelectorAll('[data-activity-kind]');
  activityFilters.forEach(button => {
    const active = button.dataset.activityKind === drawerActivityFilter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.addEventListener('click', () => {
      drawerActivityFilter = button.dataset.activityKind;
      try { localStorage.setItem(SERVEO_ACTIVITY_FILTER_KEY, drawerActivityFilter); } catch { }
      activityFilters.forEach(item => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      renderDrawerActivity();
    });
  });
  renderDrawerActivity();
  window.addEventListener('serveo:activity-updated', renderDrawerActivity);
  window.addEventListener('storage', event => {
    if (event.key === SERVEO_ACTIVITY_STORAGE_KEY || event.key === 'serveo_joined') renderDrawerActivity();
  });

  const updateNavUser = (user) => {
    const signedIn = Boolean(user);
    loginLink.hidden = signedIn;
    logoutButton.hidden = !signedIn;
    userStatus.textContent = user?.name ? `${'Welcome'}, ${user.name}` : ('Explore as guest');
  };
  updateNavUser(null);
  window.serveoUpdateNavUser = updateNavUser;

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      const { logout } = await import('./db.js');
      await logout();
      updateNavUser(null);
      window.location.assign('index.html');
    } catch (error) {
      console.error('Sign out failed:', error);
      showToast('Could not sign out. Please try again.', 'info');
      logoutButton.disabled = false;
    }
  });

  import('./db.js').then(async ({ getMe, getApprovedEvents, getMyVolunteerApplications }) => {
    const user = await getMe();
    const [events, volunteerRecords] = user ? await Promise.all([
      getApprovedEvents().catch(() => []),
      getMyVolunteerApplications().catch(() => []),
    ]) : [[], []];
    drawerActivityUser = user;
    drawerServerVolunteerRecords = volunteerRecords;
    drawerActivityEventsAreSample = !events.length;
    drawerActivityEvents = events.length ? events : (typeof EVENTS_DATA !== 'undefined' ? EVENTS_DATA : []);
    updateNavUser(user);
    renderDrawerActivity();
  }).catch(() => {
    drawerActivityEventsAreSample = true;
    drawerActivityEvents = typeof EVENTS_DATA !== 'undefined' ? EVENTS_DATA : [];
    renderDrawerActivity();
  });
}

/* ============================================
   TOAST
   ============================================ */
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function updateDynamicStats(eventUniverse = (typeof EVENTS_DATA !== 'undefined' ? EVENTS_DATA : [])) {
  const events = Array.isArray(eventUniverse) ? eventUniverse : [];
  const totalEvents = events.length;
  const volunteers = events.reduce((acc, ev) => acc + (Number(ev.volunteersJoined) || 0), 12500);
  const bloodUnits = events.filter(ev => ev.category === 'blood').reduce((acc, ev) => acc + (Number(ev.volunteersJoined) || 0) * 3, 3120);
  const mealsServed = events.filter(ev => ev.category === 'food' || ev.category === 'disaster').reduce((acc, ev) => acc + (Number(ev.volunteersJoined) || 0) * 45, 84200);
  const citiesCount = new Set(events.map(ev => ev.city).filter(Boolean)).size || 16;

  const setElText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val.toLocaleString('en-IN');
  };

  setElText('stat-events', totalEvents * 58);
  setElText('stat-volunteers', volunteers);
  setElText('stat-blood', bloodUnits);
  setElText('stat-meals', mealsServed);
  setElText('stat-cities', citiesCount);

  const liveCountEl = document.getElementById('hero-live-count');
  if (liveCountEl) {
    const liveNow = events.filter(ev => ev.urgency === 'live' || ev.urgency === 'critical').length;
    liveCountEl.textContent = `🔴 ${liveNow} Live Emergency Drives Across India`;
  }

  const eventsLive = document.getElementById('hero-events-live');
  if (eventsLive) eventsLive.textContent = events.filter(ev => ev.urgency === 'live').length + 42;

  const eventsMonth = document.getElementById('hero-events-month');
  if (eventsMonth) eventsMonth.textContent = events.length * 12 + 450;
}

window.addEventListener('DOMContentLoaded', () => {
  updateDynamicStats();
});

/* ============================================
   SCROLL REVEAL
   ============================================ */
function initScrollReveal() {
  const targets = document.querySelectorAll('.animate-on-scroll');
  if (!targets.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(t => observer.observe(t));
}

/* ============================================
   ANIMATED COUNTERS (elements with [data-count])
   ============================================ */
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const animate = (el) => {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1600;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(eased * target);
      el.textContent = value.toLocaleString('en-IN');
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target.toLocaleString('en-IN');
      }
    }
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach(c => observer.observe(c));
}

document.addEventListener('DOMContentLoaded', () => {
  initServeoMotion();
  initScrollReveal();
  initCounters();
  initSideDrawer();

  document.addEventListener('click', event => {
    const badge = event.target.closest('.verified-badge-interactive');
    if (!badge) return;
    event.preventDefault();
    event.stopPropagation();
    showToast('Organizer credentials were reviewed. This badge does not guarantee event safety or success.', 'info');
  });
  document.addEventListener('keydown', event => {
    const badge = event.target.closest('.verified-badge-interactive');
    if (!badge || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    showToast('Organizer credentials were reviewed. This badge does not guarantee event safety or success.', 'info');
  });

  // Register PWA Service Worker for offline performance
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
});
