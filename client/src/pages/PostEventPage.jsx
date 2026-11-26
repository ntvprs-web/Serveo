import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { MapPin, Send, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORIES, DEMO_HOSTING_TEMPLATES, MAPBOX_STYLE, MAPBOX_TOKEN } from '../utils/constants';
import { apiFetch } from '../utils/api';

export default function PostEventPage() {
  const { user, addToast, refreshEvents } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const todayIso = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    title: '',
    category: 'blood',
    customCategory: '',
    organizer: user?.name || '',
    contact: user?.phone || '',
    date: todayIso,
    startTime: '09:00',
    endTime: '16:00',
    volunteersNeeded: 50,
    urgency: 'upcoming',
    state: 'Delhi',
    district: 'New Delhi',
    city: 'New Delhi',
    address: '',
    pincode: '',
    lat: 28.6139,
    lng: 77.209,
    donationLink: '',
    description: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [lgdStates, setLgdStates] = useState([]);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const tplId = searchParams.get('template');
    if (!tplId) return;
    const tpl = DEMO_HOSTING_TEMPLATES.find((t) => t.id === tplId);
    if (tpl) {
      setForm((f) => ({
        ...f,
        title: tpl.title,
        category: tpl.category,
        customCategory: tpl.customCategory || '',
        city: tpl.city,
        address: tpl.address,
        volunteersNeeded: tpl.volunteersNeeded,
        urgency: tpl.urgency,
        description: tpl.description
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !form.organizer) {
      setForm((f) => ({ ...f, organizer: user.name || '', contact: user.phone || '' }));
    }
  }, [user]);

  // Fetch India LGD States (graceful fallback if offline)
  useEffect(() => {
    fetch('https://india-lgd-index-api.vercel.app/api/states')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d)) setLgdStates(d);
        else if (d && Array.isArray(d.states)) setLgdStates(d.states);
      })
      .catch(() => {});
  }, []);

  // Mapbox Pin Dropper
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAPBOX_STYLE,
        center: [form.lng, form.lat],
        zoom: 10
      });
      const marker = new mapboxgl.Marker({ draggable: true, color: '#F97352' })
        .setLngLat([form.lng, form.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setForm((f) => ({
          ...f,
          lat: Number(lngLat.lat.toFixed(5)),
          lng: Number(lngLat.lng.toFixed(5))
        }));
      });

      map.on('click', (e) => {
        marker.setLngLat(e.lngLat);
        setForm((f) => ({
          ...f,
          lat: Number(e.lngLat.lat.toFixed(5)),
          lng: Number(e.lngLat.lng.toFixed(5))
        }));
      });

      mapRef.current = map;
      markerRef.current = marker;
    } catch {
      // Map optional if offline
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      addToast('Please sign in first to host a public-service event.');
      navigate('/login');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        category:
          form.category === 'other' && form.customCategory.trim()
            ? `custom:${form.customCategory.trim()}`
            : form.category,
        volunteersNeeded: Number(form.volunteersNeeded) || 20,
        lat: Number(form.lat),
        lng: Number(form.lng),
        donationLink: form.donationLink.trim() || null
      };
      await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      addToast('Event published! It is now live on the map and events feed.');
      await refreshEvents();
      navigate('/map');
    } catch (err) {
      addToast(err.message || 'Could not submit event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <span className="badge-pill" style={{ background: 'var(--accent-coral-soft)', color: '#111827', marginBottom: 8 }}>
          <ShieldCheck size={13} /> Destination Event Hosting
        </span>
        <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800 }}>
          Host a Public-Service <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Event</span>
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Publish your initiative, pinpoint the destination on the map, and mobilize nearby volunteers in real time.
        </p>
      </div>

      {!user && (
        <div className="card" style={{ padding: 16, background: 'var(--accent-gold-soft)', color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
            Sign in as an Organizer or Citizen to publish events.
          </span>
          <Link to="/login" className="pill-btn pill-btn-dark">
            Sign In / Quick Demo Login
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="grid-responsive-2">
          <div>
            <label className="form-label">Event Title *</label>
            <input
              required
              className="input-field"
              placeholder="e.g., Community Blood Donation Camp"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">Category *</label>
            <select
              className="select-field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {Object.values(CATEGORIES).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.category === 'other' && (
          <div>
            <label className="form-label">Custom Cause Name</label>
            <input
              className="input-field"
              placeholder="e.g., Senior Citizen Digital Literacy"
              value={form.customCategory}
              onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
            />
          </div>
        )}

        <div className="grid-responsive-2">
          <div>
            <label className="form-label">Organizer / NGO Name *</label>
            <input
              required
              className="input-field"
              value={form.organizer}
              onChange={(e) => setForm({ ...form, organizer: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Public Contact Phone / Helpline *</label>
            <input
              required
              className="input-field"
              placeholder="+91 98765 43210"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
          </div>
        </div>

        <div className="grid-responsive-3">
          <div>
            <label className="form-label">Event Date *</label>
            <input
              required
              type="date"
              min={todayIso}
              className="input-field"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Start Time</label>
            <input
              type="time"
              className="input-field"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">End Time</label>
            <input
              type="time"
              className="input-field"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="grid-responsive-2">
          <div>
            <label className="form-label">Volunteers Needed</label>
            <input
              type="number"
              min={1}
              className="input-field"
              value={form.volunteersNeeded}
              onChange={(e) => setForm({ ...form, volunteersNeeded: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Urgency Level</label>
            <select
              className="select-field"
              value={form.urgency}
              onChange={(e) => setForm({ ...form, urgency: e.target.value })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live Now</option>
              <option value="critical">Critical Need</option>
            </select>
          </div>
        </div>

        {/* Location & Destination */}
        <div className="grid-responsive-3">
          <div>
            <label className="form-label">State / UT *</label>
            {lgdStates.length > 0 ? (
              <select
                className="select-field"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              >
                {lgdStates.map((s) => {
                  const name = typeof s === 'string' ? s : s.name || s.stateName;
                  return (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                required
                className="input-field"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            )}
          </div>
          <div>
            <label className="form-label">District *</label>
            <input
              required
              className="input-field"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">City / Locality *</label>
            <input
              required
              className="input-field"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
        </div>

        <div className="grid-responsive-2">
          <div>
            <label className="form-label">Venue Address / Landmark *</label>
            <input
              required
              className="input-field"
              placeholder="Community Hall, Main Road..."
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">6-Digit PIN Code *</label>
            <input
              required
              pattern="\d{6}"
              maxLength={6}
              className="input-field"
              placeholder="110001"
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} color="#F97352" /> Click or Drag Pin to Set Exact Destination ({form.lat}, {form.lng})
          </label>
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: 230,
              borderRadius: 18,
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)'
            }}
          />
        </div>

        <div>
          <label className="form-label">Description & Volunteer Instructions *</label>
          <textarea
            required
            rows={4}
            className="textarea-field"
            placeholder="Describe the initiative, who it helps, and what volunteers will do..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <label className="form-label">Optional Verified UPI Donation Link</label>
          <input
            className="input-field"
            placeholder="upi://pay?pa=organization@sbi"
            value={form.donationLink}
            onChange={(e) => setForm({ ...form, donationLink: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="submit" disabled={submitting} className="pill-btn pill-btn-coral" style={{ padding: '12px 26px' }}>
            <Send size={16} /> {submitting ? 'Publishing...' : 'Submit Event for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
