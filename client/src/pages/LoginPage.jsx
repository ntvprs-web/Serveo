import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, UserPlus, LogIn, ShieldCheck, Mail } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export default function LoginPage() {
  const { setUser, refreshMe, addToast } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'

  // Password login
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // OTP login
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginPreviewOtp, setLoginPreviewOtp] = useState('');

  // Signup fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [signupPreviewOtp, setSignupPreviewOtp] = useState('');
  const [busy, setBusy] = useState(false);

  const emailInvalid = email.trim().length > 0 && !EMAIL_RE.test(email.trim());

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
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: loginPhone })
      });
      setLoginOtpSent(true);
      setLoginPreviewOtp(res.devOtp || '');
      addToast(res.message || '6-digit OTP sent to your mobile.');
    } catch (err) {
      addToast(err.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      const data = await apiFetch('/api/auth/login-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: loginPhone, code: loginOtp })
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

  const handleSendSignupOtp = async () => {
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone })
      });
      setOtpSent(true);
      setSignupPreviewOtp(res.devOtp || '');
      addToast(res.message || '6-digit OTP sent to your mobile.');
    } catch (err) {
      addToast(err.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      addToast('Please enter a valid email address (e.g., name@domain.com).');
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
          phone: phone.trim(),
          code: otpCode.trim(),
          password,
          bloodGroup: bloodGroup || null
        })
      });
      setUser(data.user);
      addToast(`Account verified & created! Welcome, ${data.user.name}.`);
      refreshMe();
      navigate('/');
    } catch (err) {
      addToast(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '12px auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 800 }}>
            SERVEO <span className="serif-italic" style={{ fontSize: '1.55rem' }}>Account</span>
          </h1>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Sign in with your credentials or +91 mobile OTP, or register a verified account.
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
                  <label className="form-label">Registered Indian Mobile Number (+91)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      required
                      className="input-field"
                      placeholder="+919876543210"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                    />
                    <button type="button" onClick={handleSendLoginOtp} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                      <Phone size={14} /> {loginOtpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>
                {loginPreviewOtp && (
                  <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--accent-gold-soft)', color: '#111827', fontSize: '0.82rem' }}>
                    <strong>SMS Verification Code:</strong> <code>{loginPreviewOtp}</code> (valid for 10 minutes)
                  </div>
                )}
                <div>
                  <label className="form-label">6-Digit OTP</label>
                  <input
                    required
                    maxLength={6}
                    className="input-field"
                    placeholder="Enter 6-digit OTP"
                    value={loginOtp}
                    onChange={(e) => setLoginOtp(e.target.value)}
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
              <input required className="input-field" placeholder="e.g., Nivesh Tyagi" value={name} onChange={(e) => setName(e.target.value)} />
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
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Email Address</span>
                {emailInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Invalid email format</span>}
              </label>
              <div style={{ position: 'relative' }}>
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
            </div>
            <div>
              <label className="form-label">Indian Mobile Number (+91)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  required
                  className="input-field"
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <button type="button" onClick={handleSendSignupOtp} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                  <Phone size={14} /> {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>
            {signupPreviewOtp && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--accent-gold-soft)', color: '#111827', fontSize: '0.82rem' }}>
                <strong>SMS Verification Code:</strong> <code>{signupPreviewOtp}</code> (valid for 10 minutes)
              </div>
            )}
            <div>
              <label className="form-label">6-Digit Mobile OTP</label>
              <input
                required
                maxLength={6}
                className="input-field"
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
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
            <button type="submit" disabled={busy || emailInvalid} className="pill-btn pill-btn-gold" style={{ width: '100%', padding: '12px' }}>
              <ShieldCheck size={15} /> {busy ? 'Verifying & Creating...' : 'Verify OTP & Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
