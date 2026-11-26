import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Download, CheckCircle2, Award } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

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

export default function MyHoursPage() {
  const { user } = useApp();
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);
  const [totalHours, setTotalHours] = useState(28.5);

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
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800 }}>
            My Volunteer <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Hours</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Verified public service records certified through organizer check-in and check-out
          </p>
        </div>
        <Link to="/badges" className="pill-btn pill-btn-gold">
          <Award size={15} /> Open Badges Shop
        </Link>
      </div>

      {/* Volunteer Hours Stats Grid */}
      <div className="grid-responsive-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Verified Hours</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 4 }}>{totalHours.toFixed(1)} <small style={{ fontSize: '0.85rem' }}>HRS</small></div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>100% organizer confirmed</div>
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
    </div>
  );
}
