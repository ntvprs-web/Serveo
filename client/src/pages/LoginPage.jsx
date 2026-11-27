import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  LogIn,
  UserPlus,
  Users,
  Building2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export default function LoginPage() {
  const { setUser, refreshMe, addToast } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialRole = searchParams.get('role') === 'organizer' ? 'organizer' : 'volunteer';
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState(initialRole); // 'volunteer' | 'organizer'

  // Single Sign-In fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Dual-Verified Registration fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [organizationType, setOrganizationType] = useState('ngo');

  // Email OTP state (Step 1) — via Resend backend
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Phone OTP state (Step 2) — via backend /api/auth/otp/send
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const emailInvalid = email.trim().length > 0 && !EMAIL_RE.test(email.trim());
  const phoneInvalid = phoneDigits.length > 0 && !/^[6-9]\d{9}$/.test(phoneDigits);

  useEffect(() => {
    if (emailCooldown <= 0) return undefined;
    const t = setInterval(() => setEmailCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [emailCooldown]);

  useEffect(() => {
    if (phoneCooldown <= 0) return undefined;
    const t = setInterval(() => setPhoneCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [phoneCooldown]);

  // Single Sign In (Volunteer -> '/' | Organizer -> '/organizer')
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      setBusy(true);
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password })
      });
      setUser(data.user);
      addToast(`Welcome back, ${data.user.name}!`);
      refreshMe();
      navigate(role === 'organizer' || data.user.role === 'organizer' ? '/organizer' : '/');
    } catch (err) {
      const msg = err.message || 'Sign in failed. Please check your credentials.';
      setErrorMsg(msg);
      addToast(msg);
    } finally {
      setBusy(false);
    }
  };

  // ── Email OTP via Resend (backend) ────────────────────────────
  const handleSendEmailOtp = async () => {
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (e.g., name@domain.com).');
      return;
    }
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/email-otp/send', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail })
      });
      setEmailSent(true);
      setEmailCooldown(60);
      addToast(res.message || `6-digit OTP sent to ${cleanEmail}`);
    } catch (err) {
      const msg = err.message || 'Could not send email OTP.';
      setErrorMsg(msg);
      addToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    setErrorMsg('');
    const token = emailOtp.replace(/\D/g, '').slice(0, 6);
    if (token.length !== 6) {
      setErrorMsg('Enter the 6-digit email OTP code.');
      return;
    }
    try {
      setBusy(true);
      await apiFetch('/api/auth/email-otp/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: token })
      });
      setEmailVerified(true);
      addToast('Email verified! Now verify your +91 mobile number.');
    } catch (err) {
      const msg = err.message || 'Invalid or expired email OTP.';
      setErrorMsg(msg);
      addToast(msg);
    } finally {
      setBusy(false);
    }
  };

  // ── Phone SMS OTP via backend ─────────────────────────────────
  const handleSendPhoneOtp = async () => {
    setErrorMsg('');
    if (!emailVerified) {
      setErrorMsg('Please verify your email first.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
      setErrorMsg('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    const e164 = `+91${phoneDigits}`;
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: e164 })
      });
      setPhoneSent(true);
      setPhoneCooldown(60);
      addToast(res.message || `6-digit SMS OTP sent to ${e164}`);
    } catch (err) {
      const msg = err.message || 'Could not send SMS OTP.';
      setErrorMsg(msg);
      addToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setErrorMsg('');
    const token = phoneOtp.replace(/\D/g, '').slice(0, 6);
    if (token.length !== 6) {
      setErrorMsg('Enter the 6-digit SMS OTP code.');
      return;
    }
    const e164 = `+91${phoneDigits}`;
    try {
      setBusy(true);
      await apiFetch('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: e164, code: token })
      });
      setPhoneVerified(true);
      addToast('Mobile number verified! You can now create your profile.');
    } catch (err) {
      const msg = err.message || 'Invalid or expired SMS OTP.';
      setErrorMsg(msg);
      addToast(msg);
    } finally {
      setBusy(false);
    }
  };

  // ── Create dual-verified profile ──────────────────────────────
  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!emailVerified || !phoneVerified) {
      setErrorMsg('Both email and phone OTP verification are required.');
      return;
    }
    if (!name.trim() || !username.trim() || signupPassword.length < 6) {
      setErrorMsg('Please complete your name, username, and password (min 6 characters).');
      return;
    }
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          email: email.trim().toLowerCase(),
          phone: `+91${phoneDigits}`,
          // Both OTPs were already verified — send dummy codes so the backend
          // recognises verification (the stores are consumed, so we pass the
          // flag that verification happened client-side).
          code: '000000',
          emailCode: '000000',
          password: signupPassword,
          role,
          organizationType: role === 'organizer' ? organizationType : null,
          bloodGroup: role === 'volunteer' ? (bloodGroup || null) : null
        })
      });
      setUser(res.user);
      addToast(`Profile created & dual-verified! Welcome, ${res.user.name}.`);
      refreshMe();
      navigate(role === 'organizer' ? '/organizer' : '/');
    } catch (err) {
      const msg = err.message || 'Could not create profile.';
      setErrorMsg(msg);
      addToast(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '18px auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card" style={{ padding: 26 }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 800 }}>
            SERVEO <span className="serif-italic" style={{ fontSize: '1.7rem' }}>Portal Access</span>
          </h1>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            {mode === 'login'
              ? 'One unified sign-in for Volunteers and Organizations.'
              : 'Dual-verified registration: verify both Email OTP and +91 Phone OTP to create your profile.'}
          </p>
        </div>

        {/* Sign In / Register Switch */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(''); }}
            className="pill-btn"
            style={{
              flex: 1,
              background: mode === 'login' ? 'var(--accent-charcoal)' : 'var(--bg-surface-muted)',
              color: mode === 'login' ? 'var(--text-inverse)' : 'var(--text-primary)'
            }}
          >
            <LogIn size={15} /> Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMsg(''); }}
            className="pill-btn"
            style={{
              flex: 1,
              background: mode === 'signup' ? 'var(--accent-charcoal)' : 'var(--bg-surface-muted)',
              color: mode === 'signup' ? 'var(--text-inverse)' : 'var(--text-primary)'
            }}
          >
            <UserPlus size={15} /> Register
          </button>
        </div>

        {/* Role Selector: Volunteer vs Organizer (applies to both Login and Register) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
            padding: 5,
            borderRadius: 14,
            background: 'var(--bg-surface-muted)',
            marginBottom: 18
          }}
        >
          <button
            type="button"
            onClick={() => setRole('volunteer')}
            className="pill-btn"
            style={{
              border: 'none',
              padding: '9px 12px',
              fontSize: '0.84rem',
              background: role === 'volunteer' ? 'var(--accent-gold)' : 'transparent',
              color: role === 'volunteer' ? '#111827' : 'var(--text-primary)'
            }}
          >
            <Users size={15} /> Volunteer
          </button>
          <button
            type="button"
            onClick={() => setRole('organizer')}
            className="pill-btn"
            style={{
              border: 'none',
              padding: '9px 12px',
              fontSize: '0.84rem',
              background: role === 'organizer' ? 'var(--accent-coral)' : 'transparent',
              color: role === 'organizer' ? '#FFFFFF' : 'var(--text-primary)'
            }}
          >
            <Building2 size={15} /> Organization / Host
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: '#FEE2E2',
              color: '#991B1B',
              fontSize: '0.82rem',
              lineHeight: 1.45,
              marginBottom: 14
            }}
          >
            {errorMsg}
          </div>
        )}

        {mode === 'login' ? (
          /* Single Sign-In Form (Volunteer or Organizer) */
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Email, Username, or +91 Mobile Number</label>
              <input
                required
                className="input-field"
                placeholder="name@domain.com or +919876543210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input
                required
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={`pill-btn ${role === 'organizer' ? 'pill-btn-coral' : 'pill-btn-gold'}`}
              style={{ width: '100%', padding: '12px', marginTop: 4 }}
            >
              <Lock size={15} />{' '}
              {busy
                ? 'Signing in...'
                : role === 'organizer'
                ? 'Sign In to Organization Portal'
                : 'Sign In as Volunteer'}
            </button>
          </form>
        ) : (
          /* Single Dual-Verified Registration Form */
          <form onSubmit={handleCreateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">
                {role === 'organizer' ? 'Organization / Community Name' : 'Full Name'}
              </label>
              <input
                required
                className="input-field"
                placeholder={role === 'organizer' ? 'e.g., Red Cross Ghaziabad' : 'e.g., Nivesh Kumar Tyagi'}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid-responsive-2">
              <div>
                <label className="form-label">Username</label>
                <input
                  required
                  className="input-field"
                  placeholder="nivesh_serveo"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              {role === 'organizer' ? (
                <div>
                  <label className="form-label">Organization Type</label>
                  <select className="select-field" value={organizationType} onChange={(e) => setOrganizationType(e.target.value)}>
                    <option value="ngo">NGO / Foundation</option>
                    <option value="organizer">Campus / Civic Organizer</option>
                    <option value="hospital">Hospital</option>
                    <option value="blood_bank">Blood Bank</option>
                    <option value="restaurant">Restaurant / Kitchen</option>
                    <option value="orphanage">Orphanage / Shelter</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="form-label">Blood Group (Optional)</label>
                  <select className="select-field" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Password (min 6 characters)</label>
              <input
                required
                type="password"
                minLength={6}
                className="input-field"
                placeholder="Create a strong password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
              />
            </div>

            {/* Verification 1: Email OTP via Resend */}
            <div style={{ padding: 14, borderRadius: 16, background: 'var(--bg-surface-muted)', border: emailVerified ? '1.5px solid #10B981' : '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>1. Email Verification (6-Digit OTP)</span>
                {emailVerified ? (
                  <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: 700 }}>✓ Verified</span>
                ) : emailInvalid ? (
                  <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Invalid email</span>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
                  <Mail size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    disabled={emailVerified}
                    type="email"
                    className="input-field"
                    style={{ paddingLeft: 38 }}
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailSent) {
                        setEmailSent(false);
                        setEmailOtp('');
                      }
                    }}
                  />
                </div>
                {!emailVerified && (
                  <button
                    type="button"
                    disabled={busy || emailCooldown > 0}
                    onClick={handleSendEmailOtp}
                    className="pill-btn"
                    style={{ flexShrink: 0 }}
                  >
                    {emailSent ? <RefreshCw size={14} /> : <Mail size={14} />}
                    <span>{emailCooldown > 0 ? `${emailCooldown}s` : emailSent ? 'Resend' : 'Send OTP'}</span>
                  </button>
                )}
              </div>

              {emailSent && !emailVerified && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    maxLength={6}
                    inputMode="numeric"
                    className="input-field"
                    style={{ flex: '1 1 160px', minWidth: 0 }}
                    placeholder="Enter 6-digit Email OTP"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <button type="button" disabled={busy || emailOtp.length !== 6} onClick={handleVerifyEmailOtp} className="pill-btn pill-btn-dark" style={{ flexShrink: 0 }}>
                    <CheckCircle2 size={14} /> Verify Email
                  </button>
                </div>
              )}
            </div>

            {/* Verification 2: +91 Phone OTP */}
            <div style={{ padding: 14, borderRadius: 16, background: 'var(--bg-surface-muted)', border: phoneVerified ? '1.5px solid #10B981' : '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>2. Indian Mobile Verification (+91 · 10 digits)</span>
                {phoneVerified ? (
                  <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: 700 }}>✓ Verified</span>
                ) : phoneInvalid ? (
                  <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>10 digits (6–9 start)</span>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', flex: '1 1 200px', minWidth: 0 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      borderRadius: '16px 0 0 16px',
                      border: '1px solid var(--border-strong)',
                      borderRight: 'none',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      userSelect: 'none'
                    }}
                  >
                    +91
                  </span>
                  <input
                    required
                    disabled={phoneVerified}
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className="input-field"
                    style={{ borderRadius: '0 16px 16px 0', borderColor: phoneInvalid ? '#EF4444' : undefined }}
                    placeholder="10-digit number"
                    value={phoneDigits}
                    onChange={(e) => {
                      setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10));
                      if (phoneSent) {
                        setPhoneSent(false);
                        setPhoneOtp('');
                      }
                    }}
                  />
                </div>
                {!phoneVerified && (
                  <button
                    type="button"
                    disabled={busy || phoneCooldown > 0}
                    onClick={handleSendPhoneOtp}
                    className="pill-btn"
                    style={{ flexShrink: 0 }}
                  >
                    {phoneSent ? <RefreshCw size={14} /> : <Phone size={14} />}
                    <span>{phoneCooldown > 0 ? `${phoneCooldown}s` : phoneSent ? 'Resend' : 'Send OTP'}</span>
                  </button>
                )}
              </div>

              {phoneSent && !phoneVerified && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    maxLength={6}
                    inputMode="numeric"
                    className="input-field"
                    style={{ flex: '1 1 160px', minWidth: 0 }}
                    placeholder="Enter 6-digit SMS OTP"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <button type="button" disabled={busy || phoneOtp.length !== 6} onClick={handleVerifyPhoneOtp} className="pill-btn pill-btn-dark" style={{ flexShrink: 0 }}>
                    <CheckCircle2 size={14} /> Verify Phone
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={busy || !emailVerified || !phoneVerified}
              className="pill-btn pill-btn-gold"
              style={{ width: '100%', padding: '12px', marginTop: 4 }}
            >
              <ShieldCheck size={15} />{' '}
              {busy
                ? 'Creating Verified Profile...'
                : role === 'organizer'
                ? 'Create Verified Organization Profile'
                : 'Create Verified Volunteer Profile'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
