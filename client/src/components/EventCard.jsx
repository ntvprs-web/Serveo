import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Share2, Calendar, MapPin, CheckCircle2, Users } from 'lucide-react';
import { getCategoryInfo } from '../utils/constants';
import { formatDateShort } from '../utils/api';
import { useApp } from '../context/AppContext';

export default function EventCard({ event, variant = 'standard' }) {
  const { savedIds, toggleSaved, addToast } = useApp();
  const cat = getCategoryInfo(event.category);
  const isSaved = savedIds.includes(String(event.id));
  const needed = Number(event.volunteersNeeded) || 1;
  const joined = Number(event.volunteersJoined) || 0;
  const pct = Math.min(100, Math.round((joined / needed) * 100));

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/event/${event.id}`;
    if (navigator.share) {
      navigator.share({ title: event.title, text: event.description, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      addToast('Event link copied to clipboard!');
    }
  };

  const handleBookmark = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaved(event.id);
  };

  // Match-style pastel card (Reference 3)
  if (variant === 'highlight') {
    const isGold = event.urgency === 'live' || event.urgency === 'critical';
    return (
      <Link
        to={`/event/${event.id}`}
        className="card-interactive"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 18,
          borderRadius: 24,
          background: isGold ? 'var(--accent-gold)' : 'var(--accent-sage)',
          color: '#111827',
          minWidth: 265,
          border: '1px solid rgba(15,23,42,0.08)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span
              className="badge-pill"
              style={{
                background: 'rgba(17, 24, 39, 0.12)',
                color: '#111827'
              }}
            >
              {event.urgency === 'critical' ? 'Critical Need' : event.urgency === 'live' ? 'Live Now' : cat.label}
            </span>
            <button
              type="button"
              onClick={handleBookmark}
              aria-label="Save event"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.65)',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Bookmark size={16} fill={isSaved ? '#111827' : 'none'} />
            </button>
          </div>

          <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.25 }}>
            {event.title}
          </h3>
          <div style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 500 }}>
            {formatDateShort(event.date)} · {event.city}
            {event.distanceKm !== null && event.distanceKm !== undefined ? ` · ${event.distanceKm} km` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={15} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{joined}+ Going</span>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textDecoration: 'underline' }}>
            View Details →
          </span>
        </div>
      </Link>
    );
  }

  // Standard Featured Card (Reference 1)
  return (
    <Link
      to={`/event/${event.id}`}
      className="card card-interactive"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 12
      }}
    >
      {/* Image Banner with Floating Bookmark & Share */}
      <div
        style={{
          position: 'relative',
          height: 164,
          borderRadius: 16,
          overflow: 'hidden',
          background: cat.pastelBg
        }}
      >
        <img
          src={cat.image}
          alt={event.title}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.18) 0%, rgba(15,23,42,0.02) 55%, rgba(15,23,42,0.35) 100%)'
          }}
        />
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          <span
            className="badge-pill"
            style={{
              background: 'rgba(255,255,255,0.92)',
              color: '#111827',
              backdropFilter: 'blur(6px)'
            }}
          >
            {cat.emoji} {cat.label}
          </span>
          {(event.urgency === 'live' || event.urgency === 'critical') && (
            <span
              className="badge-pill"
              style={{
                background: event.urgency === 'critical' ? '#DC2626' : '#EF4444',
                color: '#FFFFFF'
              }}
            >
              ● {event.urgency === 'critical' ? 'CRITICAL' : 'LIVE'}
            </span>
          )}
        </div>

        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={handleBookmark}
            aria-label="Save event"
            style={{
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
            <Bookmark size={15} fill={isSaved ? '#F4C95D' : 'none'} color={isSaved ? '#F4C95D' : '#FFFFFF'} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share event"
            style={{
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
      </div>

      {/* Card Body */}
      <div style={{ padding: '12px 6px 6px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          <span>{event.organizer}</span>
          {event.verified && <CheckCircle2 size={14} color="#10B981" />}
        </div>

        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>
          {event.title}
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={14} /> {formatDateShort(event.date)} · {event.startTime || '09:00'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={14} /> {event.city}
            {event.distanceKm !== null && event.distanceKm !== undefined ? ` (${event.distanceKm} km)` : ''}
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.83rem',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {event.description}
        </p>

        {/* Progress & Going Count */}
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, marginBottom: 5 }}>
            <span>{joined}+ Going</span>
            <span style={{ color: 'var(--text-muted)' }}>Goal: {needed}</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-surface-muted)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 99,
                background: cat.color
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
