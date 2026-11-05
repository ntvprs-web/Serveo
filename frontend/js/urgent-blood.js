import { getMe } from './db.js';

const API_BASE = window.SERVEO_API_BASE || (['localhost', '127.0.0.1'].includes(location.hostname) && location.port !== '3000' ? `${location.protocol}//${location.hostname}:3000` : location.origin);

const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const form = document.getElementById('blood-request-form');
const profileForm = document.getElementById('donor-profile-form');
const list = document.getElementById('blood-request-list');
const status = document.getElementById('request-list-status');
let user = null;
let donorLocation = null;

function authHeaders() {
  const token = localStorage.getItem('serveo_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setMessage(element, message, kind = '') {
  element.textContent = message;
  element.className = `blood-form-message${kind ? ` is-${kind}` : ''}`;
}

function coordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser cannot access location.'));
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error('Location access was unavailable. Enter the coordinates manually or allow location access.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function loadRequests() {
  status.textContent = 'Loading requests…';
  try {
    const response = await fetch(`${API_BASE}/api/urgent-blood-requests`);
    if (!response.ok) throw new Error('Could not load requests.');
    const requests = await response.json();
    requests.sort((a, b) => {
      if (!donorLocation) return new Date(b.createdAt) - new Date(a.createdAt);
      return distanceKm(donorLocation, a) - distanceKm(donorLocation, b);
    });
    list.replaceChildren();
    status.textContent = requests.length ? `${requests.length} open request${requests.length === 1 ? '' : 's'} · requests expire after 48 hours` : '';
    if (!requests.length) {
      const empty = document.createElement('div');
      empty.className = 'blood-empty';
      empty.textContent = 'There are no open urgent blood requests right now. Set up donor alerts so you can hear about a matching need nearby.';
      list.append(empty);
      return;
    }
    for (const request of requests) {
      const card = document.createElement('article');
      card.className = 'blood-request-card';
      const top = document.createElement('div');
      top.className = 'blood-request-top';
      const chip = document.createElement('span');
      chip.className = 'blood-group-chip';
      chip.textContent = request.bloodGroup;
      const title = document.createElement('h3');
      title.textContent = `${request.units} unit${request.units === 1 ? '' : 's'} needed · ${request.hospital}`;
      top.append(chip, title);
      card.append(top);
      const meta = document.createElement('p');
      meta.textContent = `${request.city} · ${request.address}`;
      card.append(meta);
      if (request.details) {
        const details = document.createElement('p');
        details.textContent = request.details;
        card.append(details);
      }
      if (donorLocation) {
        const distance = document.createElement('p');
        distance.className = 'blood-distance';
        distance.textContent = `${distanceKm(donorLocation, request).toFixed(1)} km from your saved location`;
        card.append(distance);
      }
      if (user && String(request.requesterId) === String(user.id)) {
        const own = document.createElement('p');
        own.textContent = 'Your request. Matching donors who respond will appear in your notifications with their contact number.';
        card.append(own);
        const actions = document.createElement('div');
        actions.className = 'blood-request-actions';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'blood-secondary';
        close.textContent = 'Mark filled / close';
        close.addEventListener('click', async () => {
          close.disabled = true;
          try {
            const response = await fetch(`${API_BASE}/api/urgent-blood-requests/${encodeURIComponent(request.id)}/close`, { method: 'PATCH', credentials: 'include', headers: authHeaders() });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Could not close request.');
            await loadRequests();
          } catch (error) { close.disabled = false; window.alert(error.message); }
        });
        actions.append(close);
        card.append(actions);
      } else if (user && user.bloodGroup === request.bloodGroup) {
        const actions = document.createElement('div');
        actions.className = 'blood-request-actions';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'blood-primary';
        button.textContent = 'I can donate';
        button.addEventListener('click', async () => {
          button.disabled = true;
          button.textContent = 'Sending…';
          try {
            const result = await fetch(`${API_BASE}/api/urgent-blood-requests/${encodeURIComponent(request.id)}/interested`, { method: 'POST', credentials: 'include', headers: authHeaders() });
            const data = await result.json().catch(() => ({}));
            if (!result.ok) throw new Error(data.message || 'Could not send your response.');
            button.textContent = 'Response sent';
            button.disabled = true;
          } catch (error) {
            button.disabled = false;
            button.textContent = 'I can donate';
            window.alert(error.message);
          }
        });
        actions.append(button);
        card.append(actions);
      } else if (!user) {
        const login = document.createElement('a');
        login.className = 'blood-form-message';
        login.href = 'login.html';
        login.textContent = 'Sign in and set up your matching blood group to respond.';
        card.append(login);
      }
      list.append(card);
    }
  } catch (error) {
    status.textContent = error.message;
  }
}

document.getElementById('use-current-location').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const location = await coordinates();
    form.elements.lat.value = location.lat.toFixed(6);
    form.elements.lng.value = location.lng.toFixed(6);
  } catch (error) { setMessage(document.getElementById('request-message'), error.message, 'error'); }
  finally { button.disabled = false; }
});

document.getElementById('save-donor-location').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    donorLocation = await coordinates();
    document.getElementById('donor-location-value').textContent = `Location ready (${donorLocation.lat.toFixed(4)}, ${donorLocation.lng.toFixed(4)}). It is used only for matching.`;
    await loadRequests();
  } catch (error) { setMessage(document.getElementById('donor-message'), error.message, 'error'); }
  finally { button.disabled = false; }
});

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.getElementById('donor-message');
  if (!user) { setMessage(message, 'Sign in or create an account before enabling donor alerts.', 'error'); return; }
  if (!donorLocation) { setMessage(message, 'Share your current location first so we can match nearby requests.', 'error'); return; }
  const bloodGroup = profileForm.elements.bloodGroup.value;
  if (!groups.includes(bloodGroup)) return;
  try {
    const response = await fetch(`${API_BASE}/api/donors/profile`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ bloodGroup, ...donorLocation }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Could not save donor profile.');
    user.bloodGroup = bloodGroup;
    setMessage(message, 'Donor alerts are enabled. Matching requests within 25 km can trigger a browser notification while SERVEO is open.', 'success');
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { }
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      setMessage(message, 'Your donor profile is saved. Allow SERVEO browser notifications to receive alerts while the app is open.', 'success');
    }
    await loadRequests();
  } catch (error) { setMessage(message, error.message, 'error'); }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.getElementById('request-message');
  if (!user) { setMessage(message, 'Sign in or create an account before posting an urgent request.', 'error'); return; }
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  values.units = Number(values.units);
  values.lat = Number(values.lat);
  values.lng = Number(values.lng);
  const button = document.getElementById('submit-request');
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    const response = await fetch(`${API_BASE}/api/urgent-blood-requests`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(values) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Could not post urgent request.');
    form.reset();
    setMessage(message, `Request posted. ${data.request.notifiedDonors} matching donor${data.request.notifiedDonors === 1 ? '' : 's'} within 25 km ${data.request.notifiedDonors === 1 ? 'was' : 'were'} alerted.`, 'success');
    await loadRequests();
  } catch (error) { setMessage(message, error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Send urgent request'; }
});

document.getElementById('refresh-requests').addEventListener('click', loadRequests);

try {
  user = await getMe();
  if (user?.bloodGroup && groups.includes(user.bloodGroup)) profileForm.elements.bloodGroup.value = user.bloodGroup;
} catch { user = null; }
if (!user) {
  setMessage(document.getElementById('request-message'), 'Sign in to post a request or respond as a donor.', 'error');
  setMessage(document.getElementById('donor-message'), 'Sign in to enable donor alerts.', 'error');
}
await loadRequests();
