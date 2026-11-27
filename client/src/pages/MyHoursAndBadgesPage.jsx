import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Clock, Download, ShoppingBag, CheckCircle2, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';
import { CATEGORIES, getBadgeDetails, VOLUNTEER_FREE_BADGES } from '../utils/constants';
import BadgeMedallion from '../components/BadgeMedallion';
import OrganizerBadgeCard from '../components/OrganizerBadgeCard';

const DEFAULT_SESSIONS = [
  {
    id: 'SRV-REC-101',
    title: 'National Emergency Blood Donation Drive',
    category: 'Blood Healthcare',
    organization: 'Indian Red Cross Society',
    city: 'New Delhi',
    date: '2026-11-12',
    checkIn: '08:30 AM',
    checkOut: '03:30 PM',
    hours: 7.0,
    organizerStatus: 'Verified by Red Cross Blood Center'
  },
  {
    id: 'SRV-REC-102',
    title: 'Central Community Surplus Food Rescue & Distribution',
    category: 'Food Relief',
    organization: 'Robin Hood Army Chapter',
    city: 'New Delhi',
    date: '2026-11-05',
    checkIn: '04:00 PM',
    checkOut: '10:00 PM',
    hours: 6.0,
    organizerStatus: 'Verified by Robin Hood Army Dispatch'
  },
  {
    id: 'SRV-REC-103',
    title: 'Disaster Emergency Aid & Essential Relief Logistics',
    category: 'Disaster Response',
    organization: 'Goonj Foundation Relief Cell',
    city: 'Gurugram',
    date: '2026-10-24',
    checkIn: '09:00 AM',
    checkOut: '05:30 PM',
    hours: 8.5,
    organizerStatus: 'Verified by Goonj Disaster Cell'
  },
  {
    id: 'SRV-REC-104',
    title: 'Community Urban Afforestation & Green Shield Drive',
    category: 'Environment',
    organization: 'SayTrees Environmental Trust',
    city: 'Noida',
    date: '2026-10-10',
    checkIn: '07:00 AM',
    checkOut: '02:00 PM',
    hours: 7.0,
    organizerStatus: 'Verified by SayTrees Field Lead'
  }
];

export default function MyHoursAndBadgesPage({ mode = 'hours' }) {
  const { user, ownedBadges, equippedBadges, toggleEquipBadge } = useApp();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);
  const [totalHours, setTotalHours] = useState(28.5);
  const [bloodDonationsCount, setBloodDonationsCount] = useState(0);
  const effectiveHours = ownedBadges.length > 0 ? totalHours * 1.25 : totalHours;

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/volunteers/hours/mine')
      .then((d) => {
        if (d && Array.isArray(d.sessions) && d.sessions.length > 0) {
          setSessions(d.sessions);
          setTotalHours(Number(d.totalHours || d.displayTotalHours || 0));
        }
      })
      .catch(() => {});
    apiFetch('/api/donors/donations/mine')
      .then((d) => {
        const list = Array.isArray(d) ? d : (d?.donations || []);
        setBloodDonationsCount(list.length);
      })
      .catch(() => {});
  }, [user]);

  const unlockedFreeBadges = VOLUNTEER_FREE_BADGES.map((badge) => {
    const categoriesText = sessions.map((s) => `${s.category || ''} ${s.title || ''}`).join(' ').toLowerCase();
    let earned = false;
    if (badge.id === 'blood-lifesaver') earned = bloodDonationsCount > 0 || Boolean(user?.bloodGroup) || categoriesText.includes('blood');
    else if (badge.id === 'first-responder') earned = sessions.length >= 1;
    else if (badge.id === 'hunger-hero') earned = categoriesText.includes('food');
    else if (badge.id === 'disaster-shield') earned = categoriesText.includes('disaster');
    else if (badge.id === 'green-guardian') earned = categoriesText.includes('environment') || categoriesText.includes('animal') || categoriesText.includes('afforestation');
    else if (badge.id === 'hours-champion-25') earned = totalHours >= 25;
    return { ...badge, earned };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800 }}>
          {mode === 'badges' ? (
            <>Verified Badges <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Shop</span></>
          ) : (
            <>My Volunteer <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Hours</span></>
          )}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          {mode === 'badges'
            ? 'Purchase animated category badges for event cards and organizer highlights (demo checkout)'
            : 'Verified public service records certified through organizer check-in and check-out'}
        </p>
      </div>

      {/* Volunteer Hours Stats Grid (from frontend/my-hours.html) */}
      <div className="grid-responsive-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Verified Hours</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 4 }}>{effectiveHours.toFixed(1)} <small style={{ fontSize: '0.85rem' }}>HRS</small></div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
            {ownedBadges.length > 0 ? '100% confirmed · +25% Badge Standing Bonus' : '100% organizer confirmed'}
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Events Completed</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 4 }}>{sessions.length} <small style={{ fontSize: '0.85rem' }}>DRIVES</small></div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Across major Indian cities</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Civic Standing</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 4, color: '#F59E0B' }}>Gold <small style={{ fontSize: '0.85rem' }}>TIER</small></div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top 5% active volunteers</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Community Impact</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 4, color: '#8B5CF6' }}>350+ <small style={{ fontSize: '0.85rem' }}>LIVES</small></div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Beneficiaries assisted</div>
        </div>
      </div>

      {/* PDF Download Banner */}
      <div className="card" style={{ padding: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-gold)', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Official Volunteer Service Transcript & Hours Record</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Authenticated record with digital verification ID and organizer stamps.
            </div>
          </div>
        </div>
        {user ? (
          <a href="/api/volunteer-hours/certificate.pdf" target="_blank" rel="noreferrer" className="pill-btn pill-btn-dark">
            <Download size={15} /> Download Hours Record PDF
          </a>
        ) : (
          <Link to="/login" className="pill-btn pill-btn-dark">Sign In to Download PDF</Link>
        )}
      </div>

      {/* Attendance History */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 14px' }}>Attendance History & Verified Sessions ({sessions.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map((row) => (
            <div
              key={row.id}
              style={{
                padding: 16,
                borderRadius: 18,
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{row.title}</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge-pill" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>{row.category}</span>
                    <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46' }}>
                      <CheckCircle2 size={12} /> {row.organization}
                    </span>
                  </div>
                </div>
                <span className="badge-pill" style={{ background: 'var(--accent-gold)', color: '#111827', fontSize: '0.85rem' }}>
                  +{Number(row.hours).toFixed(1)} hrs
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: '0.8rem', color: 'var(--text-secondary)', paddingTop: 4 }}>
                <span><strong>Date:</strong> {row.date} · {row.city}</span>
                <span><strong>Logged:</strong> {row.checkIn} → {row.checkOut}</span>
                <span style={{ color: '#10B981', fontWeight: 600 }}>✓ {row.organizerStatus}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Free Volunteer Achievement Badges (earned automatically, never purchased) */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="#10B981" /> Free Volunteer Achievement Badges
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              100% free — earned automatically by saving lives in urgent blood requests, rescuing food, and completing volunteer hours.
            </p>
          </div>
          <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46' }}>
            <Award size={13} /> {unlockedFreeBadges.filter((b) => b.earned).length}/{unlockedFreeBadges.length} Unlocked
          </span>
        </div>

        <div className="grid-responsive-3">
          {unlockedFreeBadges.map((b) => (
            <div
              key={b.id}
              className="badge-shop-card"
              style={{
                padding: 16,
                borderRadius: 20,
                background: b.earned
                  ? `linear-gradient(135deg, ${b.color}18 0%, var(--bg-surface) 70%)`
                  : 'var(--bg-surface-muted)',
                border: b.earned ? `2px solid ${b.color}` : '1px dashed var(--border-strong)',
                opacity: b.earned ? 1 : 0.78,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <BadgeMedallion
                    badgeKey={b.id}
                    color={b.color}
                    pastelBg={b.bg}
                    size={54}
                    locked={!b.earned}
                    verified={b.earned}
                    animated={b.earned}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>{b.title}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{b.subtitle}</div>
                  </div>
                </div>
                <span
                  className="badge-pill"
                  style={{
                    background: b.earned ? '#D1FAE5' : 'var(--bg-surface)',
                    color: b.earned ? '#065F46' : 'var(--text-muted)',
                    fontSize: '0.7rem',
                    flexShrink: 0
                  }}
                >
                  {b.earned ? '✓ Earned (Free)' : 'Locked'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.79rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {b.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {mode === 'badges' && (
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={20} color="#F97352" /> Organizer Reach & Category Badges
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              For organizers & NGOs hosting events: boost reach on Discover & Event Cards ({user ? user.name : 'Guest'}).
            </p>
          </div>
          <span className="badge-pill" style={{ background: 'var(--accent-gold-soft)', color: '#111827' }}>
            <Award size={13} /> {ownedBadges.length} Owned
          </span>
        </div>

        <div className="grid-responsive-3">
          {Object.values(CATEGORIES).map((cat, index) => {
            const details = getBadgeDetails(cat, index);
            const isOwned = ownedBadges.includes(cat.key);
            const isEquipped = equippedBadges.includes(cat.key);
            return (
              <OrganizerBadgeCard
                key={cat.key}
                cat={cat}
                details={details}
                isOwned={isOwned}
                isEquipped={isEquipped}
                onToggleEquip={toggleEquipBadge}
                onPurchase={() => navigate('/badges')}
                compactActionLabel={`Unlock Seal · ₹${details.price}`}
              />
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
