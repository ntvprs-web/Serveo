import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, ShoppingBag, Clock, Sparkles, CheckCircle2, Eye, EyeOff, ShieldCheck, Phone, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';
import { CATEGORIES, BADGE_OVERVIEW_BENEFITS, getBadgeDetails, ORGANIZER_STAR_TIERS } from '../utils/constants';

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export default function BadgesShopPage() {
  const { user, ownedBadges, equippedBadges, buyBadge, toggleEquipBadge, addToast } = useApp();
  const navigate = useNavigate();

  const [checkoutBadge, setCheckoutBadge] = useState(null); // { key, label, price }
  const [buyerName, setBuyerName] = useState(user?.name || '');
  const [organizationName, setOrganizationName] = useState(user?.name || '');
  const [buyerEmail, setBuyerEmail] = useState(user?.email || '');
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentReference, setPaymentReference] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const emailInvalid = buyerEmail.trim().length > 0 && !EMAIL_RE.test(buyerEmail.trim());

  const openCheckout = (cat, price) => {
    if (!user) {
      addToast('Please sign in first to purchase and verify an Organizer Badge.');
      navigate('/login');
      return;
    }
    setBuyerName(user.name || '');
    setOrganizationName(user.name || '');
    setBuyerEmail(user.email || '');
    setBuyerPhone(user.phone || '');
    setPaymentReference('');
    setOtpCode('');
    setOtpSent(false);
    setCheckoutBadge({ key: cat.key, label: cat.label, price, emoji: cat.emoji });
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await apiFetch('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: buyerPhone })
      });
      setOtpSent(true);
      addToast(res.message || '6-digit OTP sent to your mobile.');
    } catch (err) {
      addToast(err.message || 'Enter a valid +91 Indian mobile number.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!checkoutBadge) return;
    if (!EMAIL_RE.test(buyerEmail.trim())) {
      addToast('Please enter a valid official email address.');
      return;
    }
    if (!otpSent || !otpCode.trim()) {
      addToast('Please send and enter the 6-digit mobile OTP to verify your purchase.');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await buyBadge({
        badgeKey: checkoutBadge.key,
        label: checkoutBadge.label,
        priceInr: checkoutBadge.price,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim().toLowerCase(),
        buyerPhone: buyerPhone.trim(),
        organizationName: organizationName.trim(),
        paymentMethod,
        paymentReference: paymentReference.trim(),
        otpCode: otpCode.trim()
      });
      if (ok) setCheckoutBadge(null);
    } catch (err) {
      addToast(err.message || 'Checkout verification failed. Please check your details and OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800 }}>
            Organizer Verified Badges <span className="serif-italic" style={{ fontSize: '1.75rem' }}>Shop</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            For Organizations & Event Hosts: boost event reach, unlock specialist seals, and rank higher in discovery. (Volunteer badges are 100% free in My Hours!)
          </p>
        </div>
        <Link to="/my-hours" className="pill-btn">
          <Clock size={15} /> Free Volunteer Badges
        </Link>
      </div>

      {/* Community Milestone Star Tiers (Free Automatic Organizer Tiers) */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            Free Community & Organization Milestone Stars
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Earned automatically as your community hosts more verified events
          </span>
        </div>
        <div className="h-scroll">
          {[...ORGANIZER_STAR_TIERS].reverse().map((t) => (
            <div
              key={t.id}
              className="badge-pill"
              style={{
                background: t.bg,
                color: '#111827',
                border: `1px solid ${t.color}`,
                flexShrink: 0,
                padding: '6px 12px',
                fontSize: '0.8rem'
              }}
            >
              <span>{t.emoji}</span>
              <span><strong>{t.label}</strong> · {t.minEvents}+ Events</span>
            </div>
          ))}
        </div>
      </div>

      {/* Why Get a Verified Badge? Benefits Overview */}
      <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-muted) 100%)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#F59E0B" /> Why Organizers Buy Verified Cause Badges
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge-pill" style={{ background: '#111827', color: '#FFFFFF' }}>
              <Award size={13} /> {ownedBadges.length} Owned
            </span>
            <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46' }}>
              <ShieldCheck size={13} /> {equippedBadges.length} Equipped Live
            </span>
          </div>
        </div>

        <div className="grid-responsive-2" style={{ gap: 12 }}>
          {BADGE_OVERVIEW_BENEFITS.map((b) => (
            <div
              key={b.id}
              style={{
                padding: 14,
                borderRadius: 16,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{b.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid-responsive-3">
        {Object.values(CATEGORIES).map((cat, index) => {
          const { price, perks } = getBadgeDetails(cat, index);
          const isOwned = ownedBadges.includes(cat.key);
          const isEquipped = equippedBadges.includes(cat.key);
          return (
            <div
              key={cat.key}
              className="card"
              style={{
                padding: 18,
                border: isOwned ? `2px solid ${cat.color}` : '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      background: cat.pastelBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.6rem',
                      flexShrink: 0
                    }}
                  >
                    {cat.emoji}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>{cat.label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ₹{price} · Lifetime Organizer Badge
                    </div>
                  </div>
                </div>
                {isOwned && (
                  <span
                    className="badge-pill"
                    style={{
                      background: isEquipped ? '#D1FAE5' : 'var(--bg-surface-muted)',
                      color: isEquipped ? '#065F46' : 'var(--text-muted)',
                      fontSize: '0.72rem'
                    }}
                  >
                    {isEquipped ? 'Active' : 'Hidden'}
                  </span>
                )}
              </div>

              <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>

              {isOwned ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => toggleEquipBadge(cat.key)}
                    className={`pill-btn ${isEquipped ? '' : 'pill-btn-dark'}`}
                    style={{ flex: 1 }}
                  >
                    {isEquipped ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{isEquipped ? 'Equipped (Hide)' : 'Equip on Cards'}</span>
                  </button>
                  <span className="pill-btn" style={{ background: cat.pastelBg, color: '#111827', cursor: 'default' }}>
                    <CheckCircle2 size={14} /> Owned
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openCheckout(cat, price)}
                  className="pill-btn pill-btn-dark"
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  <ShoppingBag size={14} />
                  <span>Purchase & Verify Badge (₹{price})</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Verified Badge Checkout Modal */}
      {checkoutBadge && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: 24, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{checkoutBadge.emoji}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Verify & Purchase {checkoutBadge.label} Badge</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fee: ₹{checkoutBadge.price} · Stored in your SERVEO account</div>
                </div>
              </div>
              <button type="button" onClick={() => setCheckoutBadge(null)} className="pill-btn" style={{ padding: 8 }} aria-label="Close checkout">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Authorized Signatory Name</label>
                <input required className="input-field" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Full Name" />
              </div>
              <div>
                <label className="form-label">Organization / Community Name</label>
                <input required className="input-field" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="e.g., Red Cross Society" />
              </div>
              <div>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Official Email Address</span>
                  {emailInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Invalid email format</span>}
                </label>
                <input required type="email" className="input-field" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="contact@organization.org" />
              </div>
              <div className="grid-responsive-2">
                <div>
                  <label className="form-label">Payment Method</label>
                  <select className="select-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="netbanking">NetBanking</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">UPI ID / Transaction Ref</label>
                  <input required className="input-field" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="org@okaxis / TXN998" />
                </div>
              </div>
              <div>
                <label className="form-label">Indian Mobile Number (+91)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input required type="tel" className="input-field" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="+919876543210" />
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
                <ShieldCheck size={15} /> {submitting ? 'Verifying & Saving...' : `Verify OTP & Complete Purchase (₹${checkoutBadge.price})`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
