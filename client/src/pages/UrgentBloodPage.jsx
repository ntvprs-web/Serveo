import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
  Plus,
  CheckCircle2,
  MapPin,
  Navigation,
  Clock,
  Search,
  Droplets,
  Share2,
  ShieldAlert,
  Sparkles,
  PhoneCall,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, getDirectionsUrl, haversineKm } from '../utils/api';
import EventCard from '../components/EventCard';

const BLOOD_FILTERS = ['All', 'O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const RARE_GROUPS = new Set(['O-', 'AB-', 'B-', 'A-']);

const COMPATIBLE_DONORS = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
};

function formatHoursLeft(expiresAt) {
  if (!expiresAt) return 'Urgent';
  const diffMs = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Expiring soon';
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
}

export default function UrgentBloodPage() {
  const { user, addToast, userLocation, events } = useApp();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bloodFilter, setBloodFilter] = useState('All');
  const [cityQuery, setCityQuery] = useState('');
  const [sortBy, setSortBy] = useState('urgent'); // 'urgent' | 'nearest' | 'units'
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patientName: '',
    bloodGroup: 'O-',
    units: 2,
    hospital: '',
    address: '',
    city: 'New Delhi',
    contactPhone: '',
    details: ''
  });

  const load = () => {
    setLoading(true);
    apiFetch('/api/urgent-blood-requests')
      .then((d) => setRequests(Array.isArray(d) ? d : (d.requests || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const enrichedRequests = useMemo(() => {
    return requests.map((r) => {
      const dist =
        userLocation && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng))
          ? Number(haversineKm(userLocation.lat, userLocation.lng, Number(r.lat), Number(r.lng)).toFixed(1))
          : null;
      const isRare = RARE_GROUPS.has(r.bloodGroup);
      const userMatches = Boolean(user?.bloodGroup && (COMPATIBLE_DONORS[r.bloodGroup] || []).includes(user.bloodGroup));
      return { ...r, distanceKm: dist, isRare, userMatches };
    });
  }, [requests, userLocation, user]);

  const priorityRequests = useMemo(() => {
    const rareOrLarge = enrichedRequests.filter((r) => r.isRare || Number(r.units) >= 3);
    return (rareOrLarge.length >= 2 ? rareOrLarge : enrichedRequests).slice(0, 4);
  }, [enrichedRequests]);

  const filteredRequests = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    const list = enrichedRequests.filter((r) => {
      if (bloodFilter !== 'All' && r.bloodGroup !== bloodFilter) return false;
      if (!q) return true;
      return (
        r.city?.toLowerCase().includes(q) ||
        r.hospital?.toLowerCase().includes(q) ||
        r.patientName?.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q)
      );
    });
    if (sortBy === 'nearest') {
      list.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    } else if (sortBy === 'units') {
      list.sort((a, b) => (Number(b.units) || 1) - (Number(a.units) || 1));
    } else {
      list.sort((a, b) => Number(b.isRare) - Number(a.isRare));
    }
    return list;
  }, [enrichedRequests, bloodFilter, cityQuery, sortBy]);

  const bloodEvents = useMemo(
    () => events.filter((e) => e.category === 'blood').slice(0, 6),
    [events]
  );

  const totalUnits = useMemo(
    () => requests.reduce((sum, r) => sum + (Number(r.units) || 1), 0),
    [requests]
  );
  const citiesCount = useMemo(
    () => new Set(requests.map((r) => r.city).filter(Boolean)).size,
    [requests]
  );

  const handleShare = (r) => {
    const text = `Urgent ${r.bloodGroup} blood (${r.units || 1} units) needed at ${r.hospital}, ${r.city} for ${r.patientName}. Respond on SERVEO: ${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: `Urgent ${r.bloodGroup} Blood Needed`, text, url: window.location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      addToast('Emergency blood alert copied to clipboard — share with local donors!');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/urgent-blood-requests', {
        method: 'POST',
        body: JSON.stringify({
          patientName: form.patientName.trim(),
          bloodGroup: form.bloodGroup,
          units: Number(form.units) || 1,
          hospital: form.hospital.trim(),
          address: form.address.trim() || form.hospital.trim(),
          city: form.city.trim(),
          contactPhone: form.contactPhone.trim(),
          details: form.details.trim(),
          lat: userLocation?.lat ?? 28.6139,
          lng: userLocation?.lng ?? 77.209
        })
      });
      addToast('Urgent blood request posted! Matching nearby donors are being notified.');
      setShowForm(false);
      setForm({ patientName: '', bloodGroup: 'O-', units: 2, hospital: '', address: '', city: 'New Delhi', contactPhone: '', details: '' });
      load();
    } catch (err) {
      addToast(err.message || 'Could not post urgent blood request');
    }
  };

  const handleInterested = async (id) => {
    try {
      const res = await apiFetch(`/api/urgent-blood-requests/${id}/interested`, { method: 'POST' });
      addToast(
        res?.alreadyResponded
          ? 'You have already responded to this request.'
          : 'Thank you! Your response has been shared with the hospital/requester. (+Life Saver Badge unlocked!)'
      );
      load();
    } catch (err) {
      addToast(err.message || 'Complete your Blood Donor profile first to respond');
    }
  };

  const handleClose = async (id) => {
    try {
      await apiFetch(`/api/urgent-blood-requests/${id}/close`, { method: 'PATCH' });
      addToast('Request marked as fulfilled.');
      load();
    } catch (err) {
      addToast(err.message || 'Could not close request');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {/* Editorial Hero Banner (matching HomePage visual language) */}
      <section
        className="card"
        style={{
          padding: 24,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-muted) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 660 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-md)',
              flexShrink: 0
            }}
          >
            <HeartPulse size={30} />
          </div>
          <div>
            <span className="badge-pill" style={{ background: '#FEE2E2', color: '#991B1B', marginBottom: 6 }}>
              <Sparkles size={13} /> {requests.length} active requests · {totalUnits} units needed across {citiesCount || 1} cities
            </span>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.2 }}>
              Urgent Blood <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Response Network</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Verified hospital blood emergencies matched in real time with nearby opted-in donors and blood camps.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/blood-donation" className="pill-btn">
            <Droplets size={15} color="#EF4444" /> Donor Opt-In
          </Link>
          {user ? (
            <button type="button" onClick={() => setShowForm((v) => !v)} className="pill-btn pill-btn-coral">
              <Plus size={16} /> {showForm ? 'Close Form' : 'Post Urgent Need'}
            </button>
          ) : (
            <Link to="/login" className="pill-btn pill-btn-dark">
              Sign In to Respond
            </Link>
          )}
        </div>
      </section>

      {/* Post Urgent Need Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Broadcast Emergency Blood Request</h3>
            <span className="badge-pill" style={{ background: '#FEE2E2', color: '#991B1B' }}>48-Hour Active Window</span>
          </div>
          <div className="grid-responsive-3">
            <div>
              <label className="form-label">Patient Name</label>
              <input required className="input-field" placeholder="e.g., Rohan Verma" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Blood Group</label>
              <select className="select-field" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Units Needed (1–20)</label>
              <input type="number" min={1} max={20} required className="input-field" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
            </div>
          </div>
          <div className="grid-responsive-3">
            <div>
              <label className="form-label">Hospital Name</label>
              <input required className="input-field" placeholder="e.g., AIIMS Trauma Center" value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Hospital Address / Ward</label>
              <input required className="input-field" placeholder="Ward / Street / Area" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="form-label">City</label>
              <input required className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div className="grid-responsive-2">
            <div>
              <label className="form-label">Indian Contact Phone</label>
              <input required className="input-field" placeholder="+91 98765 43210" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Medical Notes / Timing</label>
              <input className="input-field" placeholder="Platelets / Whole blood / ICU slip info..." value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="pill-btn pill-btn-coral" style={{ alignSelf: 'flex-end' }}>
            <HeartPulse size={15} /> Broadcast Urgent Request
          </button>
        </form>
      )}

      {/* Priority Critical Alerts Horizontal Strip (Matching HomePage Priority Initiatives) */}
      {priorityRequests.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Critical <span className="serif-italic" style={{ fontSize: '1.4rem' }}>Priority Needs</span>
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Rare blood groups & multi-unit emergencies
            </span>
          </div>

          <div className="h-scroll">
            {priorityRequests.map((r) => (
              <div
                key={`prio-${r.id}`}
                className="card-interactive"
                style={{
                  minWidth: 280,
                  maxWidth: 320,
                  padding: 18,
                  borderRadius: 24,
                  background: r.isRare ? 'var(--accent-gold)' : 'var(--accent-sage)',
                  color: '#111827',
                  border: '1px solid rgba(15,23,42,0.08)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="badge-pill" style={{ background: '#DC2626', color: '#FFFFFF', fontWeight: 700 }}>
                      ● {r.bloodGroup} · {r.units || 1}u
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8 }}>
                      {formatHoursLeft(r.expiresAt)}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.08rem', fontWeight: 700, lineHeight: 1.25 }}>
                    {r.hospital}
                  </h3>
                  <div style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 500 }}>
                    {r.city}{r.distanceKm != null ? ` · ${r.distanceKm} km away` : ''} · Patient: {r.patientName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInterested(r.id)}
                  className="pill-btn pill-btn-dark"
                  style={{ width: '100%', padding: '9px 14px', fontSize: '0.82rem', background: '#111827', color: '#FFFFFF' }}
                >
                  <HeartPulse size={14} /> I Can Donate ({r.bloodGroup})
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search, Sort & Blood Group Filter Pills */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={17} color="var(--text-muted)" style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search by city, hospital, ward, or patient..."
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              style={{ paddingLeft: 42, borderRadius: 18 }}
            />
          </div>
          <select
            className="select-field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 'auto', padding: '10px 16px', borderRadius: 99 }}
          >
            <option value="urgent">Sort: Most Critical</option>
            <option value="nearest">Sort: Nearest First</option>
            <option value="units">Sort: Most Units Needed</option>
          </select>
        </div>

        <div className="h-scroll">
          {BLOOD_FILTERS.map((bg) => {
            const active = bloodFilter === bg;
            return (
              <button
                key={bg}
                type="button"
                onClick={() => setBloodFilter(bg)}
                className="pill-btn"
                style={{
                  flexShrink: 0,
                  background: active ? 'var(--accent-charcoal)' : 'var(--bg-surface)',
                  color: active ? 'var(--text-inverse)' : 'var(--text-primary)'
                }}
              >
                {bg === 'All' ? '🩸 All Blood Groups' : bg}
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Emergency Requests Grid (Editorial Cards matching EventCard craft) */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
            All Active Blood Requests ({filteredRequests.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {(COMPATIBLE_DONORS[bloodFilter] && bloodFilter !== 'All')
              ? `Compatible donors: ${COMPATIBLE_DONORS[bloodFilter].join(', ')}`
              : 'Tap Directions for hospital navigation'}
          </span>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading live urgent blood requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
            No matching urgent blood requests right now. Try clearing your filters or check hosted blood drives below.
          </div>
        ) : (
          <div className="grid-responsive-3">
            {filteredRequests.map((r) => (
              <div
                key={r.id}
                className="card card-interactive"
                style={{
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                {/* Visual Emergency Header */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: 14,
                    background: r.isRare
                      ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
                      : 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
                    color: '#111827',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: '#DC2626',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.15rem',
                        boxShadow: 'var(--shadow-xs)',
                        flexShrink: 0
                      }}
                    >
                      {r.bloodGroup}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.96rem' }}>
                        {r.units || 1} {Number(r.units) === 1 ? 'Unit' : 'Units'} Needed
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.78, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {formatHoursLeft(r.expiresAt)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleShare(r)}
                    aria-label="Share blood request"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(255,255,255,0.85)',
                      color: '#111827',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Share2 size={15} />
                  </button>
                </div>

                {/* Body */}
                <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="badge-pill" style={{ background: 'var(--bg-surface-muted)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                      <ShieldAlert size={12} color="#EF4444" /> Patient: {r.patientName}
                    </span>
                    {r.userMatches && (
                      <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.7rem' }}>
                        ✓ Your Blood Matches
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>{r.hospital}</h3>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <MapPin size={14} color="#EF4444" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>
                      {r.address}, {r.city}
                      {r.distanceKm != null ? ` (${r.distanceKm} km)` : ''}
                    </span>
                  </div>

                  {r.details && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {r.details}
                    </p>
                  )}

                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 4 }}>
                    Compatible donors: <strong>{(COMPATIBLE_DONORS[r.bloodGroup] || [r.bloodGroup]).join(', ')}</strong>
                  </div>

                  {/* Card Footer Actions */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleInterested(r.id)}
                      className="pill-btn pill-btn-gold"
                      style={{ flex: 1, padding: '9px 14px', fontSize: '0.82rem' }}
                    >
                      <PhoneCall size={14} /> I Can Donate
                    </button>
                    <a
                      href={getDirectionsUrl(r.lat, r.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="pill-btn"
                      style={{ padding: '9px 12px', fontSize: '0.82rem' }}
                      aria-label="Hospital directions"
                    >
                      <Navigation size={14} />
                    </a>
                    {user && String(r.requesterId) === String(user.id) && (
                      <button type="button" onClick={() => handleClose(r.id)} className="pill-btn" style={{ padding: '9px 12px' }}>
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hosted Blood Drives Near You */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Hosted Blood <span className="serif-italic" style={{ fontSize: '1.4rem' }}>Donation Camps</span>
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Verified blood drives hosted across India ({bloodEvents.length} featured)
            </p>
          </div>
          <Link to="/events?category=blood" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {bloodEvents.length > 0 && (
          <div className="grid-responsive-3">
            {bloodEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
