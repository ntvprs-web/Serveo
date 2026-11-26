import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { Navigation, MapPin, LocateFixed, Calendar, Lock, Crown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORIES, MAPBOX_STYLE, MAPBOX_TOKEN, getCategoryInfo } from '../utils/constants';
import { formatDateShort, getDirectionsUrl } from '../utils/api';

const RADIUS_OPTIONS = [
  { value: 'all', label: 'Any Distance', premium: false },
  { value: '5', label: '5 km', premium: false },
  { value: '10', label: '10 km', premium: true },
  { value: '25', label: '25 km', premium: true },
  { value: '50', label: '50 km', premium: true },
  { value: '100', label: '100 km', premium: true }
];

export default function MapPage() {
  const { events, userLocation, detectLocation, isPremium, addToast } = useApp();
  const navigate = useNavigate();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [radiusFilter, setRadiusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mapError, setMapError] = useState('');

  const handleRadiusChange = (opt) => {
    if (opt.premium && !isPremium) {
      addToast(`Unlock ${opt.label} search radius with SERVEO Premium!`);
      navigate('/premium');
      return;
    }
    setRadiusFilter(opt.value);
  };

  const filteredEvents = useMemo(() => {
    const maxKm = radiusFilter === 'all' ? null : Number(radiusFilter);
    return events.filter((ev) => {
      if (!Number.isFinite(Number(ev.lat)) || !Number.isFinite(Number(ev.lng))) return false;
      if (selectedCategory !== 'all' && ev.category !== selectedCategory) return false;
      if (maxKm !== null && ev.distanceKm !== null && ev.distanceKm > maxKm) return false;
      return true;
    });
  }, [events, selectedCategory, radiusFilter]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAPBOX_STYLE,
        center: userLocation ? [userLocation.lng, userLocation.lat] : [78.9629, 22.5937],
        zoom: userLocation ? 11 : 4.2
      });
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      mapRef.current = map;
    } catch {
      setMapError('Interactive Mapbox view could not initialize. Check network or browser WebGL settings.');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 11.5 });
    }
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredEvents.forEach((ev) => {
      const cat = getCategoryInfo(ev.category);
      const el = document.createElement('button');
      el.type = 'button';
      el.title = ev.title;
      el.style.cssText = `
        width: 36px; height: 36px; border-radius: 50%;
        background: ${cat.color}; color: #fff; border: 3px solid #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.28);
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; cursor: pointer;
      `;
      el.textContent = cat.emoji;
      el.addEventListener('click', () => {
        setSelectedEvent(ev);
        map.flyTo({ center: [Number(ev.lng), Number(ev.lat)], zoom: Math.max(map.getZoom(), 12) });
      });

      const marker = new mapboxgl.Marker(el).setLngLat([Number(ev.lng), Number(ev.lat)]).addTo(map);
      markersRef.current.push(marker);
    });
  }, [filteredEvents]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>
            Live Nearby <span className="serif-italic" style={{ fontSize: '1.65rem' }}>Map</span>
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Showing {filteredEvents.length} mapped events · {isPremium ? 'Premium 25–100 km unlocked' : 'Standard 0–5 km active'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={detectLocation} className="pill-btn">
            <LocateFixed size={15} color="#F97352" /> My Location
          </button>
          {!isPremium && (
            <Link to="/premium" className="pill-btn pill-btn-gold">
              <Crown size={14} /> Unlock 25–100 km
            </Link>
          )}
        </div>
      </div>

      {/* Radius Selector */}
      <div className="h-scroll">
        {RADIUS_OPTIONS.map((opt) => {
          const active = radiusFilter === opt.value;
          const locked = opt.premium && !isPremium;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleRadiusChange(opt)}
              className="pill-btn"
              style={{
                flexShrink: 0,
                background: active ? 'var(--accent-charcoal)' : 'var(--bg-surface)',
                color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                opacity: locked ? 0.78 : 1
              }}
            >
              {locked && <Lock size={12} />}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Category Filter Pills */}
      <div className="h-scroll">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className="pill-btn"
          style={{
            flexShrink: 0,
            background: selectedCategory === 'all' ? 'var(--accent-charcoal)' : 'var(--bg-surface)',
            color: selectedCategory === 'all' ? 'var(--text-inverse)' : 'var(--text-primary)'
          }}
        >
          All Categories
        </button>
        {Object.values(CATEGORIES).map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setSelectedCategory(cat.key)}
            className="pill-btn"
            style={{
              flexShrink: 0,
              background: selectedCategory === cat.key ? 'var(--accent-charcoal)' : 'var(--bg-surface)',
              color: selectedCategory === cat.key ? 'var(--text-inverse)' : 'var(--text-primary)'
            }}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        {mapError ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {mapError}
          </div>
        ) : (
          <div ref={mapContainerRef} style={{ width: '100%', height: '62vh', minHeight: 420 }} />
        )}

        {selectedEvent && (
          <div
            className="card"
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 16,
              maxWidth: 460,
              padding: 16,
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
              <div>
                <span className="badge-pill" style={{ background: 'var(--accent-gold-soft)', color: '#111827', marginBottom: 6 }}>
                  {getCategoryInfo(selectedEvent.category).emoji} {getCategoryInfo(selectedEvent.category).label}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{selectedEvent.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '6px 0 12px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={13} /> {formatDateShort(selectedEvent.date)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={13} /> {selectedEvent.city}
                {selectedEvent.distanceKm !== null ? ` (${selectedEvent.distanceKm} km)` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to={`/event/${selectedEvent.id}`} className="pill-btn pill-btn-dark" style={{ flex: 1 }}>
                View & Volunteer
              </Link>
              <a
                href={getDirectionsUrl(selectedEvent.lat, selectedEvent.lng, selectedEvent.address)}
                target="_blank"
                rel="noreferrer"
                className="pill-btn"
              >
                <Navigation size={14} /> Directions
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
