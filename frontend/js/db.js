// SERVEO — Shared Database & Real-Time Helpers (Node.js API & Server-Sent Events)

const API_BASE = (() => {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  if (window.SERVEO_API_BASE) return window.SERVEO_API_BASE;
  const { protocol, hostname, origin, port } = window.location;
  if (protocol === 'file:' || origin === 'null') return 'http://localhost:3000';
  // VS Code Live Server serves the frontend on its own port; API calls still
  // need to reach the SERVEO Express server (npm start) on port 3000.
  if (['localhost', '127.0.0.1'].includes(hostname) && port !== '3000') return `${protocol}//${hostname}:3000`;
  return origin;
})();

/* ---------- Safety: escape text before it is placed into HTML ---------- */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Returns a copy that is safe to put inside innerHTML templates
export function safeEvent(ev) {
  return {
    ...ev,
    id: ev.id,
    _docId: ev.id,
    title: esc(ev.title),
    organizer: esc(ev.organizer),
    city: esc(ev.city),
    address: esc(ev.address),
    description: esc(ev.description),
    lat: Number(ev.lat),
    lng: Number(ev.lng),
    volunteersNeeded: Math.max(1, Number(ev.volunteersNeeded) || 1),
    volunteersJoined: Math.max(0, Number(ev.volunteersJoined) || 0),
    tags: (Array.isArray(ev.tags) ? ev.tags : []).map(esc),
    urgency: ['critical', 'live', 'ending', 'upcoming'].includes(ev.urgency) ? ev.urgency : 'upcoming',
    verified: ev.verified === true,
    donationLink: ev.donationLink || null,
    _htmlEscaped: true,
  };
}

/* ---------- Real-Time Event Streams ---------- */
// Live list of APPROVED events
export function watchApproved(onData, onError) {
  let active = true;
  let currentList = [];

  // Initial fetch
  fetch(`${API_BASE}/api/events?status=approved`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(events => {
      if (!active) return;
      currentList = events;
      onData(currentList);
    })
    .catch(err => {
      console.warn('Initial events fetch failed, attempting demo fallback:', err);
      if (typeof onError === 'function') onError(err);
    });

  // Subscribe to live Server-Sent Events (SSE)
  let evtSource = null;
  try {
    evtSource = new EventSource(`${API_BASE}/api/events/stream`);

    evtSource.onmessage = (e) => {
      if (!active) return;
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'EVENT_CREATED' && payload.event) {
          if (payload.event.status === 'approved') {
            const idx = currentList.findIndex(x => String(x.id) === String(payload.event.id));
            if (idx === -1) {
              currentList.unshift(payload.event);
            } else {
              currentList[idx] = payload.event;
            }
            onData([...currentList]);
          }
        } else if (payload.type === 'EVENT_UPDATED' && payload.event) {
          const idx = currentList.findIndex(x => String(x.id) === String(payload.event.id));
          if (payload.event.status === 'approved') {
            if (idx !== -1) currentList[idx] = payload.event;
            else currentList.unshift(payload.event);
          } else {
            if (idx !== -1) currentList.splice(idx, 1);
          }
          onData([...currentList]);
        } else if (payload.type === 'VOLUNTEER_JOINED' && payload.event) {
          const idx = currentList.findIndex(x => String(x.id) === String(payload.event.id));
          if (idx !== -1) {
            currentList[idx].volunteersJoined = payload.event.volunteersJoined;
            onData([...currentList]);
          }
        } else if (payload.type === 'EVENT_DELETED' && payload.event) {
          currentList = currentList.filter(x => String(x.id) !== String(payload.event.id));
          onData([...currentList]);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    evtSource.onerror = (err) => {
      // Browser EventSource automatically attempts reconnection
    };
  } catch (err) {
    console.warn('EventSource not supported or failed:', err);
  }

  return () => {
    active = false;
    if (evtSource) evtSource.close();
  };
}

// One approved event by id (null if missing / not approved)
export async function getApprovedEvent(id) {
  try {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const ev = await res.json();
    return ev.status === 'approved' ? ev : null;
  } catch (err) {
    console.error('getApprovedEvent error:', err);
    return null;
  }
}

export async function getApprovedEvents() {
  const res = await fetch(`${API_BASE}/api/events?status=approved`);
  if (!res.ok) throw new Error('Could not load approved events');
  const events = await res.json();
  return Array.isArray(events) ? events : [];
}

export async function getOrganizerOverview(identifier) {
  const params = new URLSearchParams({ key: String(identifier || '') });
  const res = await fetch(`${API_BASE}/api/organizers/overview?${params}`);
  if (!res.ok) throw new Error('Could not load organizer milestones');
  return await res.json();
}

export async function getEventReviews(eventId) {
  const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/reviews`);
  if (!res.ok) throw new Error('Could not load event reviews');
  return await res.json();
}

export async function submitEventReview(eventId, review) {
  const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Could not submit your review');
  return data;
}

// Live list of events waiting for approval (organizer dashboard)
export function watchPending(onData, onError) {
  let active = true;
  let pendingList = [];

  const load = () => {
    fetch(`${API_BASE}/api/events?status=pending`)
      .then(r => r.json())
      .then(events => {
        if (!active) return;
        pendingList = (Array.isArray(events) ? events : []).map(safeEvent);
        onData(pendingList);
      })
      .catch(err => {
        if (typeof onError === 'function') onError(err);
      });
  };

  load();

  let evtSource = null;
  try {
    evtSource = new EventSource(`${API_BASE}/api/events/stream`);
    evtSource.onmessage = (e) => {
      if (!active) return;
      try {
        const payload = JSON.parse(e.data);
        if (['EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELETED'].includes(payload.type)) {
          load();
        }
      } catch (err) {}
    };
  } catch (err) {}

  return () => {
    active = false;
    if (evtSource) evtSource.close();
  };
}

export async function getContact(id) {
  try {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(id)}/contact`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getAuthHeaders(extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  try {
    const token = localStorage.getItem('serveo_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch (e) {}
  return headers;
}

/* ---------- Writing ---------- */
// Saves a new event
export async function addEvent(eventData, contactData) {
  const payload = {
    ...eventData,
    ...contactData,
    status: eventData.status || 'pending'
  };

  const res = await fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error('AUTH_REQUIRED: Please sign in as an Organization / NGO to publish events.');
    }
    throw new Error(err.message || `Server returned HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.id || data.event?.id;
}

export async function joinEvent(id) {
  const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(id)}/join`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Join failed');
  return await res.json();
}

export async function applyForEvent(id, application) {
  const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(id)}/volunteer`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(application)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Could not submit your volunteer application');
  return data;
}

export async function setEventStatus(id, patch) {
  const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Status update failed');
  }
  return await res.json();
}

export async function removeEvent(id) {
  const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Delete failed');
  }
  return await res.json();
}

/* ---------- Authentication Helpers ---------- */
export async function sendOtp(phone) {
  const res = await fetch(`${API_BASE}/api/auth/otp/send`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'OTP send failed');
  return data;
}

export async function signup(userData) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Signup failed');
  if (data.token) {
    try {
      localStorage.setItem('serveo_token', data.token);
      if (data.user) localStorage.setItem('serveo_user', JSON.stringify(data.user));
    } catch (e) {}
  }
  return data;
}

export async function login(identifier, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  if (data.token) {
    try {
      localStorage.setItem('serveo_token', data.token);
      if (data.user) localStorage.setItem('serveo_user', JSON.stringify(data.user));
    } catch (e) {}
  }
  return data;
}

export async function logout() {
  try {
    localStorage.removeItem('serveo_token');
    localStorage.removeItem('serveo_user');
  } catch (e) {}
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function quickLogin(role = 'organizer') {
  const res = await fetch(`${API_BASE}/api/auth/quick-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Quick login failed');
  if (data.token) {
    try {
      localStorage.setItem('serveo_token', data.token);
      if (data.user) localStorage.setItem('serveo_user', JSON.stringify(data.user));
    } catch (e) {}
  }
  return data;
}

export async function quickRegister(userData = {}) {
  const res = await fetch(`${API_BASE}/api/auth/quick-register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : {};
  if (!isJson) throw new Error(`SERVEO backend did not return JSON at ${API_BASE}. Start the app with npm start, then reload this page.`);
  if (!res.ok) throw new Error(data.message || 'Quick register failed');
  if (data.token) {
    try {
      localStorage.setItem('serveo_token', data.token);
      if (data.user) localStorage.setItem('serveo_user', JSON.stringify(data.user));
    } catch (e) {}
  }
  return data;
}

export async function getMe() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      if (res.status === 401) {
        try {
          localStorage.removeItem('serveo_token');
          localStorage.removeItem('serveo_user');
        } catch (e) {}
      }
      return null;
    }
    const data = await res.json();
    if (data.user) {
      try { localStorage.setItem('serveo_user', JSON.stringify(data.user)); } catch (e) {}
    }
    return data.user;
  } catch {
    try {
      const cached = localStorage.getItem('serveo_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }
}

export async function getMyVolunteerApplications() {
  try {
    const res = await fetch(`${API_BASE}/api/volunteer-applications/mine`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    const applications = await res.json();
    return Array.isArray(applications) ? applications : [];
  } catch {
    return [];
  }
}
