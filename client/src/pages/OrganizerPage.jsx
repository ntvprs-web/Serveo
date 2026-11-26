import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  ShieldCheck,
  Users,
  CheckCircle2,
  Trash2,
  Award,
  Calendar,
  MapPin,
  ExternalLink,
  Upload,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, formatDateShort } from '../utils/api';
import {
  CATEGORIES,
  getCategoryInfo,
  ORGANIZER_STAR_TIERS,
  getOrganizerStarTier,
  getNextOrganizerStarTier
} from '../utils/constants';

export default function OrganizerPage() {
  const { user, addToast, refreshEvents, equippedBadges } = useApp();
  const [myEvents, setMyEvents] = useState([]);
  const [verification, setVerification] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [volunteers, setVolunteers] = useState([]);
  const [orgType, setOrgType] = useState('ngo');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const loadMine = () => {
    if (!user) return;
    apiFetch('/api/events/mine')
      .then((d) => setMyEvents(Array.isArray(d) ? d : (d.events || [])))
      .catch(() => {});
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
      if (String(selectedEventId) === String(eventId)) {
        setSelectedEventId(null);
        setVolunteers([]);
      }
      loadMine();
      refreshEvents();
    } catch (err) {
      addToast(err.message || 'Delete failed');
    }
  };

  const handleUploadVerification = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast('Please choose a PDF, JPG, or PNG file under 5 MB.');
      return;
    }
    setUploadingDoc(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await apiFetch('/api/organizer/verification-document', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          data: dataUrl,
          organizationType: orgType
        })
      });
      addToast('Verification document submitted! Our trust team will review it shortly.');
      loadMine();
    } catch (err) {
      addToast(err.message || 'Document upload failed');
    } finally {
      setUploadingDoc(false);
    }
  };

  const stats = useMemo(() => {
    const totalJoined = myEvents.reduce((sum, ev) => sum + (Number(ev.volunteersJoined) || 0), 0);
    const totalNeeded = myEvents.reduce((sum, ev) => sum + (Number(ev.volunteersNeeded) || 0), 0);
    const approvedCount = myEvents.filter((ev) => ev.status === 'approved').length;
    const fillPct = totalNeeded > 0 ? Math.min(100, Math.round((totalJoined / totalNeeded) * 100)) : 0;
    return { totalJoined, totalNeeded, approvedCount, fillPct };
  }, [myEvents]);

  if (!user) {
    return (
      <div className="card" style={{ padding: 36, textAlign: 'center', maxWidth: 520, margin: '24px auto' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'var(--accent-coral-soft)',
            color: '#F97352',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px'
          }}
        >
          <ShieldCheck size={32} />
        </div>
        <h2 style={{ margin: '0 0 8px' }}>Organizer Portal</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 18 }}>
          Sign in to manage your hosted events, review volunteer rosters, unlock Community Star Tiers, and verify your organization.
        </p>
        <Link to="/login" className="pill-btn pill-btn-dark">
          Sign In to Continue
        </Link>
      </div>
    );
  }

  const currentStar = getOrganizerStarTier(myEvents.length);
  const nextStar = getNextOrganizerStarTier(myEvents.length);
  const starProgressPct = nextStar
    ? Math.min(100, Math.round((myEvents.length / nextStar.minEvents) * 100))
    : 100;
  const verStatus = verification?.status || (user.verified ? 'approved' : 'unverified');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
              background: verStatus === 'approved'
                ? 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)'
                : 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
              color: verStatus === 'approved' ? '#065F46' : '#B45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-md)',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={30} />
          </div>
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              <span
                className="badge-pill"
                style={{
                  background: verStatus === 'approved' ? '#D1FAE5' : 'var(--accent-gold-soft)',
                  color: verStatus === 'approved' ? '#065F46' : '#92400E'
                }}
              >
                <CheckCircle2 size={12} /> Status: {verStatus.toUpperCase()}
              </span>
              {currentStar && (
                <span className="badge-pill" style={{ background: currentStar.bg, color: '#111827', border: `1px solid ${currentStar.color}` }}>
                  {currentStar.emoji} {currentStar.label}
                </span>
              )}
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.2 }}>
              Organizer <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Command Portal</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Manage hosted drives, monitor volunteer turnout, and grow your organization&apos;s community star tier.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/badges" className="pill-btn">
            <Award size={15} color="#F59E0B" /> {equippedBadges.length > 0 ? `Badges (${equippedBadges.length})` : 'Organizer Badges'}
          </Link>
          <Link to="/post-event" className="pill-btn pill-btn-coral">
            <PlusCircle size={16} /> Host New Event
          </Link>
        </div>
      </section>

      {/* 4-Card KPI Summary Strip */}
      <div className="grid-responsive-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Hosted Drives</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 4 }}>{myEvents.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>{stats.approvedCount} live on map & discovery</div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Volunteers Mobilized</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 4 }}>
            {stats.totalJoined} <small style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>/ {stats.totalNeeded || 0}</small>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-surface-muted)', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: `${stats.fillPct}%`, height: '100%', background: '#10B981', borderRadius: 99 }} />
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Specialist Badges Active</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 4, color: '#F59E0B' }}>{equippedBadges.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {equippedBadges.length > 0 ? 'Priority listing boost enabled' : 'Unlock badges for priority reach'}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Community Star Tier</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 6 }}>
            {currentStar ? `${currentStar.emoji} ${currentStar.label}` : '🌱 Starter Host'}
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-surface-muted)', overflow: 'hidden', marginTop: 10 }}>
            <div style={{ width: `${starProgressPct}%`, height: '100%', background: '#F4C95D', borderRadius: 99 }} />
          </div>
        </div>
      </div>

      {/* Star Tiers & Verification Upload Split */}
      <div className="grid-responsive-2" style={{ alignItems: 'stretch' }}>
        {/* Left: Milestone Ladder + Active Specialist Badges */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="#F59E0B" /> Community Milestone Ladder
            </h2>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {nextStar ? `${nextStar.minEvents - myEvents.length} more to ${nextStar.label}` : 'Max tier reached'}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...ORGANIZER_STAR_TIERS].reverse().map((tier) => {
              const unlocked = myEvents.length >= tier.minEvents;
              return (
                <span
                  key={tier.id}
                  className="badge-pill"
                  style={{
                    background: unlocked ? tier.bg : 'var(--bg-surface-muted)',
                    color: unlocked ? '#111827' : 'var(--text-muted)',
                    border: unlocked ? `1px solid ${tier.color}` : '1px solid var(--border-subtle)',
                    opacity: unlocked ? 1 : 0.65
                  }}
                >
                  {tier.emoji} {tier.label} ({tier.minEvents}+)
                </span>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 'auto' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="#F59E0B" /> Equipped Organizer Specialist Badges
            </div>
            {equippedBadges.length > 0 ? (
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
                      {cat.emoji} {cat.label} Specialist
                    </span>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No category badges equipped yet.{' '}
                <Link to="/badges" style={{ textDecoration: 'underline', fontWeight: 600 }}>
                  Unlock in Organizer Badges Shop →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: Organization Trust Verification */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="#10B981" /> Organization Verification
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Verified NGOs, hospitals, blood banks, and restaurants receive a green verified checkmark on all hosted drives and unlock food rescue & blood stock posting.
          </p>

          {verStatus === 'approved' ? (
            <div style={{ padding: 14, borderRadius: 14, background: '#D1FAE5', color: '#065F46', fontSize: '0.84rem', fontWeight: 600 }}>
              ✓ Your organization is verified! All your public-service drives carry the Verified Organizer seal.
            </div>
          ) : verStatus === 'pending' ? (
            <div style={{ padding: 14, borderRadius: 14, background: 'var(--accent-gold-soft)', color: '#111827', fontSize: '0.84rem', fontWeight: 600 }}>
              ⏳ Verification document submitted and currently under review.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
              <div>
                <label className="form-label">Organization Type</label>
                <select className="select-field" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
                  <option value="ngo">NGO / Community Foundation</option>
                  <option value="organizer">Campus / Civic Organizer</option>
                  <option value="hospital">Hospital</option>
                  <option value="blood_bank">Blood Bank</option>
                  <option value="restaurant">Restaurant / Community Kitchen</option>
                  <option value="orphanage">Orphanage / Shelter</option>
                </select>
              </div>
              <label className="pill-btn pill-btn-dark" style={{ cursor: 'pointer', width: '100%' }}>
                <Upload size={15} />
                <span>{uploadingDoc ? 'Uploading Document...' : 'Upload Verification Document (PDF/JPG/PNG)'}</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={handleUploadVerification}
                  disabled={uploadingDoc}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Hosted Events Grid */}
      <section className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>My Hosted Events ({myEvents.length})</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Click Roster to inspect registered volunteers or open the public listing
            </p>
          </div>
          <Link to="/post-event" className="pill-btn" style={{ fontSize: '0.82rem' }}>
            <PlusCircle size={14} /> Create Drive
          </Link>
        </div>

        {myEvents.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', borderRadius: 16, background: 'var(--bg-surface-muted)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 12px' }}>
              You haven&apos;t hosted any events yet. Launch your first community drive to start earning Community Star Tiers!
            </p>
            <Link to="/post-event" className="pill-btn pill-btn-coral">
              <PlusCircle size={15} /> Host Your First Event
            </Link>
          </div>
        ) : (
          <div className="grid-responsive-2">
            {myEvents.map((ev) => {
              const cat = getCategoryInfo(ev.category);
              const joined = Number(ev.volunteersJoined) || 0;
              const needed = Number(ev.volunteersNeeded) || 1;
              const pct = Math.min(100, Math.round((joined / needed) * 100));
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    background: 'var(--bg-surface-muted)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span className="badge-pill" style={{ background: cat.pastelBg, color: '#111827' }}>
                      {cat.emoji} {cat.label}
                    </span>
                    <span
                      className="badge-pill"
                      style={{
                        background: ev.status === 'approved' ? '#D1FAE5' : 'var(--bg-surface)',
                        color: ev.status === 'approved' ? '#065F46' : 'var(--text-secondary)',
                        fontSize: '0.72rem'
                      }}
                    >
                      {String(ev.status || 'approved').toUpperCase()}
                    </span>
                  </div>

                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{ev.title}</h3>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} /> {formatDateShort(ev.date)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} /> {ev.city}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>
                      <span>{joined} volunteers joined</span>
                      <span style={{ color: 'var(--text-muted)' }}>Goal: {needed}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: cat.color, borderRadius: 99 }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                    <button type="button" onClick={() => loadVolunteers(ev.id)} className="pill-btn pill-btn-dark" style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}>
                      <Users size={14} /> Roster
                    </button>
                    <Link to={`/event/${ev.id}`} className="pill-btn" style={{ padding: '8px 12px', fontSize: '0.8rem' }} aria-label="View public event">
                      <ExternalLink size={14} />
                    </Link>
                    <button type="button" onClick={() => handleDelete(ev.id)} className="pill-btn" style={{ color: '#EF4444', padding: '8px 12px' }} aria-label="Delete event">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Volunteer Roster */}
      {selectedEventId && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px' }}>Volunteer Roster (Event #{selectedEventId})</h3>
          {volunteers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0 }}>No volunteer applications recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {volunteers.map((v, i) => (
                <div
                  key={v.id || i}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: 'var(--bg-surface-muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span><strong>{v.name || 'Volunteer'}</strong> · {v.role || 'On-site'}</span>
                  <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.74rem' }}>
                    {v.status || 'joined'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
