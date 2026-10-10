// SERVEO - map engine in ONE place (Mapbox GL JS: GPU/vector maps, Google-Maps-smooth).
// Paste your Mapbox public token (starts with "pk.") below. Every page uses it.
const MAPBOX_TOKEN = 'pk.eyJ1IjoibmlzaGFudDIyIiwiYSI6ImNtdXo4cnAwZDBjMGcyenM5cWdqc2pmaDcifQ.q50Yt3xBnL3EEF1-6c6O0g';
 
const SERVEO_HAS_TOKEN = !!MAPBOX_TOKEN && MAPBOX_TOKEN !== 'YOUR_API_KEY';
const SERVEO_STYLE = 'mapbox://styles/mapbox/outdoors-v12';

// Creates a map inside the element with this id. Options are passed to Mapbox.
// NOTE: Mapbox uses [longitude, latitude] order (the reverse of Leaflet).
function serveoCreateMap(containerId, options = {}) {
  const el = document.getElementById(containerId);
  const show = (msg) => {
    if (el) el.innerHTML = '<div style="padding:2rem;text-align:center;color:#9ca3af">' + msg + '</div>';
  };
  if (typeof mapboxgl === 'undefined') {
    console.error('Mapbox GL library did not load. Check your internet connection, ad-blockers, and that the mapbox-gl.js <script> line is on this page.');
    show('Map could not load: the Mapbox library was blocked or offline. Check your internet / ad-blocker, then refresh.');
    throw new Error('Mapbox GL library not loaded');
  }
  if (!SERVEO_HAS_TOKEN) {
    console.error('Mapbox token is missing in js/maptiles.js');
    show('Map unavailable: add your Mapbox token in <code>js/maptiles.js</code>');
    throw new Error('Mapbox token missing');
  }
  mapboxgl.accessToken = MAPBOX_TOKEN;
  const map = new mapboxgl.Map({
    container: containerId,
    style: SERVEO_STYLE,
    center: [79, 22.5],
    zoom: 4,
    projection: 'mercator',
    ...options
  });
  map.on('error', (e) => {
    const status = e && e.error && e.error.status;
    if (status === 401 || status === 403) {
      console.warn('Mapbox rejected the token (' + status + '). Check the token and its URL restrictions.');
      if (typeof showToast === 'function') showToast('Map token rejected - check js/maptiles.js', 'info');
    }
  });
  return map;
}

// Draws a teardrop drop-pin (colour + emoji) pointing to the coordinate
function serveoPinImage(emoji, color) {
  const w = 48, h = 60; // 1x dimensions, drawn at 2x
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);

  const cx = w / 2; // 24
  const cy = 22;    // center of head circle
  const r = 18;     // radius of head circle
  const tipX = cx;  // 24
  const tipY = 56;  // tip point

  // Teardrop pin path
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.bezierCurveTo(tipX + 6, tipY - 10, cx + r, cy + 12, cx + r, cy);
  ctx.arc(cx, cy, r, 0, Math.PI, true);
  ctx.bezierCurveTo(cx - r, cy + 12, tipX - 6, tipY - 10, tipX, tipY);
  ctx.closePath();

  // Fill pin color
  ctx.fillStyle = color;
  ctx.fill();

  // White stroke border
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Inner subtle light circle highlight
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fill();

  // Centered Emoji Icon
  ctx.font = '18px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 1);

  return ctx.getImageData(0, 0, w * 2, h * 2);
}
 
// Polygon (as GeoJSON) for a circle of radius km around a point
function serveoCircleFeature(lng, lat, km, steps = 72) {
  const coords = [];
  const dLat = km / 110.574;
  const dLng = km / (111.320 * Math.cos(lat * Math.PI / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}
 
function serveoBounds(coords) {
  let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
  coords.forEach(([x, y]) => {
    minLng = Math.min(minLng, x); maxLng = Math.max(maxLng, x);
    minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y);
  });
  return [[minLng, minLat], [maxLng, maxLat]];
}
 
// ---------- Search & address helpers (Mapbox Geocoding) ----------
function serveoParseFeature(f) {
  const p = f.properties || {};
  const ctx = p.context || {};
  return {
    label: p.full_address || [p.name, p.place_formatted].filter(Boolean).join(', '),
    city: (ctx.place && ctx.place.name) || (ctx.locality && ctx.locality.name) ||
          (ctx.district && ctx.district.name) || '',
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1]
  };
}
 
async function serveoSearchPlaces(query) {
  const url = 'https://api.mapbox.com/search/geocode/v6/forward?q=' + encodeURIComponent(query) +
    '&country=in&limit=5&access_token=' + MAPBOX_TOKEN;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed (' + res.status + ')');
  const data = await res.json();
  return (data.features || []).map(serveoParseFeature);
}
 
async function serveoReverseGeocode(lng, lat) {
  const url = 'https://api.mapbox.com/search/geocode/v6/reverse?longitude=' + lng +
    '&latitude=' + lat + '&access_token=' + MAPBOX_TOKEN;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Lookup failed (' + res.status + ')');
  const data = await res.json();
  return data.features && data.features[0] ? serveoParseFeature(data.features[0]) : null;
}
 