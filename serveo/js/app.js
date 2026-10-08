/* ============================================
   NAVBAR
   ============================================ */
function getNavbarHTML(active) {
  const links = [
    { id: 'home', href: 'index.html', label: 'Home' },
    { id: 'map', href: 'map.html', label: 'Live Map' },
    { id: 'events', href: 'events.html', label: 'Events' },
    { id: 'impact', href: 'impact.html', label: 'Impact' },
    { id: 'about', href: 'about.html', label: 'About' },
  ];

  const linksHTML = links.map(l =>
    `<a href="${l.href}" class="${active === l.id ? 'active' : ''}">${l.label}</a>`
  ).join('');

  return `
    <nav class="navbar">
      <div class="navbar-inner">
        <a href="index.html" class="navbar-brand">
          <span class="navbar-brand-mark pulse-ring" style="color: rgba(0,212,170,0.6)">🌍</span>
          <span class="brand-full">SERVEO</span>
        </a>
        <div class="navbar-links" id="navbar-links">${linksHTML}</div>
        <div class="navbar-actions">
          <a href="organizer.html" class="btn btn-secondary btn-sm">Organizer Login</a>
          <a href="post-event.html" class="btn btn-primary btn-sm">Post an Event</a>
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
});
