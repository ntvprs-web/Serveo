import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, ShoppingBag, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORIES } from '../utils/constants';

export default function BadgesShopPage() {
  const { user, addToast } = useApp();

  const userKey = String(user?.id || user?.username || 'guest');
  const storageKey = `serveo_category_badges_${userKey}`;

  const [ownedBadges, setOwnedBadges] = useState(() => {
    try {
      const val = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(val) ? val : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const val = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setOwnedBadges(Array.isArray(val) ? val : []);
    } catch {
      setOwnedBadges([]);
    }
  }, [storageKey]);

  const handleBuyBadge = (catKey, label) => {
    if (ownedBadges.includes(catKey)) return;
    const next = [...ownedBadges, catKey];
    setOwnedBadges(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    addToast(`"${label}" badge added to your verified collection! (Demo checkout)`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800 }}>
            Verified Badges <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Shop</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Choose an animated category badge to highlight your focus on matching event cards and organizer profiles
          </p>
        </div>
        <Link to="/my-hours" className="pill-btn">
          <Clock size={15} /> View My Hours
        </Link>
      </div>

      {/* Demo Checkout Notice */}
      <div className="card" style={{ padding: 16, background: 'var(--accent-gold-soft)', color: '#111827', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: '0.86rem' }}>
          <strong>Demo Checkout:</strong> Badge purchases are simulated in this prototype and saved in your browser for{' '}
          <strong>{user ? user.name : 'Guest'}</strong>. No payment is processed.
        </div>
        <span className="badge-pill" style={{ background: '#111827', color: '#FFFFFF' }}>
          <Award size={13} /> {ownedBadges.length} Owned
        </span>
      </div>

      {/* Badges Grid */}
      <div className="grid-responsive-3">
        {Object.values(CATEGORIES).map((cat, index) => {
          const price = 49 + index * 10;
          const isOwned = ownedBadges.includes(cat.key);
          return (
            <div
              key={cat.key}
              className="card"
              style={{
                padding: 18,
                border: isOwned ? `2px solid ${cat.color}` : '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: cat.pastelBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    flexShrink: 0
                  }}
                >
                  {cat.emoji}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>{cat.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>₹{price} · Demo Badge</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Interactive {cat.label.toLowerCase()} badge for event cards and verified organizer highlights.
              </p>
              <button
                type="button"
                disabled={isOwned}
                onClick={() => handleBuyBadge(cat.key, cat.label)}
                className={`pill-btn ${isOwned ? '' : 'pill-btn-dark'}`}
                style={{ width: '100%', marginTop: 'auto', opacity: isOwned ? 0.78 : 1 }}
              >
                <ShoppingBag size={14} />
                <span>{isOwned ? '✓ Owned in Collection' : `Buy Demo Badge (₹${price})`}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
