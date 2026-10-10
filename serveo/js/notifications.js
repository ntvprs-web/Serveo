/* ============================================
   SERVEO — Real-Time 0-5km Nearby Event Notifications & Directions
   ============================================ */

const NEARBY_MAX_KM = 5.0; // 0 to 5 km alert radius
let serveoBroadcastChannel = null;

try {
  serveoBroadcastChannel = new BroadcastChannel('serveo_events_notifications');
} catch (e) {
  // Fallback for older browsers
}

// Gentle notification chime using Web Audio API
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (e) {
    // AudioContext blocked or not supported
  }
}

// Request native browser notification permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Browser notifications are not supported on this device', 'info');
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showToast('🔔 0–5km Nearby alerts enabled!', 'success');
      return true;
    }
  }
  return false;
}

// Render the interactive In-App Nearby Alert Popup
export function showNearbyAlertModal(event, distanceKm) {
  playAlertSound();

  let container = document.getElementById('serveo-nearby-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'serveo-nearby-container';
    container.className = 'nearby-alert-container';
    document.body.appendChild(container);
  }

  const cat = (typeof CATEGORIES !== 'undefined' && CATEGORIES[event.category]) 
    ? CATEGORIES[event.category] 
    : { label: 'Public Service', icon: '🌍', color: '#00d4aa' };

  const directionsUrl = (typeof getDirectionsURL === 'function') 
    ? getDirectionsURL(event.lat, event.lng)
    : `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`;

  const distText = (typeof distanceKm === 'number' && !isNaN(distanceKm)) 
    ? `${distanceKm.toFixed(1)} km away from you`
    : 'within 5 km of your location';

  const card = document.createElement('div');
  card.className = 'nearby-alert-card';
  card.setAttribute('role', 'alert');

  card.innerHTML = `
    <div class="nearby-alert-header">
      <div class="nearby-alert-badge">
        <span class="nearby-pulse-dot"></span>
        <span>🚨 Welfare Alert (0–5 km)</span>
      </div>
      <button class="nearby-alert-close" aria-label="Dismiss">&times;</button>
    </div>
    <div class="nearby-alert-body">
      <div class="nearby-alert-icon" style="background:${cat.color}22; color:${cat.color}; border:1px solid ${cat.color}44;">
        ${cat.icon}
      </div>
      <div class="nearby-alert-info">
        <div class="nearby-alert-category" style="color:${cat.color}">
          ${cat.label} &bull; <strong style="color:var(--accent-primary)">${distText}</strong>
        </div>
        <h4 class="nearby-alert-title">${event.title}</h4>
        <p class="nearby-alert-org">Organized by <strong>${event.organizer || 'Community Organizer'}</strong></p>
        <p class="nearby-alert-address">📍 ${event.address || event.city || 'Nearby Location'}</p>
      </div>
    </div>
    <div class="nearby-alert-actions">
      <a href="${directionsUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm nearby-btn-dir">
        🧭 Get Directions
      </a>
      <a href="event-detail.html?id=${encodeURIComponent(event.id || '1')}" class="btn btn-secondary btn-sm nearby-btn-help">
        🤝 I Want to Help / Volunteer
      </a>
    </div>
  `;

  // Close handler
  const closeBtn = card.querySelector('.nearby-alert-close');
  closeBtn.addEventListener('click', () => {
    card.classList.add('fade-out');
    setTimeout(() => card.remove(), 300);
  });

  // Auto-dismiss after 15 seconds unless hovered
  let autoDismiss = setTimeout(() => {
    card.classList.add('fade-out');
    setTimeout(() => card.remove(), 300);
  }, 15000);

  card.addEventListener('mouseenter', () => clearTimeout(autoDismiss));

  container.prepend(card);

  // Trigger OS-level browser notification if allowed
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(`🚨 Urgent Event Nearby: ${event.title}`, {
        body: `${cat.label} organized by ${event.organizer} (${distText}). Tap for directions & volunteer info.`,
        icon: 'images/icon-192.png',
        tag: `serveo-${event.id || Date.now()}`
      });
      notif.onclick = () => {
        window.focus();
        window.open(directionsUrl, '_blank');
      };
    } catch (e) {
      // Notification failed
    }
  }
}

// Evaluate an event against user coordinates and alert if <= 5km
export async function checkAndNotifyNearby(event) {
  if (!event || typeof event.lat === 'undefined' || typeof event.lng === 'undefined') return;

  let loc = null;
  if (typeof getUserLocation === 'function') {
    loc = await getUserLocation();
  } else if (typeof userLocation === 'object' && userLocation) {
    loc = userLocation;
  }

  if (!loc) {
    loc = { lat: 28.6139, lng: 77.2090 }; // Default reference if denied
  }

  let dist = 0;
  if (typeof haversineDistance === 'function') {
    dist = haversineDistance(loc.lat, loc.lng, Number(event.lat), Number(event.lng));
  } else {
    // Fallback haversine
    const R = 6371;
    const dLat = (Number(event.lat) - loc.lat) * Math.PI / 180;
    const dLng = (Number(event.lng) - loc.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(loc.lat * Math.PI / 180) * Math.cos(Number(event.lat) * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // If the event is within 0-5 km (or if test demo mode), alert!
  if (dist <= NEARBY_MAX_KM) {
    showNearbyAlertModal(event, dist);
  }
}

// Broadcasts an event when someone posts or approves it
export function broadcastNewEvent(event) {
  if (!event) return;

  // Broadcast to other tabs
  if (serveoBroadcastChannel) {
    serveoBroadcastChannel.postMessage({ type: 'NEW_EVENT', event });
  }

  // Cross-tab fallback via localStorage
  try {
    localStorage.setItem('serveo_latest_event', JSON.stringify({ event, timestamp: Date.now() }));
  } catch (e) {}

  // Check on the current page too
  checkAndNotifyNearby(event);
}

// Test trigger function for live demonstration
export async function triggerDemoNearbyAlert() {
  let loc = { lat: 28.6139, lng: 77.2090 };
  if (typeof getUserLocation === 'function') {
    loc = await getUserLocation();
  }

  // Create a realistic demo event within ~1.2 km of user's coordinates
  const demoEvent = {
    id: 'demo-' + Date.now(),
    title: 'Urgent Blood & Medical Relief Camp',
    category: 'blood',
    organizer: 'Indian Red Cross Society',
    city: 'Local Area',
    address: 'Community Center, Main Road',
    lat: loc.lat + 0.008, // ~0.9 - 1.2 km away
    lng: loc.lng + 0.006,
    urgency: 'critical',
    date: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '18:00',
    volunteersNeeded: 50,
    volunteersJoined: 18,
    description: 'Urgent call for voluntary blood donors and relief volunteers.',
  };

  checkAndNotifyNearby(demoEvent);
}

// Initialize listener for broadcasted events across all pages
export function initNearbyAlerts() {
  // Listen on BroadcastChannel
  if (serveoBroadcastChannel) {
    serveoBroadcastChannel.onmessage = (e) => {
      if (e.data && e.data.type === 'NEW_EVENT' && e.data.event) {
        checkAndNotifyNearby(e.data.event);
      }
    };
  }

  // Listen on storage events (cross-tab)
  window.addEventListener('storage', (e) => {
    if (e.key === 'serveo_latest_event' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data && data.event && Date.now() - (data.timestamp || 0) < 10000) {
          checkAndNotifyNearby(data.event);
        }
      } catch (err) {}
    }
  });

  // Check if browser notifications are already permitted or request on user interaction
  if ('Notification' in window && Notification.permission === 'default') {
    // Optionally prompt after 3s on first visit
    setTimeout(() => {
      const banner = document.getElementById('notif-permission-banner');
      if (banner) banner.style.display = 'flex';
    }, 2500);
  }
}

// Auto initialize on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNearbyAlerts);
  } else {
    initNearbyAlerts();
  }
}
