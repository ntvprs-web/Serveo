import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Calendar,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Clock,
  PlusCircle,
  Users,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORIES, DEMO_HOSTING_TEMPLATES, HOSTING_PACKAGES } from '../utils/constants';
import { apiFetch, formatDateShort } from '../utils/api';
import EventCard from '../components/EventCard';

export default function HomePage() {
  const { events, eventsLoading, savedIds, userLocation } = useApp();
  const navigate = useNavigate();

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'live' | 'nearby' | 'saved'
  const [organizers, setOrganizers] = useState([]);

  // Build 7-day calendar strip starting today
  const weekDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return {
        idx: i,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        iso: d.toISOString().split('T')[0]
      };
    });
  }, []);

  useEffect(() => {
    apiFetch('/api/organizers/overview')
      .then((d) => {
        if (Array.isArray(d.organizers)) setOrganizers(d.organizers.slice(0, 8));
      })
      .catch(() => {});
  }, []);

  // Category counts
  const categoryList = useMemo(() => {
    return Object.values(CATEGORIES).map((cat) => ({
      ...cat,
      count: events.filter((e) => e.category === cat.key).length
    }));
  }, [events]);

  // Highlighted match cards (Ref 3)
  const highlightEvents = useMemo(() => {
    const liveOrCritical = events.filter((e) => e.urgency === 'critical' || e.urgency === 'live');
    return (liveOrCritical.length >= 2 ? liveOrCritical : events).slice(0, 4);
  }, [events]);

  // Filtered schedule list (Ref 1)
  const filteredEvents = useMemo(() => {
    let list = [...events];
    if (filterTab === 'live') {
      list = list.filter((e) => e.urgency === 'live' || e.urgency === 'critical');
    } else if (filterTab === 'nearby') {
      list = list.filter((e) => e.distanceKm !== null && e.distanceKm <= 5);
    } else if (filterTab === 'saved') {
      list = list.filter((e) => savedIds.includes(String(e.id)));
    }
    return list.slice(0, 6);
  }, [events, filterTab, savedIds]);

  const nearbyCount = useMemo(
    () => events.filter((e) => e.distanceKm !== null && e.distanceKm <= 5).length,
    [events]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Home Hero & Demo Event Hosting Banner */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 620, minWidth: 0, flex: '1 1 260px' }}>
          <img
            src="/images/serveo-logo.jpg"
            alt="SERVEO Icon"
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              objectFit: 'cover',
              boxShadow: 'var(--shadow-md)',
              flexShrink: 0
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <span className="badge-pill" style={{ background: 'var(--accent-gold-soft)', color: '#111827', marginBottom: 6, maxWidth: '100%' }}>
              <Sparkles size={13} style={{ flexShrink: 0 }} />{' '}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userLocation
                  ? `${nearbyCount} events within 5 km of you`
                  : `${events.length} live public-service events across India`}
              </span>
            </span>
            <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.22rem, 3.8vw, 1.55rem)', fontWeight: 800, lineHeight: 1.2 }}>
              Discover Nearby Drives & <span className="serif-italic" style={{ fontSize: 'clamp(1.35rem, 4.2vw, 1.75rem)' }}>Host Social Events</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Find volunteer opportunities around you or launch a public-service event at any destination with real-time alerts.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/map" className="pill-btn">
            <MapPin size={15} /> Live Map
          </Link>
          <Link to="/post-event" className="pill-btn pill-btn-coral">
            <PlusCircle size={15} /> Host an Event
          </Link>
        </div>
      </section>

      {/* Demo Event Hosting Templates */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
            Try Demo Event <span className="serif-italic" style={{ fontSize: '1.35rem' }}>Hosting</span>
          </h2>
          <Link to="/post-event" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Custom Event Form →
          </Link>
        </div>
        <div className="grid-responsive-3">
          {DEMO_HOSTING_TEMPLATES.map((tpl) => {
            const cat = CATEGORIES[tpl.category] || CATEGORIES.other;
            return (
              <div key={tpl.id} className="card card-interactive" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge-pill" style={{ background: cat.pastelBg, color: '#111827' }}>
                    {cat.emoji} {cat.label}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{tpl.city}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{tpl.title}</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, flex: 1 }}>
                  {tpl.description}
                </p>
                <Link
                  to={`/post-event?template=${encodeURIComponent(tpl.id)}`}
                  className="pill-btn pill-btn-dark"
                  style={{ width: '100%', padding: '8px 14px', fontSize: '0.8rem' }}
                >
                  <PlusCircle size={14} /> Use Demo Template
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7-Day Interactive Calendar Strip (Reference 1) */}
      <section
        className="card"
        style={{
          padding: '12px 14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 6
        }}
      >
        {weekDays.map((day) => {
          const active = selectedDayIdx === day.idx;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => setSelectedDayIdx(day.idx)}
              style={{
                border: 'none',
                borderRadius: 18,
                padding: '8px 4px',
                background: active ? 'var(--accent-charcoal)' : 'transparent',
                color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '0.7rem', opacity: active ? 0.85 : 0.6, fontWeight: 600 }}>
                {day.dayName}
              </span>
              <span style={{ fontSize: '0.98rem', fontWeight: 700 }}>{day.dayNum}</span>
            </button>
          );
        })}
      </section>

      {/* Priority & Urgent Match Cards (Reference 3) */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            Priority <span className="serif-italic" style={{ fontSize: '1.4rem' }}>Initiatives</span>
          </h2>
          <Link to="/events" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            View All →
          </Link>
        </div>

        {eventsLoading ? (
          <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading live community events...
          </div>
        ) : (
          <div className="h-scroll">
            {highlightEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} variant="highlight" />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Events Grid (Reference 1) */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Upcoming Events</h2>
          <Link to="/events" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            See More
          </Link>
        </div>

        <div className="grid-responsive-3">
          {events.slice(0, 6).map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      </section>

      {/* Explore Categories Pastel Grid (References 2 & 3) */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
            Explore <span className="serif-italic" style={{ fontSize: '1.35rem' }}>Categories</span>
          </h2>
          <Link to="/events" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            All Categories
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(138px, 100%), 1fr))',
            gap: 12
          }}
        >
          {categoryList.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => navigate(`/events?category=${encodeURIComponent(cat.key)}`)}
              className="card card-interactive"
              style={{
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  background: cat.pastelBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}
              >
                {cat.emoji}
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{cat.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat.count} events</div>
            </button>
          ))}
        </div>
      </section>

      {/* Filterable Schedule List + Popular Communities (Reference 1 Two-Column Desktop Split) */}
      <section className="grid-responsive-2" style={{ alignItems: 'start' }}>
        {/* Left: Compact Schedule List */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {[
              { id: 'all', label: 'Going / All' },
              { id: 'live', label: 'Live Now' },
              { id: 'nearby', label: 'Nearby ≤5km' },
              { id: 'saved', label: `Saved (${savedIds.length})` }
            ].map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className="pill-btn"
                  style={{
                    padding: '7px 14px',
                    fontSize: '0.8rem',
                    background: active ? 'var(--accent-charcoal)' : 'var(--bg-surface-muted)',
                    color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                    borderColor: 'transparent'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredEvents.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                No events match this filter yet.
              </div>
            ) : (
              filteredEvents.map((ev, idx) => (
                <Link
                  key={ev.id}
                  to={`/event/${ev.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    minWidth: 0,
                    overflow: 'hidden',
                    padding: '10px 12px',
                    borderRadius: 16,
                    background: idx === 1 ? 'var(--bg-surface-muted)' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: CATEGORIES[ev.category]?.pastelBg || '#F3E8FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.15rem',
                      flexShrink: 0
                    }}
                  >
                    {CATEGORIES[ev.category]?.emoji || '✨'}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {ev.title}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} /> {formatDateShort(ev.date)}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {ev.startTime || '09:00'}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Right: Popular Communities & Verified Organizers */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Popular Communities</h3>
            <Link to="/organizer" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Organizer Portal
            </Link>
          </div>

          <div className="grid-responsive-2" style={{ gap: 12 }}>
            {(organizers.length > 0
              ? organizers.slice(0, 4)
              : [
                  { organizer: 'Indian Red Cross Society', verified: true, eventCount: 12, totalVolunteers: 480 },
                  { organizer: 'Akshaya Patra Foundation', verified: true, eventCount: 5, totalVolunteers: 320 },
                  { organizer: 'Blue Cross of India', verified: true, eventCount: 4, totalVolunteers: 190 },
                  { organizer: 'Robin Hood Army', verified: true, eventCount: 8, totalVolunteers: 610 }
                ]
            ).map((org) => (
              <div
                key={org.organizer}
                style={{
                  padding: 14,
                  borderRadius: 18,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  minWidth: 0,
                  width: '100%'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', overflowWrap: 'anywhere' }}>{org.organizer}</span>
                    {org.verified && <CheckCircle2 size={14} color="#10B981" style={{ flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Users size={13} style={{ flexShrink: 0 }} /> {org.totalVolunteers || 100}+ volunteers · {org.eventCount || 1} drives
                  </div>
                </div>
                <Link
                  to={`/events?search=${encodeURIComponent(org.organizer)}`}
                  className="pill-btn"
                  style={{ width: '100%', padding: '7px 12px', fontSize: '0.78rem' }}
                >
                  Explore Drives
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Destination Event Hosting Services Section */}
      <section className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 18
          }}
        >
          <div>
            <span
              className="badge-pill"
              style={{ background: 'var(--accent-gold-soft)', color: '#111827', marginBottom: 8 }}
            >
              <ShieldCheck size={13} /> Event Hosting & Destination Services
            </span>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
              Host Public-Service Events at Any Destination
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Pinpoint venues across India, mobilize nearby volunteers within 0–5 km, track verified attendance, and issue certificates.
            </p>
          </div>
          <Link to="/post-event" className="pill-btn pill-btn-dark">
            Start Hosting Now <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid-responsive-3">
          {HOSTING_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              style={{
                padding: 18,
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1rem' }}>{pkg.name}</strong>
                <span className="badge-pill" style={{ background: pkg.accent, color: '#111827' }}>
                  {pkg.price}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pkg.tagline}</p>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {pkg.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
