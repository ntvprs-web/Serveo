import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Radio, MapPin, Send, CheckCircle2, Trash2, MailX, Cookie, Scale, Building2 } from 'lucide-react';
import { HOSTING_PACKAGES } from '../utils/constants';
import {
  SERVEO_ASSET_LICENSES,
  SERVEO_BUSINESS_DETAILS,
  SERVEO_COOKIE_INVENTORY,
  SERVEO_LEGAL_SECTIONS,
  SERVEO_TERMS_VERSION,
  SERVEO_THIRD_PARTY_SDKS
} from '../utils/legal';
import { apiFetch, getGuestId } from '../utils/api';
import { useApp } from '../context/AppContext';

const SDG_ITEMS = [
  { num: 3, color: '#4c9f38', title: 'Good Health & Well-Being', desc: 'Connects voluntary blood donors with regional blood banks and provides geolocation visibility for free healthcare screenings.' },
  { num: 11, color: '#fd9d24', title: 'Sustainable Cities & Communities', desc: 'Empowers grassroots disaster relief coordination and strengthens community resilience.' },
  { num: 16, color: '#00689d', title: 'Peace, Justice & Strong Institutions', desc: 'Eliminates donation fraud and disinformation through institutional verification and 2-strike false-alarm protection.' },
  { num: 17, color: '#19486a', title: 'Partnerships for the Goals', desc: 'Establishes a shared digital medium where NGOs, hospitals, campuses, and citizens collaborate.' }
];

const TEAM = [
  { name: 'Nivesh Kumar Tyagi', role: 'Team Lead · Full Stack Architect', emoji: '🚀' },
  { name: 'Nishant Swami', role: 'Lead Backend & Systems Developer', emoji: '👨‍💻' },
  { name: 'Piyush Chaudhary', role: 'UI/UX & Product Designer', emoji: '🎨' },
  { name: 'Nandani Chauhan', role: 'Marketing, Communications & Community Outreach', emoji: '📣' }
];

export function AboutPage() {
  const { user, addToast } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [topic, setTopic] = useState('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          topic,
          message: message.trim(),
          guestId: getGuestId()
        })
      });
      setSubmitted(true);
      setMessage('');
      addToast('Thank you! Your inquiry has been saved.');
    } catch (err) {
      addToast(err.message || 'Failed to submit inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Mission */}
      <div className="card" style={{ padding: 26 }}>
        <h1 style={{ margin: '0 0 10px', fontSize: '1.7rem', fontWeight: 800 }}>
          About <span className="serif-italic" style={{ fontSize: '1.9rem' }}>SERVEO</span>
        </h1>
        <p style={{ margin: '0 0 12px', fontSize: '0.96rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          SERVEO is a crowdsourced, location-based platform designed to centralize and map nearby public-service and
          community welfare initiatives in real time — bridging the gap between willing citizens and the grassroots
          initiatives that need participation.
        </p>
        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--text-muted)' }}>
          Every day, thousands of public welfare initiatives suffer from diminished turnout due to fragmented WhatsApp
          groups and paper posters. SERVEO solves this <strong>visibility crisis</strong> by combining interactive map
          discovery, 0–5 km (and 25 km+ Premium) alerts, verified organizer portals, and destination hosting services.
        </p>
      </div>

      {/* Core Tech Highlights */}
      <div className="grid-responsive-3">
        {[
          { icon: MapPin, title: '0–5 km & 25 km+ Proximity', desc: 'Haversine geospatial matching & turn-by-turn Google Maps directions.' },
          { icon: Radio, title: 'Real-Time SSE Stream', desc: 'Live volunteer counts and emergency alerts pushed instantly over HTTP.' },
          { icon: ShieldCheck, title: '2-Strike Trust Engine', desc: 'Automated false-alarm protection & organizer verification.' }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="card" style={{ padding: 20 }}>
              <Icon size={24} color="#F97352" aria-hidden="true" style={{ marginBottom: 10 }} />
              <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>{item.title}</h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>{item.desc}</p>
            </div>
          );
        })}
      </div>

      {/* UN SDG Alignment */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '1.25rem' }}>UN Sustainable Development Goals</h2>
        <div className="grid-responsive-2">
          {SDG_ITEMS.map((sdg) => (
            <div key={sdg.num} style={{ padding: 16, borderRadius: 18, background: 'var(--bg-surface-muted)', display: 'flex', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: sdg.color, color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sdg.num}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.94rem', marginBottom: 4 }}>{sdg.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{sdg.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hosting Services */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '1.25rem' }}>Hosting Services for Event Organizers</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {HOSTING_PACKAGES.map((pkg) => (
            <div key={pkg.id} style={{ padding: 16, borderRadius: 18, background: 'var(--bg-surface-muted)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{pkg.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>{pkg.price}</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.8rem', lineHeight: 1.6 }}>
                {pkg.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link to="/post-event" className="pill-btn pill-btn-coral">Host an Event</Link>
          <Link to="/premium" className="pill-btn pill-btn-gold">Explore Premium (25 km+)</Link>
          <Link to="/terms" className="pill-btn">Terms of Use</Link>
          <Link to="/privacy" className="pill-btn">Privacy Policy</Link>
          <Link to="/refund-policy" className="pill-btn">Refund Policy</Link>
          <Link to="/cookies" className="pill-btn">Cookie Policy</Link>
          <Link to="/licenses" className="pill-btn">Fonts &amp; Image Licenses</Link>
        </div>
      </div>

      {/* Business & Operator Details */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={18} color="#F97352" aria-hidden="true" /> Operator &amp; Business Details
        </h2>
        <div className="grid-responsive-2" style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div>
            <div><strong>Organization / Initiative:</strong> {SERVEO_BUSINESS_DETAILS.entityName}</div>
            <div><strong>Operator / Team Lead:</strong> {SERVEO_BUSINESS_DETAILS.operatorName}</div>
            <div><strong>Jurisdiction:</strong> {SERVEO_BUSINESS_DETAILS.jurisdiction}</div>
          </div>
          <div>
            <div><strong>Registered / Campus Address:</strong> {SERVEO_BUSINESS_DETAILS.address}</div>
            <div><strong>Support &amp; Grievance Email:</strong> <a href={`mailto:${SERVEO_BUSINESS_DETAILS.supportEmail}`} style={{ textDecoration: 'underline' }}>{SERVEO_BUSINESS_DETAILS.supportEmail}</a></div>
            <div><strong>Grievance Officer:</strong> {SERVEO_BUSINESS_DETAILS.grievanceOfficer}</div>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>The Team</h2>
        <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Built by CSE (AI) students at ABES Institute of Technology, Ghaziabad.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {TEAM.map((m) => (
            <div key={m.name} style={{ padding: 16, borderRadius: 18, background: 'var(--bg-surface-muted)', textAlign: 'center' }}>
              <div aria-hidden="true" style={{ fontSize: '2rem', marginBottom: 6 }}>{m.emoji}</div>
              <div style={{ fontWeight: 700 }}>{m.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact & Inquiries Form */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>Contact &amp; Inquiries</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Have a question about hosting an event, refunds, NGO verification, partnerships, or support? Send us an inquiry.
        </p>
        {submitted ? (
          <div style={{ padding: 18, borderRadius: 16, background: 'var(--bg-surface-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={24} color="#10B981" aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Inquiry Received</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Your message has been saved to our database.</div>
            </div>
            <button type="button" className="pill-btn" onClick={() => setSubmitted(false)}>Send Another</button>
          </div>
        ) : (
          <form onSubmit={handleInquirySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-responsive-2">
              <div>
                <label htmlFor="inq-name" className="form-label">Full Name</label>
                <input id="inq-name" required className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label htmlFor="inq-email" className="form-label">Email Address</label>
                <input id="inq-email" required type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div className="grid-responsive-2">
              <div>
                <label htmlFor="inq-phone" className="form-label">Phone Number (optional)</label>
                <input id="inq-phone" type="tel" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label htmlFor="inq-topic" className="form-label">Inquiry Topic</label>
                <select id="inq-topic" className="input-field" value={topic} onChange={(e) => setTopic(e.target.value)}>
                  <option value="general">General Inquiry</option>
                  <option value="hosting">Event Hosting &amp; Packages</option>
                  <option value="verification">Organizer / NGO Verification</option>
                  <option value="partnership">Partnership / Blood Bank</option>
                  <option value="support">Technical / Refund Support</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="inq-message" className="form-label">Message</label>
              <textarea id="inq-message" required rows={3} className="input-field" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us how we can help..." />
            </div>
            <button type="submit" disabled={submitting} className="pill-btn pill-btn-dark" style={{ alignSelf: 'flex-start' }}>
              <Send size={15} aria-hidden="true" /> {submitting ? 'Sending...' : 'Submit Inquiry'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const LEGAL_META = {
  terms: { title: 'Terms of Use', subtitle: 'Governing volunteer participation, organizer verification, age consent & safety rules' },
  privacy: { title: 'Privacy Policy & Data Protection', subtitle: 'DPDP Act (2023) compliance, data minimization, third-party SDK audit & data erasure' },
  refund: { title: 'Refund & Cancellation Policy', subtitle: 'Organizer Verified Badges, SERVEO Premium plans, and direct NGO donations' },
  cookies: { title: 'Cookie & Local Storage Policy', subtitle: 'First-party session cookies, functional browser storage & consent controls' },
  licenses: { title: 'Fonts, Images & Open-Source Licenses', subtitle: 'Attributions and license notices for typography, photography, icons, and packages' }
};

export function LegalPage({ type = 'terms' }) {
  const { user, setUser, setCookieBannerOpen, addToast } = useApp();
  const navigate = useNavigate();

  const [legalContact, setLegalContact] = useState(SERVEO_BUSINESS_DETAILS);
  const [delEmail, setDelEmail] = useState(user?.email || '');
  const [delReason, setDelReason] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delReceipt, setDelReceipt] = useState(null);

  useEffect(() => {
    apiFetch('/api/legal/contact')
      .then((d) => {
        if (d && (d.businessName || d.supportEmail)) {
          setLegalContact((prev) => ({ ...prev, ...d }));
        }
      })
      .catch(() => {});
  }, []);

  const meta = LEGAL_META[type] || LEGAL_META.terms;
  const sections = SERVEO_LEGAL_SECTIONS[type] || [];

  const handleDataDeletion = async (e) => {
    e.preventDefault();
    setDelBusy(true);
    try {
      const res = await apiFetch('/api/privacy/data-deletion-request', {
        method: 'POST',
        body: JSON.stringify(
          user
            ? { confirm: delConfirm, reason: delReason }
            : { email: delEmail.trim().toLowerCase(), reason: delReason }
        )
      });
      setDelReceipt(res);
      addToast(res.message || 'Data deletion request processed.');
      if (user) {
        localStorage.removeItem('serveo_location');
        localStorage.removeItem('serveo_saved_events');
        localStorage.removeItem('serveo_premium_status');
        localStorage.removeItem('serveo_premium_customer');
        setUser(null);
        setTimeout(() => navigate('/'), 1800);
      }
    } catch (err) {
      addToast(err.message || 'Could not process data deletion request.');
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Navigation Pills between Legal Docs */}
      <nav aria-label="Legal and compliance pages" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[
          { to: '/privacy', key: 'privacy', label: 'Privacy Policy' },
          { to: '/terms', key: 'terms', label: 'Terms of Service' },
          { to: '/refund-policy', key: 'refund', label: 'Refund Policy' },
          { to: '/cookies', key: 'cookies', label: 'Cookie Policy' },
          { to: '/licenses', key: 'licenses', label: 'Fonts & Licenses' }
        ].map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={`pill-btn ${type === item.key ? 'pill-btn-dark' : ''}`}
            style={{ padding: '7px 14px', fontSize: '0.8rem' }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="card" style={{ padding: 26 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.55rem', fontWeight: 800 }}>
          {meta.title}
        </h1>
        <p style={{ margin: '0 0 8px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
          {meta.subtitle}
        </p>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Version {SERVEO_TERMS_VERSION} · Operator: {legalContact.businessName || SERVEO_BUSINESS_DETAILS.entityName}
        </div>

        {/* Business & Grievance Details Strip */}
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: 'var(--bg-surface-muted)',
            marginBottom: 20,
            fontSize: '0.82rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)'
          }}
        >
          <strong>{legalContact.businessName || SERVEO_BUSINESS_DETAILS.entityName}</strong> · Operated by{' '}
          {legalContact.operatorName || SERVEO_BUSINESS_DETAILS.operatorName}
          <br />
          Address: {legalContact.address || SERVEO_BUSINESS_DETAILS.address}
          <br />
          Support &amp; Privacy Email:{' '}
          <a href={`mailto:${legalContact.privacyEmail || SERVEO_BUSINESS_DETAILS.privacyEmail}`} style={{ textDecoration: 'underline', fontWeight: 600 }}>
            {legalContact.privacyEmail || SERVEO_BUSINESS_DETAILS.privacyEmail}
          </a>
        </div>

        {sections.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sections.map(([title, body]) => (
              <section key={title}>
                <h2 style={{ margin: '0 0 5px', fontSize: '1rem', fontWeight: 700 }}>{title}</h2>
                <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>{body}</p>
              </section>
            ))}
          </div>
        )}

        {/* Cookie Inventory Table + Manage Button */}
        {type === 'cookies' && (
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Cookie &amp; Browser Storage Inventory</h2>
              <button
                type="button"
                onClick={() => setCookieBannerOpen(true)}
                className="pill-btn pill-btn-gold"
                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              >
                <Cookie size={14} aria-hidden="true" /> Update Cookie Preferences
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-strong)' }}>
                    <th style={{ padding: '8px 10px' }}>Name</th>
                    <th style={{ padding: '8px 10px' }}>Type</th>
                    <th style={{ padding: '8px 10px' }}>Category</th>
                    <th style={{ padding: '8px 10px' }}>Duration</th>
                    <th style={{ padding: '8px 10px' }}>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {SERVEO_COOKIE_INVENTORY.map((row) => (
                    <tr key={row.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}><code>{row.name}</code></td>
                      <td style={{ padding: '8px 10px' }}>{row.type}</td>
                      <td style={{ padding: '8px 10px' }}>{row.category}</td>
                      <td style={{ padding: '8px 10px' }}>{row.duration}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fonts, Images & Open Source Licenses */}
        {type === 'licenses' && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={17} color="#F97352" aria-hidden="true" /> Font, Image &amp; Software Licenses
            </h2>
            {SERVEO_ASSET_LICENSES.map((item) => (
              <div
                key={item.asset}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: 'var(--bg-surface-muted)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{item.asset}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                  <strong>Creator / Maintainer:</strong> {item.creator} · <strong>License:</strong> {item.license}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Source: {item.source}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Third-Party SDK Audit + Data Deletion Request on /privacy */}
        {type === 'privacy' && (
          <>
            <div style={{ marginTop: 24 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem', fontWeight: 700 }}>
                Third-Party SDK &amp; Sub-Processor Audit
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SERVEO_THIRD_PARTY_SDKS.map((sdk) => (
                  <div
                    key={sdk.name}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: 'var(--bg-surface-muted)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>
                      {sdk.name} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({sdk.category})</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <strong>Data Shared:</strong> {sdk.dataShared}
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                      <strong>Privacy Note:</strong> {sdk.privacyNote}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              id="data-deletion"
              style={{
                marginTop: 24,
                padding: 18,
                borderRadius: 18,
                background: 'var(--bg-surface-muted)',
                border: '1.5px solid #FCA5A5'
              }}
            >
              <h2 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: '#B91C1C' }}>
                <Trash2 size={17} aria-hidden="true" /> Request Account &amp; Personal Data Deletion (DPDP Act, 2023)
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {user
                  ? `Signed in as ${user.email}. Confirming below permanently deletes your SERVEO account and scrubs personal contact/location data.`
                  : 'Submit your email address below to request erasure of any personal data associated with your account or inquiries.'}
              </p>

              {delReceipt ? (
                <div style={{ padding: 12, borderRadius: 12, background: '#D1FAE5', color: '#065F46', fontSize: '0.84rem', fontWeight: 600 }}>
                  {delReceipt.message} {delReceipt.receiptId ? `(Reference: ${delReceipt.receiptId})` : ''}
                </div>
              ) : (
                <form onSubmit={handleDataDeletion} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!user && (
                    <div>
                      <label htmlFor="del-email" className="form-label">Registered Email Address</label>
                      <input
                        id="del-email"
                        required
                        type="email"
                        className="input-field"
                        placeholder="you@domain.com"
                        value={delEmail}
                        onChange={(e) => setDelEmail(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="del-reason" className="form-label">Reason (Optional)</label>
                    <input
                      id="del-reason"
                      className="input-field"
                      placeholder="e.g., No longer using account / parental erasure request"
                      value={delReason}
                      onChange={(e) => setDelReason(e.target.value)}
                    />
                  </div>
                  {user && (
                    <div>
                      <label htmlFor="del-confirm" className="form-label">Type DELETE to permanently erase your account</label>
                      <input
                        id="del-confirm"
                        required
                        className="input-field"
                        placeholder="Type DELETE"
                        value={delConfirm}
                        onChange={(e) => setDelConfirm(e.target.value)}
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={delBusy || (user && delConfirm.trim().toUpperCase() !== 'DELETE')}
                    className="pill-btn"
                    style={{ background: '#DC2626', color: '#FFFFFF', border: 'none', alignSelf: 'flex-start' }}
                  >
                    <Trash2 size={14} aria-hidden="true" />{' '}
                    {delBusy ? 'Processing...' : user ? 'Permanently Delete My Account & Data' : 'Submit Data Deletion Request'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const { user, addToast } = useApp();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState(user?.email || '');
  const [reason, setReason] = useState('Too many notifications');
  const [tokenEmail, setTokenEmail] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((d) => {
        if (d?.valid && d.email) {
          setTokenEmail(d.email);
          setEmail(d.email);
        }
      })
      .catch(() => {});
  }, [token]);

  const handleUnsubscribe = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch('/api/email/unsubscribe', {
        method: 'POST',
        body: JSON.stringify(token ? { token, reason } : { email: email.trim().toLowerCase(), reason })
      });
      setDoneMsg(res.message || 'You have been unsubscribed from non-essential SERVEO emails.');
      addToast('Email preferences updated.');
    } catch (err) {
      addToast(err.message || 'Could not process unsubscribe request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '18px auto' }}>
      <div className="card" style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--accent-coral-soft)', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MailX size={19} aria-hidden="true" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Email Preferences &amp; Unsubscribe</h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Opt out of non-essential SERVEO alert &amp; community emails
            </div>
          </div>
        </div>

        {doneMsg ? (
          <div style={{ padding: 14, borderRadius: 14, background: '#D1FAE5', color: '#065F46', fontSize: '0.86rem', fontWeight: 600 }}>
            {doneMsg}
          </div>
        ) : (
          <form onSubmit={handleUnsubscribe} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div>
              <label htmlFor="unsub-email" className="form-label">Email Address</label>
              <input
                id="unsub-email"
                required
                disabled={Boolean(tokenEmail)}
                type="email"
                className="input-field"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="unsub-reason" className="form-label">Reason (Optional)</label>
              <select id="unsub-reason" className="select-field" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="Too many notifications">Too many notifications</option>
                <option value="No longer volunteering">No longer volunteering</option>
                <option value="Privacy preference">Privacy preference</option>
              </select>
            </div>
            <button type="submit" disabled={busy} className="pill-btn pill-btn-dark">
              <MailX size={15} aria-hidden="true" /> {busy ? 'Updating...' : 'Unsubscribe from Non-Essential Emails'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
