import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Plus, CheckCircle2, MapPin, Navigation, Clock, Search, Droplets } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, getDirectionsUrl } from '../utils/api';
import EventCard from '../components/EventCard';

const BLOOD_FILTERS = ['All', 'O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

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

  const bloodEvents = useMemo(
    () => events.filter((e) => e.category === 'blood').slice(0, 6),
    [events]
  );

  const filteredRequests = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    return requests.filter((r) => {
      if (bloodFilter !== 'All' && r.bloodGroup !== bloodFilter) return false;
      if (!q) return true;
      return (
        r.city?.toLowerCase().includes(q) ||
        r.hospital?.toLowerCase().includes(q) ||
        r.patientName?.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q)
      );
    });
  }, [requests, bloodFilter, cityQuery]);

  const totalUnits = useMemo(
    () => requests.reduce((sum, r) => sum + (Number(r.units) || 1), 0),
    [requests]
  );
  const citiesCount = useMemo(
    () => new Set(requests.map((r) => r.city).filter(Boolean)).size,
    [requests]
  );

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800 }}>
            Urgent Blood <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Requests</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Live hospital emergency blood needs matched with nearby opted-in donors across India
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/blood-donation" className="pill-btn">
            <Droplets size={15} /> Donor Opt-In
          </Link>
          {user && (
            <button type="button" onClick={() => setShowForm((v) => !v)} className="pill-btn pill-btn-coral">
              <Plus size={16} /> Post Urgent Need
            </button>
          )}
        </div>
      </div>

      {/* Live Stats Strip */}
      <div className="grid-responsive-3">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Emergency Requests</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 4, color: '#EF4444' }}>{requests.length}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Verified hospital & patient needs</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Units Needed</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 4 }}>{totalUnits} <small style={{ fontSize: '0.82rem' }}>UNITS</small></div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Across {citiesCount || 1} Indian cities</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Hosted Blood Drives</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 4, color: '#10B981' }}>{bloodEvents.length}+</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Scheduled camps accepting walk-ins</div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Broadcast Emergency Blood Request</h3>
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
              <label className="form-label">Hospital Address</label>
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
              <label className="form-label">Medical Notes / Ward Info</label>
              <input className="input-field" placeholder="Platelets / Whole blood / Timing..." value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="pill-btn pill-btn-dark" style={{ alignSelf: 'flex-end' }}>
            Broadcast Urgent Request
          </button>
        </form>
      )}

      {/* Search & Blood Group Filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Search size={17} color="var(--text-muted)" style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Filter by city, hospital, or patient..."
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            style={{ paddingLeft: 42, borderRadius: 16 }}
          />
        </div>
        <div className="h-scroll">
          {BLOOD_FILTERS.map((bg) => (
            <button
              key={bg}
              type="button"
              onClick={() => setBloodFilter(bg)}
              className="pill-btn"
              style={{
                flexShrink: 0,
                background: bloodFilter === bg ? '#EF4444' : 'var(--bg-surface)',
                color: bloodFilter === bg ? '#FFFFFF' : 'var(--text-primary)'
              }}
            >
              {bg === 'All' ? 'All Blood Groups' : bg}
            </button>
          ))}
        </div>
      </div>

      {/* Active Requests Grid */}
      {loading ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading live urgent blood requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          No matching urgent blood requests right now. Try clearing filters or check hosted blood drives below.
        </div>
      ) : (
        <div className="grid-responsive-2">
          {filteredRequests.map((r) => (
            <div key={r.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span className="badge-pill" style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '0.88rem', fontWeight: 700 }}>
                  <HeartPulse size={14} /> {r.bloodGroup} · {r.units || 1} {Number(r.units) === 1 ? 'unit' : 'units'} needed
                </span>
                <span className="badge-pill" style={{ background: 'var(--bg-surface-muted)', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                  <Clock size={12} /> {formatHoursLeft(r.expiresAt)}
                </span>
              </div>

              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.08rem', fontWeight: 700 }}>{r.hospital}</h3>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="#EF4444" />
                  <span>{r.address}, {r.city}</span>
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--bg-surface-muted)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <div><strong>Patient:</strong> {r.patientName}</div>
                {r.details && <div style={{ marginTop: 4 }}>{r.details}</div>}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleInterested(r.id)} className="pill-btn pill-btn-gold" style={{ flex: 1 }}>
                  <HeartPulse size={15} /> I Can Donate
                </button>
                <a
                  href={getDirectionsUrl(r.lat, r.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-btn"
                >
                  <Navigation size={14} /> Directions
                </a>
                {user && String(r.requesterId) === String(user.id) && (
                  <button type="button" onClick={() => handleClose(r.id)} className="pill-btn">
                    <CheckCircle2 size={14} /> Close
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hosted Blood Drives Near You */}
      <section style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              Hosted Blood <span className="serif-italic" style={{ fontSize: '1.4rem' }}>Drives</span>
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Verified blood donation camps hosted on SERVEO ({bloodEvents.length} shown)
            </p>
          </div>
          <Link to="/events?category=blood" style={{ fontSize: '0.84rem', fontWeight: 600 }}>
            View All Blood Drives →
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
