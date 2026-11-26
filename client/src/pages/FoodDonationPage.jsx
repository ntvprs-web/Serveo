import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Utensils,
  Plus,
  CheckCircle2,
  MapPin,
  Navigation,
  Clock,
  Search,
  Building2,
  Share2,
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, getDirectionsUrl, haversineKm } from '../utils/api';
import EventCard from '../components/EventCard';

const FOOD_BANNER_IMG =
  'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=900&q=75';

function formatPickupWindow(pickupBy) {
  if (!pickupBy) return 'Pickup active';
  const diffMs = Date.parse(pickupBy) - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Closing soon';
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
}

function getSafetyProgressPct(cookedAt, pickupBy) {
  const start = Date.parse(cookedAt);
  const end = Date.parse(pickupBy);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 70;
  const remaining = Math.max(0, end - Date.now());
  return Math.min(100, Math.max(8, Math.round((remaining / (end - start)) * 100)));
}

export default function FoodDonationPage() {
  const { user, addToast, userLocation, events } = useApp();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityQuery, setCityQuery] = useState('');
  const [sortBy, setSortBy] = useState('soonest'); // 'soonest' | 'meals' | 'nearest'
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

  const enrichedPosts = useMemo(() => {
    return posts.map((p) => {
      const dist =
        userLocation && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
          ? Number(haversineKm(userLocation.lat, userLocation.lng, Number(p.lat), Number(p.lng)).toFixed(1))
          : null;
      return {
        ...p,
        distanceKm: dist,
        safetyPct: getSafetyProgressPct(p.cookedAt, p.pickupBy)
      };
    });
  }, [posts, userLocation]);

  const priorityPosts = useMemo(
    () => [...enrichedPosts].sort((a, b) => (Number(b.approximateMeals) || 0) - (Number(a.approximateMeals) || 0)).slice(0, 4),
    [enrichedPosts]
  );

  const filteredPosts = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    const list = enrichedPosts.filter((p) => {
      if (!q) return true;
      return (
        p.city?.toLowerCase().includes(q) ||
        p.itemDescription?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.restaurantName?.toLowerCase().includes(q)
      );
    });
    if (sortBy === 'meals') {
      list.sort((a, b) => (Number(b.approximateMeals) || 0) - (Number(a.approximateMeals) || 0));
    } else if (sortBy === 'nearest') {
      list.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    } else {
      list.sort((a, b) => Date.parse(a.pickupBy || 0) - Date.parse(b.pickupBy || 0));
    }
    return list;
  }, [enrichedPosts, cityQuery, sortBy]);

  const foodEvents = useMemo(
    () => events.filter((e) => e.category === 'food').slice(0, 6),
    [events]
  );

  const totalMeals = useMemo(
    () => posts.reduce((sum, p) => sum + (Number(p.approximateMeals) || 0), 0),
    [posts]
  );
  const citiesCount = useMemo(
    () => new Set(posts.map((p) => p.city).filter(Boolean)).size,
    [posts]
  );

  const handleShare = (p) => {
    const text = `Surplus Food Rescue: ${p.approximateMeals} meals (${p.itemDescription}) ready for pickup in ${p.city} at ${p.address}. Claim on SERVEO: ${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: 'Surplus Food Pickup on SERVEO', text, url: window.location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      addToast('Pickup details copied to clipboard!');
    }
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {/* Editorial Hero Banner */}
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
              background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
              color: '#B45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-md)',
              flexShrink: 0
            }}
          >
            <Utensils size={28} />
          </div>
          <div>
            <span className="badge-pill" style={{ background: 'var(--accent-gold-soft)', color: '#92400E', marginBottom: 6 }}>
              <Sparkles size={13} /> {posts.length} active pickups · {totalMeals} meals ready across {citiesCount || 1} cities
            </span>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.2 }}>
              Surplus Food <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Rescue Dispatch</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Connect freshly cooked surplus meals from verified kitchens & banquets with nearby NGOs within the safety window.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/events?category=food" className="pill-btn">
            <Utensils size={15} color="#F59E0B" /> Food Drives ({foodEvents.length}+)
          </Link>
          {user ? (
            <button type="button" onClick={() => setShowForm((v) => !v)} className="pill-btn pill-btn-coral">
              <Plus size={16} /> {showForm ? 'Close Form' : 'Share Surplus Food'}
            </button>
          ) : (
            <Link to="/login" className="pill-btn pill-btn-dark">
              Sign In to Claim
            </Link>
          )}
        </div>
      </section>

      {/* Post Surplus Food Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Post Surplus Food Batch</h3>
            <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46' }}>
              <ShieldCheck size={13} /> 4-Hour Safety Window Verified
            </span>
          </div>
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
          <button type="submit" className="pill-btn pill-btn-coral" style={{ alignSelf: 'flex-end' }}>
            <Utensils size={15} /> Post Food Pickup
          </button>
        </form>
      )}

      {/* High-Volume Priority Pickups Strip */}
      {priorityPosts.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Large Batch <span className="serif-italic" style={{ fontSize: '1.4rem' }}>Priority Pickups</span>
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Highest meal volume ready for dispatch
            </span>
          </div>

          <div className="h-scroll">
            {priorityPosts.map((p, idx) => (
              <div
                key={`fp-prio-${p.id}`}
                className="card-interactive"
                style={{
                  minWidth: 275,
                  maxWidth: 310,
                  padding: 18,
                  borderRadius: 24,
                  background: idx % 2 === 0 ? 'var(--accent-gold)' : 'var(--accent-sage)',
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
                    <span className="badge-pill" style={{ background: 'rgba(17, 24, 39, 0.12)', color: '#111827', fontWeight: 700 }}>
                      🍱 {p.approximateMeals} meals
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8 }}>
                      {formatPickupWindow(p.pickupBy)}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.08rem', fontWeight: 700, lineHeight: 1.25 }}>
                    {p.itemDescription}
                  </h3>
                  <div style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 500 }}>
                    {p.city}{p.distanceKm != null ? ` · ${p.distanceKm} km away` : ''} · {p.restaurantName || 'Verified Kitchen'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={p.status !== 'posted'}
                  onClick={() => handleAction(p.id, 'claim')}
                  className="pill-btn"
                  style={{ width: '100%', padding: '9px 14px', fontSize: '0.82rem', background: '#111827', color: '#FFFFFF', border: 'none' }}
                >
                  <CheckCircle2 size={14} /> {p.status === 'posted' ? 'Claim Batch Now' : `Status: ${p.status}`}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search & Sort Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={17} color="var(--text-muted)" style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search surplus pickups by city, kitchen, or meal..."
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
          <option value="soonest">Sort: Expiring Soonest</option>
          <option value="meals">Sort: Most Meals</option>
          <option value="nearest">Sort: Nearest First</option>
        </select>
      </div>

      {/* Active Pickups Grid (Matching EventCard editorial layout) */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
            Live Surplus Pickups ({filteredPosts.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            All batches verified within food safety pickup window
          </span>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading active surplus food pickups...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
            No matching surplus food pickups right now. Check hosted Food Distribution drives below!
          </div>
        ) : (
          <div className="grid-responsive-3">
            {filteredPosts.map((p) => (
              <div
                key={p.id}
                className="card card-interactive"
                style={{
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                {/* Visual Banner matching EventCard */}
                <div
                  style={{
                    position: 'relative',
                    height: 140,
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: '#FEF3C7'
                  }}
                >
                  <img
                    src={FOOD_BANNER_IMG}
                    alt={p.itemDescription}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(15,23,42,0.22) 0%, rgba(15,23,42,0.05) 55%, rgba(15,23,42,0.45) 100%)'
                    }}
                  />
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="badge-pill" style={{ background: 'rgba(255,255,255,0.92)', color: '#111827', backdropFilter: 'blur(6px)' }}>
                      🍱 {p.approximateMeals || 20} Meals
                    </span>
                    <span className="badge-pill" style={{ background: '#10B981', color: '#FFFFFF' }}>
                      ● {p.status === 'posted' ? 'READY' : p.status.toUpperCase()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleShare(p)}
                    aria-label="Share food pickup"
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(17,24,39,0.55)',
                      color: '#FFFFFF',
                      backdropFilter: 'blur(6px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Share2 size={15} />
                  </button>
                </div>

                {/* Card Body */}
                <div style={{ padding: '12px 6px 6px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Building2 size={13} /> {p.restaurantName || 'Verified Community Kitchen'}
                    </span>
                    <CheckCircle2 size={14} color="#10B981" />
                  </div>

                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>
                    {p.itemDescription}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <MapPin size={14} color="#F59E0B" /> {p.address}, {p.city}
                      {p.distanceKm != null ? ` (${p.distanceKm} km)` : ''}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={14} color="#10B981" /> {formatPickupWindow(p.pickupBy)}
                    </span>
                  </div>

                  {/* Safety Window Bar */}
                  <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Freshness Window</span>
                      <span style={{ color: '#10B981' }}>{p.safetyPct}% left</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-surface-muted)', overflow: 'hidden' }}>
                      <div style={{ width: `${p.safetyPct}%`, height: '100%', borderRadius: 99, background: '#F59E0B' }} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 6 }}>
                    <button
                      type="button"
                      disabled={p.status !== 'posted'}
                      onClick={() => handleAction(p.id, 'claim')}
                      className="pill-btn pill-btn-gold"
                      style={{ flex: 1, padding: '9px 14px', fontSize: '0.82rem', opacity: p.status !== 'posted' ? 0.65 : 1 }}
                    >
                      <CheckCircle2 size={14} /> {p.status === 'posted' ? 'Claim Pickup' : `Status: ${p.status}`}
                    </button>
                    <a
                      href={getDirectionsUrl(p.lat, p.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="pill-btn"
                      style={{ padding: '9px 12px' }}
                      aria-label="Directions"
                    >
                      <Navigation size={14} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hosted Food Distribution Events */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Hosted Food <span className="serif-italic" style={{ fontSize: '1.4rem' }}>Distribution Drives</span>
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Volunteer at community meal drives & zero-hunger campaigns ({foodEvents.length} featured)
            </p>
          </div>
          <Link to="/events?category=food" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            View All <ArrowRight size={14} />
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
