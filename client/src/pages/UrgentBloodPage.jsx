import React, { useEffect, useState } from 'react';
import { HeartPulse, Plus, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

export default function UrgentBloodPage() {
  const { user, addToast, userLocation } = useApp();
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patientName: '',
    bloodGroup: 'O-',
    unitsNeeded: 2,
    hospitalName: '',
    city: 'New Delhi',
    contactPhone: '',
    notes: ''
  });

  const load = () => {
    apiFetch('/api/urgent-blood-requests')
      .then((d) => setRequests(d.requests || d || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/urgent-blood-requests', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          unitsNeeded: Number(form.unitsNeeded) || 1,
          lat: userLocation?.lat ?? 28.6139,
          lng: userLocation?.lng ?? 77.209
        })
      });
      addToast('Urgent blood request posted! Matching nearby donors are being notified.');
      setShowForm(false);
      load();
    } catch (err) {
      addToast(err.message || 'Could not post urgent blood request');
    }
  };

  const handleInterested = async (id) => {
    try {
      await apiFetch(`/api/urgent-blood-requests/${id}/interested`, { method: 'POST' });
      addToast('Thank you! Your response has been shared with the requester.');
      load();
    } catch (err) {
      addToast(err.message || 'Please sign in to respond');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            Urgent Blood <span className="serif-italic" style={{ fontSize: '1.7rem' }}>Requests</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Hospital emergency blood needs matched with nearby opted-in donors
          </p>
        </div>

        {user && (
          <button type="button" onClick={() => setShowForm((v) => !v)} className="pill-btn pill-btn-coral">
            <Plus size={16} /> Post Urgent Need
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid-responsive-3">
            <div>
              <label className="form-label">Blood Group</label>
              <select className="select-field" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Units Needed</label>
              <input type="number" min={1} className="input-field" value={form.unitsNeeded} onChange={(e) => setForm({ ...form, unitsNeeded: e.target.value })} />
            </div>
            <div>
              <label className="form-label">City</label>
              <input required className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div className="grid-responsive-2">
            <div>
              <label className="form-label">Hospital Name</label>
              <input required className="input-field" value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Contact Phone</label>
              <input required className="input-field" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="pill-btn pill-btn-dark" style={{ alignSelf: 'flex-end' }}>
            Broadcast Urgent Request
          </button>
        </form>
      )}

      {requests.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          No active urgent blood requests right now.
        </div>
      ) : (
        <div className="grid-responsive-2">
          {requests.map((r) => (
            <div key={r.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge-pill" style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '0.88rem' }}>
                  <HeartPulse size={14} /> {r.bloodGroup} · {r.unitsNeeded} units
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.city}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{r.hospitalName}</h3>
              {r.notes && <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{r.notes}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                <button type="button" onClick={() => handleInterested(r.id)} className="pill-btn pill-btn-gold" style={{ flex: 1 }}>
                  I Can Donate
                </button>
                {user && String(r.userId) === String(user.id) && (
                  <button type="button" onClick={() => handleClose(r.id)} className="pill-btn">
                    <CheckCircle2 size={14} /> Close
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
