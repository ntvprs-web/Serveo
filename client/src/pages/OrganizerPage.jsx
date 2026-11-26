import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, ShieldCheck, Users, CheckCircle2, Trash2, Award } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, formatDateShort } from '../utils/api';
import { CATEGORIES, getOrganizerStarTier, getNextOrganizerStarTier } from '../utils/constants';

export default function OrganizerPage() {
  const { user, addToast, refreshEvents, equippedBadges } = useApp();
  const [myEvents, setMyEvents] = useState([]);
  const [verification, setVerification] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [volunteers, setVolunteers] = useState([]);

  const loadMine = () => {
    if (!user) return;
    apiFetch('/api/events/mine').then((d) => setMyEvents(Array.isArray(d) ? d : (d.events || []))).catch(() => {});
    apiFetch('/api/organizer/verification-status').then(setVerification).catch(() => {});
  };

  useEffect(() => {
    loadMine();
  }, [user]);

  const loadVolunteers = async (eventId) => {
    setSelectedEventId(eventId);
    try {
      const d = await apiFetch(`/api/events/${eventId}/volunteers`);
      setVolunteers(d.volunteers || d.applications || []);
    } catch (err) {
      addToast(err.message || 'Could not load volunteer roster');
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await apiFetch(`/api/events/${eventId}`, { method: 'DELETE' });
      addToast('Event deleted');
      loadMine();
      refreshEvents();
    } catch (err) {
      addToast(err.message || 'Delete failed');
    }
  };

  if (!user) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 520, margin: '20px auto' }}>
        <ShieldCheck size={36} color="#F97352" style={{ margin: '0 auto 10px' }} />
        <h2 style={{ margin: '0 0 8px' }}>Organizer Portal</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Sign in to manage your hosted events, review volunteer RSVPs, and track attendance.
        </p>
        <Link to="/login" className="pill-btn pill-btn-dark">
          Sign In to Continue
        </Link>
      </div>
    );
  }

  const currentStar = getOrganizerStarTier(myEvents.length);
  const nextStar = getNextOrganizerStarTier(myEvents.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            Organizer <span className="serif-italic" style={{ fontSize: '1.7rem' }}>Portal</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Manage your hosted public-service events & volunteer rosters
          </p>
        </div>
        <Link to="/post-event" className="pill-btn pill-btn-coral">
          <PlusCircle size={16} /> Host New Event
        </Link>
      </div>

      {/* Verification Status Card */}
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={22} color={verification?.verified ? '#10B981' : '#F59E0B'} />
            <div>
              <div style={{ fontWeight: 700 }}>
                Verification Status: {verification?.status || (user.verified ? 'Verified' : 'Standard')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {equippedBadges.length > 0
                  ? `${equippedBadges.length} Cause Specialist Badge${equippedBadges.length > 1 ? 's' : ''} active — priority listing boost & specialist card seals enabled.`
                  : 'Equip a Verified Cause Badge to unlock priority ranking & specialist seals on your hosted drives.'}
              </div>
            </div>
          </div>
          <Link to="/badges" className="pill-btn">
            <Award size={14} /> {equippedBadges.length > 0 ? 'Manage Badges' : 'Unlock Organizer Badges'}
          </Link>
        </div>

        {equippedBadges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {equippedBadges.map((key) => {
              const cat = CATEGORIES[key];
              if (!cat) return null;
              return (
                <span
                  key={key}
                  className="badge-pill"
                  style={{ background: cat.pastelBg, color: '#111827', border: `1px solid ${cat.color}` }}
                >
                  {cat.emoji} {cat.label} Specialist Active
                </span>
              );
            })}
          </div>
        )}

        {/* Free Community Milestone Star Tier */}
        <div style={{ padding: 12, borderRadius: 14, background: 'var(--bg-surface-muted)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.3rem' }}>{currentStar ? currentStar.emoji : '🌱'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                Community Star Tier: {currentStar ? `${currentStar.label} (${currentStar.minEvents}+ Events)` : 'Starter Community'}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {nextStar
                  ? `${myEvents.length} hosted events · Host ${nextStar.minEvents - myEvents.length} more to unlock ${nextStar.emoji} ${nextStar.label} (${nextStar.minEvents}+)`
                  : `Maximum Diamond Star Tier unlocked (${myEvents.length} hosted events)!`}
              </div>
            </div>
          </div>
          {currentStar && (
            <span className="badge-pill" style={{ background: currentStar.bg, color: '#111827', border: `1px solid ${currentStar.color}` }}>
              {currentStar.emoji} {currentStar.label}
            </span>
          )}
        </div>
      </div>

      {/* Hosted Events */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 14px' }}>My Hosted Events ({myEvents.length})</h3>
        {myEvents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            You haven't hosted any events yet. Click "Host New Event" to publish your first initiative.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myEvents.map((ev) => (
              <div
                key={ev.id}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: 'var(--bg-surface-muted)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{ev.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatDateShort(ev.date)} · {ev.city} · Status: <strong>{ev.status}</strong> · {ev.volunteersJoined || 0}/{ev.volunteersNeeded} volunteers
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => loadVolunteers(ev.id)} className="pill-btn">
                    <Users size={14} /> Roster
                  </button>
                  <button type="button" onClick={() => handleDelete(ev.id)} className="pill-btn" style={{ color: '#EF4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Volunteer Roster */}
      {selectedEventId && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px' }}>Volunteer Roster (Event #{selectedEventId})</h3>
          {volunteers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>No volunteer applications recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {volunteers.map((v, i) => (
                <div key={v.id || i} style={{ padding: 12, borderRadius: 12, background: 'var(--bg-surface-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{v.name || 'Volunteer'}</strong> · {v.role || 'On-site'}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{v.status || 'joined'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
