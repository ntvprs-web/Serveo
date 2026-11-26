import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  LogIn
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';
import { supabase, isSupabaseAuthConfigured } from '../utils/supabase';

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91 (India)' },
  { code: '+1', label: '🇺🇸 +1 (US/CA)' },
  { code: '+44', label: '🇬🇧 +44 (UK)' },
  { code: '+971', label: '🇦🇪 +971 (UAE)' },
  { code: '+61', label: '🇦🇺 +61 (AU)' }
];

export default function LoginPage() {
  const { setUser, refreshMe, addToast } = useApp();
  const navigate = useNavigate();

  // Auth channel tabs: 'email' | 'phone' | 'password'
  const [channel, setChannel] = useState('email');
  const [step, setStep] = useState('request'); // 'request' | 'verify'

  // Optional profile fields for new accounts
  const [fullName, setFullName] = useState('');

  // Email OTP state
  const [email, setEmail] = useState('');

  // Phone OTP state
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Password login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // OTP verification state
  const [otpToken, setOtpToken] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const emailInvalid = email.trim().length > 0 && !EMAIL_RE.test(email.trim());

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const formattedE164Phone = () => {
    const digits = phoneNumber.replace(/\D/g, '');
    return `${countryCode}${digits}`;
  };

  const handleRequestOtp = async (e) => {
    e?.preventDefault?.();
    setErrorMsg('');

    if (!isSupabaseAuthConfigured || !supabase) {
      setErrorMsg('Supabase Auth is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
      return;
    }

    if (channel === 'email') {
      const cleanEmail = email.trim().toLowerCase();
      if (!EMAIL_RE.test(cleanEmail)) {
        setErrorMsg('Please enter a valid email address (e.g., name@domain.com).');
        return;
      }
      try {
        setBusy(true);
        // Do NOT pass emailRedirectTo so Supabase sends a 6-digit OTP token instead of a magic link
        const { error } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: true,
            data: fullName.trim() ? { full_name: fullName.trim() } : undefined
          }
        });
        if (error) throw error;
        setStep('verify');
        setOtpToken('');
        setCooldown(60);
        addToast(`6-digit verification code sent to ${cleanEmail}`);
      } catch (err) {
        const msg = err.message || 'Could not send email OTP. Please try again.';
        setErrorMsg(msg);
        addToast(msg);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (channel === 'phone') {
      const digits = phoneNumber.replace(/\D/g, '');
      if (countryCode === '+91' && !/^[6-9]\d{9}$/.test(digits)) {
        setErrorMsg('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
        return;
      }
      if (digits.length < 7 || digits.length > 15) {
        setErrorMsg('Enter a valid mobile number.');
        return;
      }
      const e164 = formattedE164Phone();
      try {
        setBusy(true);
        const { error } = await supabase.auth.signInWithOtp({
          phone: e164,
          options: {
            shouldCreateUser: true,
            data: fullName.trim() ? { full_name: fullName.trim() } : undefined
          }
        });
        if (error) throw error;
        setStep('verify');
        setOtpToken('');
        setCooldown(60);
        addToast(`6-digit SMS OTP sent to ${e164}`);
      } catch (err) {
        const raw = err.message || '';
        const friendly = /phone provider|unsupported phone provider|sms/i.test(raw)
          ? `${raw} — Enable the Phone provider & add Twilio/SMS credentials in Supabase Dashboard → Authentication → Providers → Phone.`
          : raw || 'Could not send SMS OTP.';
        setErrorMsg(friendly);
        addToast(friendly);
      } finally {
        setBusy(false);
      }
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanToken = otpToken.replace(/\D/g, '').slice(0, 6);
    if (cleanToken.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }

    try {
      setBusy(true);
      const verifyPayload =
        channel === 'email'
          ? { email: email.trim().toLowerCase(), token: cleanToken, type: 'email' }
          : { phone: formattedE164Phone(), token: cleanToken, type: 'sms' };

      const { data, error } = await supabase.auth.verifyOtp(verifyPayload);
      if (error) throw error;

      const accessToken = data?.session?.access_token;
      if (!accessToken) {
        throw new Error('Verification succeeded, but no session token was returned. Please try again.');
      }

      // Sync verified Supabase session with SERVEO PostgreSQL backend cookie
      const bridgeRes = await apiFetch('/api/auth/supabase', {
        method: 'POST',
        body: JSON.stringify({
          accessToken,
          name: fullName.trim() || undefined
        })
      });

      setUser(bridgeRes.user);
      addToast(`Verified & signed in! Welcome, ${bridgeRes.user.name}.`);
      refreshMe();
      navigate('/');
    } catch (err) {
      const raw = err.message || 'Invalid or expired OTP code.';
      const friendly = /expired|invalid/i.test(raw)
        ? 'Invalid or expired 6-digit OTP. Please check the code or request a new one.'
        : /rate limit|too many/i.test(raw)
        ? 'Too many attempts. Please wait a minute before requesting another OTP.'
        : raw;
      setErrorMsg(friendly);
      addToast(friendly);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
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
      const msg = err.message || 'Sign in failed';
      setErrorMsg(msg);
      addToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const switchChannel = (next) => {
    setChannel(next);
    setStep('request');
    setOtpToken('');
    setErrorMsg('');
  };

  return (
    <div style={{ maxWidth: 520, margin: '18px auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card" style={{ padding: 26 }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 800 }}>
            SERVEO <span className="serif-italic" style={{ fontSize: '1.7rem' }}>Sign In</span>
          </h1>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            Authenticate securely with a 6-digit Email OTP, +91 SMS OTP, or your account password.
          </p>
        </div>

        {/* Channel Toggle Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 6,
            padding: 5,
            borderRadius: 14,
            background: 'var(--bg-surface-muted)',
            marginBottom: 20
          }}
        >
          {[
            { id: 'email', label: 'Email OTP', icon: Mail },
            { id: 'phone', label: 'Phone OTP', icon: Phone },
            { id: 'password', label: 'Password', icon: Lock }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = channel === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchChannel(tab.id)}
                className="pill-btn"
                style={{
                  padding: '8px 10px',
                  fontSize: '0.8rem',
                  border: 'none',
                  background: active ? 'var(--accent-charcoal)' : 'transparent',
                  color: active ? 'var(--text-inverse)' : 'var(--text-primary)'
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
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

        {channel === 'password' ? (
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
              <LogIn size={15} /> {busy ? 'Signing in...' : 'Sign In to SERVEO'}
            </button>
          </form>
        ) : step === 'request' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Full Name / Organization (for new accounts)</label>
              <input
                className="input-field"
                placeholder="e.g., Nivesh Kumar Tyagi"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            {channel === 'email' ? (
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
            ) : (
              <div>
                <label className="form-label">Mobile Number (E.164)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="select-field"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    style={{ width: 138, flexShrink: 0 }}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={countryCode === '+91' ? 10 : 15}
                    className="input-field"
                    placeholder={countryCode === '+91' ? '10-digit number' : 'Phone number'}
                    value={phoneNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '');
                      setPhoneNumber(countryCode === '+91' ? clean.slice(0, 10) : clean.slice(0, 15));
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || (channel === 'email' && emailInvalid)}
              className="pill-btn pill-btn-gold"
              style={{ width: '100%', padding: '12px', marginTop: 4 }}
            >
              <ShieldCheck size={15} /> {busy ? 'Sending 6-Digit OTP...' : 'Send 6-Digit OTP'}
            </button>
          </form>
        ) : (
          /* Step 2: Verify 6-Digit OTP */
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 14, background: 'var(--bg-surface-muted)', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Enter the 6-digit verification code sent to{' '}
              <strong>{channel === 'email' ? email.trim().toLowerCase() : formattedE164Phone()}</strong>.
            </div>

            <div>
              <label className="form-label">6-Digit OTP Code</label>
              <input
                required
                autoFocus
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="input-field"
                style={{ textAlign: 'center', fontSize: '1.35rem', letterSpacing: '0.45em', fontWeight: 700 }}
                placeholder="••••••"
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            <button
              type="submit"
              disabled={busy || otpToken.length !== 6}
              className="pill-btn pill-btn-gold"
              style={{ width: '100%', padding: '12px' }}
            >
              <ShieldCheck size={15} /> {busy ? 'Verifying OTP...' : 'Verify & Continue'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setOtpToken('');
                  setErrorMsg('');
                }}
                className="pill-btn"
                style={{ fontSize: '0.8rem', padding: '8px 12px' }}
              >
                <ArrowLeft size={14} /> Change {channel === 'email' ? 'Email' : 'Phone'}
              </button>

              <button
                type="button"
                disabled={busy || cooldown > 0}
                onClick={handleRequestOtp}
                className="pill-btn"
                style={{ fontSize: '0.8rem', padding: '8px 12px', opacity: cooldown > 0 ? 0.65 : 1 }}
              >
                <RefreshCw size={14} /> {cooldown > 0 ? `Resend OTP (${cooldown}s)` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
