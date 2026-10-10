/* ============================================
   NAVBAR
   ============================================ */
function getNavbarHTML(active) {
  const links = [
    { id: 'home', href: 'index.html', label: 'Home', i18n: 'nav_home' },
    { id: 'map', href: 'map.html', label: 'Live Map', i18n: 'nav_map' },
    { id: 'events', href: 'events.html', label: 'Events', i18n: 'nav_events' },
    { id: 'impact', href: 'impact.html', label: 'Impact', i18n: 'nav_impact' },
    { id: 'about', href: 'about.html', label: 'About', i18n: 'nav_about' },
  ];

  const currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem('serveo_language')) || 'en';

  const linksHTML = links.map(l =>
    `<a href="${l.href}" class="${active === l.id ? 'active' : ''}" data-i18n="${l.i18n}">${l.label}</a>`
  ).join('');

  const langSelectorHTML = `
    <div class="lang-selector-wrap">
      <select id="serveo-lang-select" class="lang-select" title="Choose Indian Language / भाषा चुनें">
        <option value="en" ${currentLang === 'en' ? 'selected' : ''}>🇮🇳 English</option>
        <option value="hi" ${currentLang === 'hi' ? 'selected' : ''}>🇮🇳 हिंदी (Hindi)</option>
        <option value="bn" ${currentLang === 'bn' ? 'selected' : ''}>🇮🇳 বাংলা (Bengali)</option>
        <option value="te" ${currentLang === 'te' ? 'selected' : ''}>🇮🇳 తెలుగు (Telugu)</option>
        <option value="mr" ${currentLang === 'mr' ? 'selected' : ''}>🇮🇳 मराठी (Marathi)</option>
        <option value="ta" ${currentLang === 'ta' ? 'selected' : ''}>🇮🇳 தமிழ் (Tamil)</option>
        <option value="gu" ${currentLang === 'gu' ? 'selected' : ''}>🇮🇳 ગુજરાતી (Gujarati)</option>
        <option value="kn" ${currentLang === 'kn' ? 'selected' : ''}>🇮🇳 ಕನ್ನಡ (Kannada)</option>
        <option value="ml" ${currentLang === 'ml' ? 'selected' : ''}>🇮🇳 മലയാളം (Malayalam)</option>
        <option value="pa" ${currentLang === 'pa' ? 'selected' : ''}>🇮🇳 ਪੰਜਾਬੀ (Punjabi)</option>
        <option value="ur" ${currentLang === 'ur' ? 'selected' : ''}>🇮🇳 اردو (Urdu)</option>
        <option value="or" ${currentLang === 'or' ? 'selected' : ''}>🇮🇳 ଓଡ଼ିଆ (Odia)</option>
      </select>
    </div>
  `;

  return `
    <nav class="navbar">
      <div class="navbar-inner">
        <a href="index.html" class="navbar-brand">
          <span class="navbar-brand-mark pulse-ring" style="color: rgba(0,212,170,0.6)">🌍</span>
          <span class="brand-full">SERVEO</span>
        </a>
        <div class="navbar-links" id="navbar-links">${linksHTML}</div>
        <div class="navbar-actions">
          ${langSelectorHTML}
          <button id="notif-toggle-btn" class="btn btn-secondary btn-sm" title="0–5 km Nearby Alert Status" style="display:inline-flex;align-items:center;gap:6px;">
            <span class="nearby-pulse-dot" style="display:inline-block"></span>
            <span data-i18n="nav_alerts">🔔 0–5km Alerts</span>
          </button>
          <a href="organizer.html" class="btn btn-secondary btn-sm" data-i18n="nav_organizer">Organizer Login</a>
          <a href="post-event.html" class="btn btn-primary btn-sm" data-i18n="nav_post_event">Post an Event</a>
          <button class="navbar-toggle" id="navbar-toggle" aria-label="Toggle menu">☰</button>
        </div>
      </div>
    </nav>`;
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
            <a href="organizer.html">Dashboard</a>
            <a href="post-event.html">Get Verified</a>
            <a href="about.html">Trust &amp; Safety</a>
          </div>
          <div class="footer-col">
            <h4>About</h4>
            <a href="about.html">Our Mission</a>
            <a href="about.html">Tech Stack</a>
            <a href="about.html">Roadmap</a>
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
   MOBILE NAV TOGGLE
   ============================================ */
document.addEventListener('click', (e) => {
  if (e.target.closest('#navbar-toggle')) {
    document.getElementById('navbar-links')?.classList.toggle('open');
  } else if (!e.target.closest('.navbar-links') && !e.target.closest('#navbar-toggle')) {
    document.getElementById('navbar-links')?.classList.remove('open');
  }
});

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
  initScrollReveal();
  initCounters();

  // Wire up 0-5km alerts button in navbar
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#notif-toggle-btn');
    if (!btn) return;

    if ('Notification' in window && Notification.permission !== 'granted') {
      try {
        await Notification.requestPermission();
      } catch (err) {}
    }

    // Trigger test nearby alert so user can see directions and volunteer flow immediately
    if (typeof window.triggerDemoNearbyAlert === 'function') {
      window.triggerDemoNearbyAlert();
    } else {
      import('./notifications.js').then(m => m.triggerDemoNearbyAlert());
    }
  });

  // Register PWA Service Worker for offline performance
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
});
