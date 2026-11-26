import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Radio, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { HOSTING_PACKAGES } from '../utils/constants';
import { SERVEO_LEGAL_SECTIONS, SERVEO_TERMS_VERSION } from '../utils/legal';
import { apiFetch, getGuestId } from '../utils/api';
import { useApp } from '../context/AppContext';

const SDG_ITEMS = [
  { num: 3, color: '#4c9f38', title: 'Good Health & Well-Being', desc: 'Connects voluntary blood donors with regional blood banks and provides geolocation visibility for free healthcare screenings.' },
  { num: 11, color: '#fd9d24', title: 'Sustainable Cities & Communities', desc: 'Empowers grassroots disaster relief coordination and strengthens community resilience.' },
  { num: 16, color: '#00689d', title: 'Peace, Justice & Strong Institutions', desc: 'Eliminates donation fraud and disinformation through institutional verification and 2-strike false-alarm protection.' },
  { num: 17, color: '#19486a', title: 'Partnerships for the Goals', desc: 'Establishes a shared digital medium where NGOs, hospitals, campuses, and citizens collaborate.' }
];

const TEAM = [
  { name: 'Nishant Swami', role: 'Lead Developer · Research & Outreach', emoji: '👨‍💻' },
  { name: 'Nivesh Tyagi', role: 'Full Stack Developer · Research & Outreach', emoji: '🚀' },
  { name: 'Piyush Chaudhary', role: 'UI/UX Designer · Research & Outreach', emoji: '🎨' }
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
      {/* Mission (from frontend/about.html) */}
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
              <Icon size={24} color="#F97352" style={{ marginBottom: 10 }} />
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
        <div className="grid-responsive-3">
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
        </div>
      </div>

      {/* Team (from frontend/about.html) */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>The Team</h2>
        <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Built by CSE (AI) students at ABES Institute of Technology, Ghaziabad.
        </p>
        <div className="grid-responsive-3">
          {TEAM.map((m) => (
            <div key={m.name} style={{ padding: 16, borderRadius: 18, background: 'var(--bg-surface-muted)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 6 }}>{m.emoji}</div>
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
          Have a question about hosting an event, NGO verification, partnerships, or support? Send us an inquiry.
        </p>
        {submitted ? (
          <div style={{ padding: 18, borderRadius: 16, background: 'var(--bg-surface-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={24} color="#10B981" />
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
                <label className="form-label">Full Name</label>
                <input required className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="form-label">Email Address</label>
                <input required type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div className="grid-responsive-2">
              <div>
                <label className="form-label">Phone Number (optional)</label>
                <input type="tel" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="form-label">Inquiry Topic</label>
                <select className="input-field" value={topic} onChange={(e) => setTopic(e.target.value)}>
                  <option value="general">General Inquiry</option>
                  <option value="hosting">Event Hosting &amp; Packages</option>
                  <option value="verification">Organizer / NGO Verification</option>
                  <option value="partnership">Partnership / Blood Bank</option>
                  <option value="support">Technical Support</option>
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Message</label>
              <textarea required rows={3} className="input-field" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us how we can help..." />
            </div>
            <button type="submit" disabled={submitting} className="pill-btn pill-btn-dark" style={{ alignSelf: 'flex-start' }}>
              <Send size={15} /> {submitting ? 'Sending...' : 'Submit Inquiry'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function LegalPage({ type = 'terms' }) {
  const sections = type === 'privacy' ? SERVEO_LEGAL_SECTIONS.privacy : SERVEO_LEGAL_SECTIONS.terms;
  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div className="card" style={{ padding: 26 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 800 }}>
          {type === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}
        </h1>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 18 }}>
          Version {SERVEO_TERMS_VERSION}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sections.map(([title, body]) => (
            <div key={title}>
              <h3 style={{ margin: '0 0 4px', fontSize: '0.96rem' }}>{title}</h3>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
