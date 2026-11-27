import React from 'react';
import { Award, CheckCircle2, Eye, EyeOff, ShoppingBag, Sparkles, ShieldCheck } from 'lucide-react';
import BadgeMedallion from './BadgeMedallion';

/**
 * Collectible Organizer Cause Badge card used across the Badges Shop and My Hours view.
 */
export default function OrganizerBadgeCard({
  cat,
  details,
  isOwned,
  isEquipped,
  onToggleEquip,
  onPurchase,
  compactActionLabel
}) {
  const { price, sealName, tierLabel, spotlightCopy, perks } = details;

  return (
    <div
      className="card badge-shop-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: isOwned ? `2px solid ${cat.color}` : '1px solid var(--border-subtle)',
        boxShadow: isOwned ? `0 12px 28px ${cat.color}24` : 'var(--shadow-sm)'
      }}
    >
      {/* Top gradient showcase header */}
      <div
        style={{
          padding: '16px 18px 14px',
          background: `linear-gradient(135deg, ${cat.color}24 0%, ${cat.pastelBg}85 52%, transparent 100%)`,
          borderBottom: '1px solid var(--border-subtle)',
          borderTop: `4px solid ${cat.color}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            className="badge-pill"
            style={{
              background: isOwned ? (isEquipped ? '#10B981' : 'var(--bg-surface)') : 'var(--bg-surface)',
              color: isOwned ? (isEquipped ? '#FFFFFF' : 'var(--text-muted)') : cat.color,
              border: `1px solid ${isOwned && isEquipped ? '#10B981' : `${cat.color}55`}`,
              fontSize: '0.7rem',
              fontWeight: 700
            }}
          >
            <Sparkles size={11} />
            {isOwned ? (isEquipped ? 'Live on Cards' : 'Hidden') : tierLabel}
          </span>

          <span
            className="badge-pill"
            style={{
              background: '#111827',
              color: '#F4C95D',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '4px 11px',
              boxShadow: '0 4px 10px rgba(17,24,39,0.16)'
            }}
          >
            ₹{price} <span style={{ opacity: 0.78, fontWeight: 600 }}>· Lifetime</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <BadgeMedallion
            badgeKey={cat.key}
            color={cat.color}
            pastelBg={cat.pastelBg}
            size={64}
            verified={true}
            animated={true}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: cat.color }}>
              {cat.label}
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.04rem', lineHeight: 1.2, marginTop: 2 }}>
              {sealName}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.35 }}>
              {spotlightCopy}
            </div>
          </div>
        </div>
      </div>

      {/* Body: Card Seal Preview + Perks + Action */}
      <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {/* Live Event Card Seal Preview */}
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 12,
            background: 'var(--bg-surface-muted)',
            border: '1px dashed var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap'
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Card Seal Preview</span>
          <span
            className="specialist-seal-pill"
            style={{
              background: `linear-gradient(135deg, ${cat.pastelBg} 0%, #FFFFFF 100%)`,
              color: '#111827',
              border: `1px solid ${cat.color}`
            }}
          >
            <Award size={12} color={cat.color} />
            <span>Verified {cat.label} Specialist</span>
            <ShieldCheck size={12} color="#10B981" />
          </span>
        </div>

        {/* Perks List */}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {perks.map((perk) => (
            <li key={perk} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.4 }}>
              <CheckCircle2 size={15} color={cat.color} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{perk}</span>
            </li>
          ))}
        </ul>

        {isOwned ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => onToggleEquip(cat.key)}
              className={`pill-btn ${isEquipped ? '' : 'pill-btn-dark'}`}
              style={{ flex: 1 }}
            >
              {isEquipped ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{isEquipped ? 'Equipped (Hide)' : 'Equip on Cards'}</span>
            </button>
            <span className="pill-btn" style={{ background: cat.pastelBg, color: '#111827', borderColor: cat.color, cursor: 'default' }}>
              <CheckCircle2 size={14} color={cat.color} /> Owned
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onPurchase(cat, price)}
            className="badge-buy-btn"
            style={{
              marginTop: 'auto',
              background: `linear-gradient(135deg, #111827 0%, #1F2937 52%, ${cat.color} 150%)`
            }}
          >
            <ShoppingBag size={15} />
            <span>{compactActionLabel || `Unlock Verified Seal · ₹${price}`}</span>
          </button>
        )}
      </div>
    </div>
  );
}
