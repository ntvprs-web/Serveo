// SERVEO - map engine in ONE place (Mapbox GL JS: GPU/vector maps, Google-Maps-smooth).
// Paste your Mapbox public token (starts with "pk.") below. Every page uses it.
const MAPBOX_TOKEN = 'REPLACE_WITH_MAPBOX_TOKEN';
 
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

// Draws a category-colored liquid-glass pin with palette-tinted reflections.
function serveoPinImage(emoji, color) {
  const w = 48, h = 60;
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#00d4aa';
  const parseColor = value => {
    const hex = String(value || '').trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (!hex) return [0, 212, 170];
    const normalized = hex[1].length === 3 ? hex[1].split('').map(ch => ch + ch).join('') : hex[1];
    return [0, 2, 4].map(index => parseInt(normalized.slice(index, index + 2), 16));
  };
  const categoryRGB = parseColor(color);
  const accentRGB = parseColor(accentColor);
  const mix = (first, second, amount) => first.map((channel, index) => Math.round(channel * (1 - amount) + second[index] * amount));
  const rgba = (rgb, alpha) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  const white = [255, 255, 255];
  const ink = [7, 14, 24];
  ctx.scale(2, 2);

  const cx = w / 2;
  const cy = 22;
  const r = 18;
  const tipY = 56;
  const drawPinPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.bezierCurveTo(cx + 6, tipY - 10, cx + r, cy + 12, cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI, true);
    ctx.bezierCurveTo(cx - r, cy + 12, cx - 6, tipY - 10, cx, tipY);
    ctx.closePath();
  };

  ctx.save();
  drawPinPath();
  ctx.shadowColor = rgba(categoryRGB, 0.45);
  ctx.shadowBlur = 11;
  ctx.shadowOffsetY = 4;
  const body = ctx.createLinearGradient(5, 5, 42, 49);
  body.addColorStop(0, rgba(mix(categoryRGB, white, 0.53), 0.94));
  body.addColorStop(0.4, rgba(mix(categoryRGB, accentRGB, 0.22), 0.9));
  body.addColorStop(1, rgba(mix(categoryRGB, ink, 0.36), 0.94));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawPinPath();
  ctx.clip();

  const reflection = ctx.createLinearGradient(2, 4, 39, 47);
  reflection.addColorStop(0, 'rgba(255,255,255,0.42)');
  reflection.addColorStop(0.28, rgba(mix(white, accentRGB, 0.18), 0.2));
  reflection.addColorStop(0.62, 'rgba(255,255,255,0.035)');
  reflection.addColorStop(1, 'rgba(4,12,22,0.2)');
  ctx.fillStyle = reflection;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.ellipse(17, 11, 10, 5.2, -0.42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.27)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(15, 9, 2.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(8, 24);
  ctx.bezierCurveTo(8, 13, 15, 6, 25, 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.58)';
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.restore();

  drawPinPath();
  ctx.lineWidth = 1.65;
  ctx.strokeStyle = 'rgba(255,255,255,0.82)';
  ctx.stroke();
  drawPinPath();
  ctx.lineWidth = 0.65;
  ctx.strokeStyle = rgba(accentRGB, 0.68);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = 'rgba(4,10,18,0.4)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.font = '17px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 1);
  ctx.restore();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
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
 
