import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Utensils, Plus, CheckCircle2, MapPin, Navigation, Clock, Search, Building2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, getDirectionsUrl } from '../utils/api';
import EventCard from '../components/EventCard';

function formatPickupWindow(pickupBy) {
  if (!pickupBy) return 'Pickup active';
  const diffMs = Date.parse(pickupBy) - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Closing soon';
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return hrs > 0 ? `Pickup within ${hrs}h ${mins}m` : `Pickup within ${mins}m`;
}

export default function FoodDonationPage() {
  const { user, addToast, userLocation, events } = useApp();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityQuery, setCityQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    itemDescription: '',
    approximateMeals: 30,
    city: 'New Delhi',
    address: '',
    contact: '',
    hoursWindow: 3
  });

  const load = () => {
    setLoading(true);
    apiFetch('/api/food-posts')
      .then((d) => setPosts(Array.isArray(d) ? d : (d.posts || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const foodEvents = useMemo(
    () => events.filter((e) => e.category === 'food').slice(0, 6),
    [events]
  );

  const filteredPosts = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.city?.toLowerCase().includes(q) ||
        p.itemDescription?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.restaurantName?.toLowerCase().includes(q)
    );
  }, [posts, cityQuery]);

  const totalMeals = useMemo(
    () => posts.reduce((sum, p) => sum + (Number(p.approximateMeals) || 0), 0),
    [posts]
  );
  const citiesCount = useMemo(
    () => new Set(posts.map((p) => p.city).filter(Boolean)).size,
    [posts]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    const now = Date.now();
    const cookedAt = new Date(now - 30 * 60 * 1000).toISOString();
    const hours = Math.max(1, Math.min(4, Number(form.hoursWindow) || 3));
    const pickupBy = new Date(now + hours * 60 * 60 * 1000).toISOString();
    try {
      await apiFetch('/api/food-posts', {
        method: 'POST',
        body: JSON.stringify({
          itemDescription: form.itemDescription.trim(),
          approximateMeals: Number(form.approximateMeals) || 20,
          cookedAt,
          pickupBy,
          address: form.address.trim(),
          city: form.city.trim(),
          contact: form.contact.trim(),
          lat: userLocation?.lat ?? 28.6139,
          lng: userLocation?.lng ?? 77.209
        })
      });
      addToast('Surplus food post published! Nearby verified NGOs are being alerted.');
      setShowForm(false);
      load();
    } catch (err) {
      addToast(err.message || 'Verified restaurant account required to post surplus food');
    }
  };

  const handleAction = async (id, action) => {
    try {
      await apiFetch(`/api/food-posts/${id}/${action}`, { method: 'POST' });
      addToast(`Food pickup updated (${action})`);
      load();
    } catch (err) {
      addToast(err.message || 'Verified NGO / orphanage account required to claim pickups');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800 }}>
            Surplus Food <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Rescue</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Live surplus restaurant & banquet meals ready for verified NGOs, shelters, and community kitchens
          </p>
        </div>
        {user && (
          <button type="button" onClick={() => setShowForm((v) => !v)} className="pill-btn pill-btn-coral">
            <Plus size={16} /> Share Surplus Food
          </button>
        )}
      </div>

      {/* Live Food Rescue Stats */}
      <div className="grid-responsive-3">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Food Pickups</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 4, color: '#F59E0B' }}>{posts.length}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Freshly cooked & safety-window checked</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Meals Ready for Rescue</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 4 }}>{totalMeals} <small style={{ fontSize: '0.82rem' }}>MEALS</small></div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Across {citiesCount || 1} Indian cities</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Food Distribution Drives</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 4, color: '#10B981' }}>{foodEvents.length}+</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Hosted meal drives open for volunteers</div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Post Surplus Food Batch (4-Hour Food Safety Window)</h3>
          <div className="grid-responsive-2">
            <div>
              <label className="form-label">Food Description</label>
              <input required className="input-field" placeholder="e.g., Fresh Veg Biryani, Dal & Rotis (Sealed)" value={form.itemDescription} onChange={(e) => setForm({ ...form, itemDescription: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Approximate Meals</label>
              <input type="number" min={1} max={10000} required className="input-field" value={form.approximateMeals} onChange={(e) => setForm({ ...form, approximateMeals: e.target.value })} />
            </div>
          </div>
          <div className="grid-responsive-3">
            <div>
              <label className="form-label">City</label>
              <input required className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Pickup Address</label>
              <input required className="input-field" placeholder="Kitchen / Banquet Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Coordinator Contact</label>
              <input required className="input-field" placeholder="+91 98765 43210" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="pill-btn pill-btn-dark" style={{ alignSelf: 'flex-end' }}>
            Post Food Pickup
          </button>
        </form>
      )}

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <Search size={17} color="var(--text-muted)" style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          className="input-field"
          placeholder="Search surplus pickups by city, kitchen, or meal type..."
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          style={{ paddingLeft: 42, borderRadius: 16 }}
        />
      </div>

      {/* Active Surplus Food Pickups */}
      {loading ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading active surplus food pickups...
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          No matching surplus food pickups right now. Check hosted Food Distribution drives below!
        </div>
      ) : (
        <div className="grid-responsive-2">
          {filteredPosts.map((p) => (
            <div key={p.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span className="badge-pill" style={{ background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>
                  <Utensils size={13} /> {p.approximateMeals || 20} meals · {p.status === 'posted' ? 'Available' : p.status}
                </span>
                <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.74rem' }}>
                  <Clock size={12} /> {formatPickupWindow(p.pickupBy)}
                </span>
              </div>

              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.08rem', fontWeight: 700 }}>{p.itemDescription}</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Building2 size={14} /> <span>{p.restaurantName || 'Verified Community Kitchen'}</span>
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="#F59E0B" />
                  <span>{p.address}, {p.city}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={p.status !== 'posted'}
                  onClick={() => handleAction(p.id, 'claim')}
                  className="pill-btn pill-btn-gold"
                  style={{ flex: 1, opacity: p.status !== 'posted' ? 0.65 : 1 }}
                >
                  <CheckCircle2 size={14} /> {p.status === 'posted' ? 'Claim Pickup' : `Status: ${p.status}`}
                </button>
                <a
                  href={getDirectionsUrl(p.lat, p.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-btn"
                >
                  <Navigation size={14} /> Directions
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hosted Food Distribution Events */}
      <section style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              Hosted Food <span className="serif-italic" style={{ fontSize: '1.4rem' }}>Distribution Drives</span>
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Volunteer at community meal drives & zero-hunger campaigns ({foodEvents.length} shown)
            </p>
          </div>
          <Link to="/events?category=food" style={{ fontSize: '0.84rem', fontWeight: 600 }}>
            View All Food Drives →
          </Link>
        </div>

        {foodEvents.length > 0 && (
          <div className="grid-responsive-3">
            {foodEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
