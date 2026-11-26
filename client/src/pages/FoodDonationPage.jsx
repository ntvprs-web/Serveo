import React, { useEffect, useState } from 'react';
import { Utensils, Plus, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

export default function FoodDonationPage() {
  const { user, addToast, userLocation } = useApp();
  const [posts, setPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    servings: 30,
    foodType: 'veg',
    city: 'New Delhi',
    pickupAddress: '',
    expiresInHours: 4
  });

  const load = () => {
    apiFetch('/api/food-posts')
      .then((d) => setPosts(d.posts || d || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/food-posts', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          servings: Number(form.servings) || 10,
          expiresInHours: Number(form.expiresInHours) || 3,
          lat: userLocation?.lat ?? 28.6139,
          lng: userLocation?.lng ?? 77.209
        })
      });
      addToast('Surplus food post published!');
      setShowForm(false);
      load();
    } catch (err) {
      addToast(err.message || 'Could not post surplus food');
    }
  };

  const handleAction = async (id, action) => {
    try {
      await apiFetch(`/api/food-posts/${id}/${action}`, { method: 'POST' });
      addToast(`Food pickup updated (${action})`);
      load();
    } catch (err) {
      addToast(err.message || 'Action failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            Surplus Food <span className="serif-italic" style={{ fontSize: '1.7rem' }}>Rescue</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Connect surplus event & banquet meals with nearby verified community kitchens
          </p>
        </div>
        {user && (
          <button type="button" onClick={() => setShowForm((v) => !v)} className="pill-btn pill-btn-coral">
            <Plus size={16} /> Share Surplus Food
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid-responsive-2">
            <div>
              <label className="form-label">Food Description</label>
              <input required className="input-field" placeholder="e.g., Fresh Veg Biryani & Dal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Estimated Servings</label>
              <input type="number" min={5} className="input-field" value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} />
            </div>
          </div>
          <div className="grid-responsive-3">
            <div>
              <label className="form-label">Type</label>
              <select className="select-field" value={form.foodType} onChange={(e) => setForm({ ...form, foodType: e.target.value })}>
                <option value="veg">Vegetarian</option>
                <option value="non-veg">Non-Vegetarian</option>
              </select>
            </div>
            <div>
              <label className="form-label">City</label>
              <input required className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Pickup Address</label>
              <input required className="input-field" value={form.pickupAddress} onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="pill-btn pill-btn-dark" style={{ alignSelf: 'flex-end' }}>
            Post Food Pickup
          </button>
        </form>
      )}

      {posts.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          No active surplus food pickups right now.
        </div>
      ) : (
        <div className="grid-responsive-2">
          {posts.map((p) => (
            <div key={p.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge-pill" style={{ background: '#FEF3C7', color: '#92400E' }}>
                  <Utensils size={13} /> {p.servings} servings · {p.foodType || 'veg'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.status || 'available'}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{p.title}</h3>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                {p.pickupAddress}, {p.city}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                <button type="button" onClick={() => handleAction(p.id, 'claim')} className="pill-btn pill-btn-gold" style={{ flex: 1 }}>
                  <CheckCircle2 size={14} /> Claim Pickup
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
