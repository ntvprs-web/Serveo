import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, CheckCircle2, ShieldCheck, MapPin, BellRing, Sparkles, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export default function PremiumPage() {
  const { user, isPremium, activatePremium, addToast } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [organizationName, setOrganizationName] = useState('');
  const [plan, setPlan] = useState('monthly');
  const [paymentReference, setPaymentReference] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const emailInvalid = email.trim().length > 0 && !EMAIL_RE.test(email.trim());

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await apiFetch('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone })
      });
      setOtpSent(true);
      addToast(res.message || '6-digit OTP sent to your mobile.');
    } catch (err) {
      addToast(err.message || 'Enter a valid +91 Indian mobile number.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      addToast('Please provide a valid email address.');
      return;
    }
    if (!otpSent || !otpCode.trim()) {
      addToast('Please send and enter the 6-digit mobile OTP to authenticate.');
      return;
    }
    setSubmitting(true);
    try {
      await activatePremium({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        otpCode: otpCode.trim(),
        organizationName: organizationName.trim(),
        plan,
        paymentReference: paymentReference.trim()
      });
    } catch (err) {
      addToast(err.message || 'Could not activate Premium. Please verify your details and OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <span className="badge-pill" style={{ background: 'var(--accent-gold-soft)', color: '#111827', marginBottom: 8 }}>
          <Crown size={13} /> SERVEO Premium · Extended Range & Verification
        </span>
        <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800 }}>
          Find & Host Help Across <span className="serif-italic" style={{ fontSize: '1.85rem' }}>Every Distance</span>
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Standard discovery covers up to 5 km. Premium unlocks 25 km, 50 km, 100 km, and any-distance discovery plus priority verified perks.
        </p>
      </div>

      <div className="grid-responsive-2" style={{ alignItems: 'start' }}>
        {/* Benefits Card */}
        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Included in SERVEO Premium</h2>
          {[
            { icon: MapPin, title: 'Extended 25 km – 100 km & Any-Distance Search', desc: 'Unlock 5 km, 10 km, 25 km, 50 km, 100 km, and nationwide map radius filters.' },
            { icon: BellRing, title: '25 km Emergency & Urgent Blood Alerts', desc: 'Receive real-time SSE proximity alerts & audio chimes across a 25 km radius.' },
            { icon: ShieldCheck, title: 'Priority Verified Status & Organizer Perks', desc: 'Fast-track verified profile standing, highlighted event cards, and certificate priority.' },
            { icon: Sparkles, title: 'Full Access to Organizer Badges Studio', desc: 'Manage and showcase verified category badges on your hosted events.' }
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--accent-gold-soft)', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{b.title}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{b.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Verified Checkout Card */}
        <div className="card" style={{ padding: 22 }}>
          {isPremium ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center', padding: '16px 0' }}>
              <CheckCircle2 size={44} color="#10B981" style={{ margin: '0 auto' }} />
              <h2 style={{ margin: 0 }}>Premium Active!</h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Your 25 km – 100 km discovery radius, extended emergency alerts, and verified perks are now active.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
                <Link to="/map" className="pill-btn pill-btn-dark">Open 25km+ Live Map</Link>
                <Link to="/badges" className="pill-btn pill-btn-gold">Organizer Badges</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem' }}>Subscribe & Verify Premium</h2>
              <div>
                <label className="form-label">Plan Tier</label>
                <select className="select-field" value={plan} onChange={(e) => setPlan(e.target.value)}>
                  <option value="monthly">Monthly Plan — ₹199 / month</option>
                  <option value="annual">Annual Plan — ₹1,499 / year (Save 37%)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Full Name</label>
                <input required className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />
              </div>
              <div>
                <label className="form-label">Organization / Community (Optional)</label>
                <input className="input-field" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="e.g., Red Cross Chapter" />
              </div>
              <div>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Email Address</span>
                  {emailInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Invalid email format</span>}
                </label>
                <input required type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aarav@domain.com" />
              </div>
              <div>
                <label className="form-label">UPI ID / Billing Reference</label>
                <input required className="input-field" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="e.g., name@okaxis or TXN123456" />
              </div>
              <div>
                <label className="form-label">Indian Mobile Number (+91)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input required type="tel" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" />
                  <button type="button" onClick={handleSendOtp} disabled={sendingOtp} className="pill-btn" style={{ flexShrink: 0 }}>
                    <Phone size={14} /> {otpSent ? 'Resend' : 'Send OTP'}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">6-Digit Mobile OTP</label>
                <input required maxLength={6} className="input-field" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter 6-digit OTP" />
              </div>
              <button type="submit" disabled={submitting || emailInvalid} className="pill-btn pill-btn-gold" style={{ width: '100%', padding: '12px', marginTop: 4 }}>
                <Sparkles size={16} /> {submitting ? 'Verifying & Saving...' : 'Verify OTP & Activate Premium'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
