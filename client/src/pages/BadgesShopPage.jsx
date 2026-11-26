import React from 'react';
import { Link } from 'react-router-dom';
import { Award, ShoppingBag, Clock, Sparkles, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORIES, BADGE_OVERVIEW_BENEFITS, getBadgeDetails, ORGANIZER_STAR_TIERS } from '../utils/constants';

export default function BadgesShopPage() {
  const { user, ownedBadges, equippedBadges, buyBadge, toggleEquipBadge } = useApp();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800 }}>
            Organizer Verified Badges <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Shop</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            For Organizations & Event Hosts: boost event reach, unlock specialist seals, and rank higher in discovery. (Volunteer badges are 100% free in My Hours!)
          </p>
        </div>
        <Link to="/my-hours" className="pill-btn">
          <Clock size={15} /> Free Volunteer Badges
        </Link>
      </div>

      {/* Community Milestone Star Tiers (Free Automatic Organizer Tiers) */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            Free Community & Organization Milestone Stars
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Earned automatically as your community hosts more verified events
          </span>
        </div>
        <div className="h-scroll">
          {[...ORGANIZER_STAR_TIERS].reverse().map((t) => (
            <div
              key={t.id}
              className="badge-pill"
              style={{
                background: t.bg,
                color: '#111827',
                border: `1px solid ${t.color}`,
                flexShrink: 0,
                padding: '6px 12px',
                fontSize: '0.8rem'
              }}
            >
              <span>{t.emoji}</span>
              <span><strong>{t.label}</strong> · {t.minEvents}+ Events</span>
            </div>
          ))}
        </div>
      </div>

      {/* Why Get a Verified Badge? Benefits Overview */}
      <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-muted) 100%)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#F59E0B" /> Why Buy a Verified Cause Badge?
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge-pill" style={{ background: '#111827', color: '#FFFFFF' }}>
              <Award size={13} /> {ownedBadges.length} Owned
            </span>
            <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46' }}>
              <ShieldCheck size={13} /> {equippedBadges.length} Equipped Live
            </span>
          </div>
        </div>

        <div className="grid-responsive-2" style={{ gap: 12 }}>
          {BADGE_OVERVIEW_BENEFITS.map((b) => (
            <div
              key={b.id}
              style={{
                padding: 14,
                borderRadius: 16,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{b.detail}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'var(--accent-gold-soft)',
            color: '#111827',
            fontSize: '0.82rem'
          }}
        >
          <strong>{user ? 'Account Synced (Supabase):' : 'Demo Checkout:'}</strong>{' '}
          {user
            ? `Your badges are saved to your SERVEO account (${user.name}) and boost your hosted drives & volunteer standing automatically.`
            : 'Badges are saved in your browser for Guest. Sign in anytime to sync badges to your SERVEO account and boost your hosted events.'}
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid-responsive-3">
        {Object.values(CATEGORIES).map((cat, index) => {
          const { price, perks } = getBadgeDetails(cat, index);
          const isOwned = ownedBadges.includes(cat.key);
          const isEquipped = equippedBadges.includes(cat.key);
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ₹{price} · Lifetime Cause Badge
                    </div>
                  </div>
                </div>
                {isOwned && (
                  <span
                    className="badge-pill"
                    style={{
                      background: isEquipped ? '#D1FAE5' : 'var(--bg-surface-muted)',
                      color: isEquipped ? '#065F46' : 'var(--text-muted)',
                      fontSize: '0.72rem'
                    }}
                  >
                    {isEquipped ? 'Active' : 'Hidden'}
                  </span>
                )}
              </div>

              <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>

              {isOwned ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => toggleEquipBadge(cat.key)}
                    className={`pill-btn ${isEquipped ? '' : 'pill-btn-dark'}`}
                    style={{ flex: 1 }}
                  >
                    {isEquipped ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{isEquipped ? 'Equipped (Hide)' : 'Equip on Cards'}</span>
                  </button>
                  <span className="pill-btn" style={{ background: cat.pastelBg, color: '#111827', cursor: 'default' }}>
                    <CheckCircle2 size={14} /> Owned
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => buyBadge(cat.key, cat.label, price)}
                  className="pill-btn pill-btn-dark"
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  <ShoppingBag size={14} />
                  <span>Unlock {cat.label} Badge (₹{price})</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
