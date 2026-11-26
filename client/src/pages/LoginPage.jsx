import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Lock, Phone, UserPlus, LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';

export default function LoginPage() {
  const { setUser, refreshMe, addToast } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Signup fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e) => {
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

  const handleSendOtp = async () => {
    try {
      setBusy(true);
      const res = await apiFetch('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone })
      });
      setOtpSent(true);
      addToast(res.message || 'OTP sent!');
    } catch (err) {
      addToast(err.message || 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name,
          username,
          email,
          phone,
          code: otpCode,
          password,
          bloodGroup: bloodGroup || null
        })
      });
      setUser(data.user);
      addToast(`Account created! Welcome, ${data.user.name}.`);
      refreshMe();
      navigate('/');
    } catch (err) {
      addToast(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickDemo = async (role) => {
    try {
      setBusy(true);
      const data = await apiFetch('/api/auth/quick-login', {
        method: 'POST',
        body: JSON.stringify({ role })
      });
      setUser(data.user);
      addToast(`Signed in as ${data.user.name} (Demo ${role})`);
      refreshMe();
      navigate(role === 'organizer' ? '/organizer' : '/');
    } catch (err) {
      addToast(err.message || 'Quick demo login is only enabled in development mode.');
    } finally {
      setBusy(false);
    }
  };

  const handleFastRegister = async () => {
    try {
      setBusy(true);
      const data = await apiFetch('/api/auth/quick-register', {
        method: 'POST',
        body: JSON.stringify({})
      });
      setUser(data.user);
      addToast(`Fast-registered & signed in as ${data.user.name}!`);
      refreshMe();
      navigate('/');
    } catch (err) {
      addToast(err.message || 'Fast register is only enabled in development mode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '12px auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card" style={{ padding: 24 }}>
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
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Email, Username, or +91 Phone</label>
              <input
                required
                className="input-field"
                placeholder="aarav@example.com or +919876543210"
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
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="form-label">Full Name</label>
              <input required className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid-responsive-2">
              <div>
                <label className="form-label">Username</label>
                <input required className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} />
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
              <label className="form-label">Email</label>
              <input required type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                <button type="button" onClick={handleSendOtp} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                  <Phone size={14} /> {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">SMS Verification Code (Dev test: 123456)</label>
              <input
                required
                className="input-field"
                placeholder="6-digit OTP"
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
            <button type="submit" disabled={busy} className="pill-btn pill-btn-gold" style={{ width: '100%', padding: '12px' }}>
              {busy ? 'Creating Account...' : 'Verify & Create Account'}
            </button>
          </form>
        )}
      </div>

      {/* 1-Click Fast Demo Access (from SERVEO Project Guide) */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, fontSize: '0.9rem' }}>
          <Zap size={16} color="#F59E0B" /> 1-Click Fast Demo Access (Dev Mode)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={() => handleQuickDemo('organizer')} disabled={busy} className="pill-btn">
            Quick Demo Organizer (Indian Red Cross Society)
          </button>
          <button type="button" onClick={() => handleQuickDemo('volunteer')} disabled={busy} className="pill-btn">
            Quick Demo Volunteer (Aarav Sharma)
          </button>
          <button type="button" onClick={handleFastRegister} disabled={busy} className="pill-btn pill-btn-coral">
            1-Click Fast Register (New Indian Citizen Account)
          </button>
        </div>
      </div>
    </div>
  );
}
