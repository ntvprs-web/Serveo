import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, CheckCircle2, ShieldCheck, MapPin, BellRing, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function PremiumPage() {
  const { user, isPremium, activatePremium, addToast } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await activatePremium({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        activatedAt: new Date().toISOString()
      });
    } catch (err) {
      addToast(err.message || 'Could not activate Premium. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <span className="badge-pill" style={{ background: 'var(--accent-gold-soft)', color: '#111827', marginBottom: 8 }}>
          <Crown size={13} /> SERVEO Premium · Extended Range & Verification
        </span>
        <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800 }}>
          Find & Host Help Across <span className="serif-italic" style={{ fontSize: '1.85rem' }}>Every Distance</span>
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Standard discovery covers up to 5 km. Premium unlocks 25 km, 50 km, 100 km, and any-distance discovery plus Verified perks.
        </p>
      </div>

      <div className="grid-responsive-2" style={{ alignItems: 'start' }}>
        {/* Benefits Card */}
        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Included in SERVEO Premium</h2>
          {[
            { icon: MapPin, title: 'Extended 25 km – 100 km & Any-Distance Search', desc: 'Unlock 5 km, 10 km, 25 km, 50 km, 100 km, and nationwide map radius filters.' },
            { icon: BellRing, title: '25 km Emergency & Urgent Blood Alerts', desc: 'Receive real-time SSE proximity alerts & audio chimes across a 25 km radius.' },
            { icon: ShieldCheck, title: 'Priority Verified Status & Organizer Perks', desc: 'Fast-track verified profile standing, highlighted event cards, and certificate priority.' },
            { icon: Sparkles, title: 'Full Access to Verified Badges Studio', desc: 'Showcase cause badges on your volunteer profile and hosted events.' }
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--accent-gold-soft)', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{b.title}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{b.desc}</div>
                </div>
              </div>
            );
          })}

          <div style={{ padding: 14, borderRadius: 14, background: 'var(--bg-surface-muted)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <strong>Demo Prototype Activation:</strong> No payment is charged. Premium access is saved in this browser so you can test the 25 km–100 km map filters and extended alerts immediately.
          </div>
        </div>

        {/* Checkout / Active Card */}
        <div className="card" style={{ padding: 22 }}>
          {isPremium ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center', padding: '16px 0' }}>
              <CheckCircle2 size={44} color="#10B981" style={{ margin: '0 auto' }} />
              <h2 style={{ margin: 0 }}>Premium Unlocked!</h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Your 25 km – 100 km discovery radius, extended emergency alerts, and verified perks are now active.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
                <Link to="/map" className="pill-btn pill-btn-dark">Open 25km+ Live Map</Link>
                <Link to="/badges" className="pill-btn pill-btn-gold">Visit Badges Shop</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem' }}>Activate Demo Premium</h2>
              <div>
                <label className="form-label">Full Name</label>
                <input required className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />
              </div>
              <div>
                <label className="form-label">Email Address</label>
                <input required type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aarav@example.com" />
              </div>
              <div>
                <label className="form-label">Phone Number</label>
                <input required type="tel" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <button type="submit" disabled={submitting} className="pill-btn pill-btn-gold" style={{ width: '100%', padding: '12px', marginTop: 6 }}>
                <Sparkles size={16} /> {submitting ? 'Saving...' : 'Activate Premium (25 km+ & Verified)'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
