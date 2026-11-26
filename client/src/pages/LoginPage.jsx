import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, UserPlus, LogIn, ShieldCheck, Mail } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

function sanitize10Digits(val) {
  return String(val || '').replace(/\D/g, '').slice(0, 10);
}

function isValid10DigitIndian(digits) {
  return /^[6-9]\d{9}$/.test(digits);
}

export default function LoginPage() {
  const { setUser, refreshMe, addToast } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'

  // Password login
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // OTP login (fixed +91 + 10 digits)
  const [loginDigits, setLoginDigits] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginPreviewOtp, setLoginPreviewOtp] = useState('');

  // Signup fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailPreviewOtp, setEmailPreviewOtp] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [signupPreviewOtp, setSignupPreviewOtp] = useState('');
  const [busy, setBusy] = useState(false);

  const emailInvalid = email.trim().length > 0 && !EMAIL_RE.test(email.trim());
  const signupPhoneInvalid = phoneDigits.length > 0 && !isValid10DigitIndian(phoneDigits);
  const loginPhoneInvalid = loginDigits.length > 0 && !isValid10DigitIndian(loginDigits);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      setUser(data.user);
      addToast(`Welcome back, ${data.user.name}!`);
      refreshMe();
      navigate('/');
    } catch (err) {
      addToast(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSendLoginOtp = async () => {
    if (!isValid10DigitIndian(loginDigits)) {
      addToast('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: `+91${loginDigits}` })
      });
      setLoginOtpSent(true);
      setLoginPreviewOtp(res.devOtp || '');
      addToast(res.message || '6-digit OTP sent to +91' + loginDigits);
    } catch (err) {
      addToast(err.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    if (!isValid10DigitIndian(loginDigits)) {
      addToast('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    try {
      setBusy(true);
      const data = await apiFetch('/api/auth/login-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: `+91${loginDigits}`, code: loginOtp })
      });
      setUser(data.user);
      addToast(`Signed in via OTP! Welcome back, ${data.user.name}.`);
      refreshMe();
      navigate('/');
    } catch (err) {
      addToast(err.message || 'OTP sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      addToast('Please enter a valid email address first.');
      return;
    }
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/email-otp/send', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      setEmailOtpSent(true);
      setEmailPreviewOtp(res.devOtp || '');
      addToast(res.message || '6-digit email OTP sent!');
    } catch (err) {
      addToast(err.message || 'Could not send email OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleSendSignupOtp = async () => {
    if (!isValid10DigitIndian(phoneDigits)) {
      addToast('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: `+91${phoneDigits}` })
      });
      setOtpSent(true);
      setSignupPreviewOtp(res.devOtp || '');
      addToast(res.message || '6-digit mobile OTP sent!');
    } catch (err) {
      addToast(err.message || 'Could not send mobile OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      addToast('Please enter a valid email address.');
      return;
    }
    if (!isValid10DigitIndian(phoneDigits)) {
      addToast('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!emailOtpSent || !emailOtpCode.trim()) {
      addToast('Please send and enter the 6-digit Email OTP.');
      return;
    }
    if (!otpSent || !otpCode.trim()) {
      addToast('Please send and enter the 6-digit Mobile OTP.');
      return;
    }
    try {
      setBusy(true);
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          email: email.trim().toLowerCase(),
          emailCode: emailOtpCode.trim(),
          phone: `+91${phoneDigits}`,
          code: otpCode.trim(),
          password,
          bloodGroup: bloodGroup || null
        })
      });
      setUser(data.user);
      addToast(`Email & Mobile verified! Welcome, ${data.user.name}.`);
      refreshMe();
      navigate('/');
    } catch (err) {
      addToast(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const renderPhoneInput = (digits, setDigits, invalid) => (
    <div style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 12px',
          borderRadius: '16px 0 0 16px',
          border: '1px solid var(--border-strong)',
          borderRight: 'none',
          background: 'var(--bg-surface-muted)',
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
        type="tel"
        inputMode="numeric"
        maxLength={10}
        pattern="[6-9][0-9]{9}"
        className="input-field"
        style={{
          borderRadius: '0 16px 16px 0',
          borderColor: invalid ? '#EF4444' : undefined
        }}
        placeholder="10-digit number"
        value={digits}
        onChange={(e) => setDigits(sanitize10Digits(e.target.value))}
      />
    </div>
  );

  return (
    <div style={{ maxWidth: 540, margin: '12px auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 800 }}>
            SERVEO <span className="serif-italic" style={{ fontSize: '1.55rem' }}>Account</span>
          </h1>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Sign in with your password or +91 mobile OTP, or register with verified email &amp; 10-digit mobile.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setMode('login')}
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
            onClick={() => setMode('signup')}
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

        {mode === 'login' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: 'var(--bg-surface-muted)' }}>
              <button
                type="button"
                onClick={() => setLoginMethod('password')}
                className="pill-btn"
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  fontSize: '0.8rem',
                  border: 'none',
                  background: loginMethod === 'password' ? 'var(--bg-surface)' : 'transparent'
                }}
              >
                <Lock size={13} /> Password
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('otp')}
                className="pill-btn"
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  fontSize: '0.8rem',
                  border: 'none',
                  background: loginMethod === 'otp' ? 'var(--bg-surface)' : 'transparent'
                }}
              >
                <Phone size={13} /> Mobile OTP
              </button>
            </div>

            {loginMethod === 'password' ? (
              <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Email, Username, or +91 Phone</label>
                  <input
                    required
                    className="input-field"
                    placeholder="name@example.com or +919876543210"
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
                <button type="submit" disabled={busy} className="pill-btn pill-btn-dark" style={{ width: '100%', padding: '12px' }}>
                  <Lock size={15} /> {busy ? 'Signing in...' : 'Sign In to SERVEO'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Indian Mobile Number (10 digits)</span>
                    {loginPhoneInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Must be 10 digits (6–9 start)</span>}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {renderPhoneInput(loginDigits, setLoginDigits, loginPhoneInvalid)}
                    <button type="button" onClick={handleSendLoginOtp} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                      <Phone size={14} /> {loginOtpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>
                {loginPreviewOtp && (
                  <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--accent-gold-soft)', color: '#111827', fontSize: '0.82rem' }}>
                    <strong>SMS Verification Code:</strong> <code>{loginPreviewOtp}</code> (valid 10m)
                  </div>
                )}
                <div>
                  <label className="form-label">6-Digit Mobile OTP</label>
                  <input
                    required
                    maxLength={6}
                    inputMode="numeric"
                    className="input-field"
                    placeholder="Enter 6-digit OTP"
                    value={loginOtp}
                    onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
                <button type="submit" disabled={busy || !loginOtpSent} className="pill-btn pill-btn-gold" style={{ width: '100%', padding: '12px' }}>
                  <ShieldCheck size={15} /> {busy ? 'Verifying OTP...' : 'Verify OTP & Sign In'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="form-label">Full Name / Organization Name</label>
              <input required className="input-field" placeholder="e.g., Nivesh Kumar Tyagi" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid-responsive-2">
              <div>
                <label className="form-label">Username</label>
                <input required className="input-field" placeholder="nivesh_serveo" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Blood Group (Optional)</label>
                <select className="select-field" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  <option value="">Select</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Email + Email OTP */}
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Email Address</span>
                {emailInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Invalid email format</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Mail size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    type="email"
                    className="input-field"
                    style={{ paddingLeft: 38 }}
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="button" onClick={handleSendEmailOtp} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                  <Mail size={14} /> {emailOtpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>
            {emailPreviewOtp && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--accent-gold-soft)', color: '#111827', fontSize: '0.82rem' }}>
                <strong>Email Verification Code:</strong> <code>{emailPreviewOtp}</code> (valid 10m)
              </div>
            )}
            <div>
              <label className="form-label">6-Digit Email OTP</label>
              <input
                required
                maxLength={6}
                inputMode="numeric"
                className="input-field"
                placeholder="Enter 6-digit Email OTP"
                value={emailOtpCode}
                onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            {/* Fixed +91 10-digit Mobile + SMS OTP */}
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Indian Mobile Number (+91 fixed · 10 digits)</span>
                {signupPhoneInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Must be 10 digits (6–9 start)</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {renderPhoneInput(phoneDigits, setPhoneDigits, signupPhoneInvalid)}
                <button type="button" onClick={handleSendSignupOtp} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                  <Phone size={14} /> {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>
            {signupPreviewOtp && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--accent-gold-soft)', color: '#111827', fontSize: '0.82rem' }}>
                <strong>SMS Verification Code:</strong> <code>{signupPreviewOtp}</code> (valid 10m)
              </div>
            )}
            <div>
              <label className="form-label">6-Digit Mobile OTP</label>
              <input
                required
                maxLength={6}
                inputMode="numeric"
                className="input-field"
                placeholder="Enter 6-digit Mobile OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            <div>
              <label className="form-label">Password (min 6 chars)</label>
              <input
                required
                type="password"
                minLength={6}
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy || emailInvalid || signupPhoneInvalid}
              className="pill-btn pill-btn-gold"
              style={{ width: '100%', padding: '12px' }}
            >
              <ShieldCheck size={15} /> {busy ? 'Verifying & Creating...' : 'Verify Email & Mobile OTP · Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
