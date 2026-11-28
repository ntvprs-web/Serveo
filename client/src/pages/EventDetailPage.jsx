import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Bookmark,
  Calendar,
  CheckCircle2,
  Flag,
  MapPin,
  Navigation,
  Share2,
  Users
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getCategoryInfo } from '../utils/constants';
import { apiFetch, formatDateShort, getDirectionsUrl } from '../utils/api';
import { applyPageSeo } from '../components/SeoHead';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, savedIds, toggleSaved, addToast, refreshEvents, ownedBadges, equippedBadges } = useApp();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview'); // 'overview' | 'volunteers' | 'map' | 'reviews'
  const [reviews, setReviews] = useState([]);
  const [contact, setContact] = useState(null);

  // Volunteer application state
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [volRole, setVolRole] = useState('On-site Volunteer');
  const [volNotes, setVolNotes] = useState('');
  const [volAgeConsent, setVolAgeConsent] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!showVolunteerModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowVolunteerModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showVolunteerModal]);

  // Review / False-alarm state
  const [reviewOutcome, setReviewOutcome] = useState('helpful');
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/events/${encodeURIComponent(id)}`)
      .then((d) => {
        if (!active) return;
        const ev = d.event || d;
        setEvent(ev);
        if (ev?.title) {
          const desc = String(ev.description || '').replace(/\s+/g, ' ').trim().slice(0, 160) || `Join ${ev.title} in ${ev.city || 'India'} with SERVEO.`;
          applyPageSeo({
            title: `${ev.title} in ${ev.city || ev.state || 'India'} | SERVEO`,
            description: desc,
            canonicalPath: `/event/${encodeURIComponent(String(ev.id))}`,
            noIndex: ev.status !== 'approved'
          });
        }
      })
      .catch(() => {
        if (active) setEvent(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    apiFetch(`/api/events/${encodeURIComponent(id)}/reviews`)
      .then((d) => {
        if (active && Array.isArray(d.reviews)) setReviews(d.reviews);
      })
      .catch(() => {});

    apiFetch(`/api/events/${encodeURIComponent(id)}/contact`)
      .then((d) => {
        if (active) setContact(d.contact || null);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <div className="card" style={{ padding: 36, textAlign: 'center' }}>Loading event details...</div>;
  }

  if (!event) {
    return (
      <div className="card" style={{ padding: 36, textAlign: 'center' }}>
        <h2>Event not found</h2>
        <button type="button" onClick={() => navigate('/events')} className="pill-btn pill-btn-dark">
          Browse All Events
        </button>
      </div>
    );
  }

  const cat = getCategoryInfo(event.category);
  const isSaved = savedIds.includes(String(event.id));
  const hostHasSpecialistBadge =
    (Array.isArray(event.ownerBadges) && event.ownerBadges.includes(event.category)) ||
    Boolean(user && event.ownerId && String(event.ownerId) === String(user.id) && equippedBadges.includes(event.category));
  const volunteerHasSpecialistBadge = ownedBadges.includes(event.category);

  const handleQuickJoin = async () => {
    try {
      setJoining(true);
      const res = await apiFetch(`/api/events/${encodeURIComponent(event.id)}/join`, {
        method: 'POST',
        body: JSON.stringify({ role: volRole, notes: volNotes })
      });
      setEvent((prev) => ({
        ...prev,
        volunteersJoined: res.volunteersJoined ?? (prev.volunteersJoined || 0) + 1
      }));
      addToast('You are registered as a volunteer! Live count updated.');
      setShowVolunteerModal(false);
      refreshEvents();
    } catch (err) {
      addToast(err.message || 'Could not join event');
    } finally {
      setJoining(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      addToast('Please sign in to submit a review or false-alarm report.');
      navigate('/login');
      return;
    }
    try {
      await apiFetch(`/api/events/${encodeURIComponent(event.id)}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ outcome: reviewOutcome, comment: reviewComment })
      });
      addToast(
        reviewOutcome === 'false_alarm'
          ? 'False-alarm report recorded. Our 2-strike trust engine has been updated.'
          : 'Thank you for your community review!'
      );
      setReviewComment('');
      const d = await apiFetch(`/api/events/${encodeURIComponent(event.id)}/reviews`);
      if (Array.isArray(d.reviews)) setReviews(d.reviews);
    } catch (err) {
      addToast(err.message || 'Failed to submit review');
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event.title, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      addToast('Event link copied!');
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top Bar (Ref 2 style back button + actions) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            border: '1px solid var(--border-subtle)',
            background: 'var(--accent-blush)',
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => toggleSaved(event.id)} className="pill-btn">
            <Bookmark size={16} fill={isSaved ? '#F4C95D' : 'none'} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
          <button type="button" onClick={handleShare} className="pill-btn">
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Main Detail Card (Ref 2 layout) */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ borderRadius: 20, overflow: 'hidden', height: 240, marginBottom: 18, background: cat.pastelBg }}>
          <img src={cat.image} alt={`${event.title} — ${cat.label} community event`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <span className="badge-pill" style={{ background: cat.pastelBg, color: '#111827' }}>
            {cat.emoji} {cat.label}
          </span>
          {event.verified && (
            <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46' }}>
              <CheckCircle2 size={13} /> Verified Organizer
            </span>
          )}
          {hostHasSpecialistBadge && (
            <span className="badge-pill" style={{ background: cat.pastelBg, color: '#111827', border: `1px solid ${cat.color}` }}>
              <Award size={13} color={cat.color} /> Verified {cat.label} Specialist Host
            </span>
          )}
          {volunteerHasSpecialistBadge && (
            <span className="badge-pill" style={{ background: 'var(--accent-gold-soft)', color: '#111827' }}>
              ★ Your {cat.label} Badge: Priority Roster & +25% Bonus Active
            </span>
          )}
        </div>

        <h1 style={{ margin: '0 0 10px', fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>
          {event.title}
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="#F97352" />
            <span>{event.address}, {event.city}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="#3B82F6" />
            <span>{formatDateShort(event.date)} · {event.startTime || '09:00'} – {event.endTime || '17:00'}</span>
          </div>
        </div>

        {/* Segmented Tabs (Reference 2: Overview | Volunteers | Map | Reviews) */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: 5,
            borderRadius: 16,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-muted)',
            marginBottom: 18,
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'volunteers', label: 'Volunteers' },
            { id: 'map', label: 'Map & Directions' },
            { id: 'reviews', label: `Reviews (${reviews.length})` }
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  minWidth: 100,
                  padding: '9px 12px',
                  borderRadius: 12,
                  border: 'none',
                  background: active ? 'var(--accent-charcoal)' : 'transparent',
                  color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.83rem'
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              {event.description}
            </p>
            <div style={{ padding: 14, borderRadius: 16, background: 'var(--bg-surface-muted)', fontSize: '0.85rem' }}>
              <strong>Hosted by:</strong> {event.organizer}
              {contact ? ` · Contact: ${contact}` : ''}
            </div>
            {event.donationLink && (
              <div style={{ padding: 14, borderRadius: 16, background: 'var(--accent-gold-soft)', color: '#111827', fontSize: '0.84rem' }}>
                <strong>Support / Donation UPI:</strong>{' '}
                <a href={event.donationLink} style={{ textDecoration: 'underline', fontWeight: 700 }}>
                  {event.donationLink}
                </a>
                <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.85 }}>
                  Always verify the organizer UPI ID independently before sending funds.
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'volunteers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>{event.volunteersJoined || 0} Volunteers Joined</span>
              <span style={{ color: 'var(--text-muted)' }}>Goal: {event.volunteersNeeded || 50}</span>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: 'var(--bg-surface-muted)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.round(((event.volunteersJoined || 0) / (event.volunteersNeeded || 1)) * 100))}%`,
                  height: '100%',
                  background: cat.color
                }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Volunteer counts update in real time across all connected devices via Server-Sent Events (SSE).
            </p>
          </div>
        )}

        {tab === 'map' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: 16, borderRadius: 16, background: 'var(--bg-surface-muted)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Destination Coordinates</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {event.address}, {event.city} ({event.lat}, {event.lng})
              </div>
            </div>
            <a
              href={getDirectionsUrl(event.lat, event.lng, event.address)}
              target="_blank"
              rel="noreferrer"
              className="pill-btn pill-btn-dark"
              style={{ alignSelf: 'flex-start' }}
            >
              <Navigation size={16} /> Open Turn-by-Turn Google Maps
            </a>
          </div>
        )}

        {tab === 'reviews' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="select-field"
                  value={reviewOutcome}
                  onChange={(e) => setReviewOutcome(e.target.value)}
                  style={{ width: 'auto' }}
                >
                  <option value="helpful">Verified & Helpful</option>
                  <option value="false_alarm">Report False Alarm / Fake Event</option>
                </select>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Share your experience or report details..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="pill-btn pill-btn-dark">
                  <Flag size={14} /> Submit
                </button>
              </div>
            </form>

            {reviews.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No community reviews yet.</p>
            ) : (
              reviews.map((r, i) => (
                <div key={r.id || i} style={{ padding: 12, borderRadius: 14, background: 'var(--bg-surface-muted)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                    {r.outcome === 'false_alarm' ? '⚠️ False Alarm Report' : '✅ Verified Feedback'}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {r.comment || 'No comment provided.'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bottom CTA Bar (Reference 2: Avatars + Yellow CTA Button) */}
        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#F97352" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{event.volunteersJoined || 0}+ Going</span>
          </div>

          <button
            type="button"
            onClick={() => setShowVolunteerModal(true)}
            className="pill-btn pill-btn-gold"
            style={{ padding: '12px 26px', fontSize: '0.92rem' }}
          >
            Volunteer for this Event
          </button>
        </div>
      </div>

      {/* Volunteer RSVP Modal */}
      {showVolunteerModal && (
        <div
          onClick={() => setShowVolunteerModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rsvp-modal-title"
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <h3 id="rsvp-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Join &ldquo;{event.title}&rdquo;</h3>
            <div>
              <label htmlFor="rsvp-role" className="form-label">Preferred Role</label>
              <select id="rsvp-role" className="select-field" value={volRole} onChange={(e) => setVolRole(e.target.value)}>
                <option value="On-site Volunteer">On-site Volunteer</option>
                <option value="Registration & Crowd Desk">Registration & Crowd Desk</option>
                <option value="Logistics & Supplies">Logistics & Supplies</option>
                <option value="Medical / First-Aid Support">Medical / First-Aid Support</option>
              </select>
            </div>
            <div>
              <label htmlFor="rsvp-notes" className="form-label">Notes (Optional)</label>
              <textarea
                id="rsvp-notes"
                className="textarea-field"
                rows={3}
                placeholder="Any skills, availability window, or vehicle support..."
                value={volNotes}
                onChange={(e) => setVolNotes(e.target.value)}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={volAgeConsent}
                onChange={(e) => setVolAgeConsent(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>I confirm I am 18+ or participating with parent/legal guardian consent.</span>
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowVolunteerModal(false)} className="pill-btn">
                Cancel
              </button>
              <button
                type="button"
                disabled={joining || !volAgeConsent}
                onClick={handleQuickJoin}
                className="pill-btn pill-btn-gold"
              >
                {joining ? 'Confirming...' : 'Confirm Volunteer RSVP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
