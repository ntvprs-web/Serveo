import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, UserPlus, LogIn, ShieldCheck, Mail, CheckCircle2, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';
import {
  isFirebaseConfigured,
  getFirebaseAuth,
  createRecaptcha,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  linkWithPhoneNumber,
  signInWithEmailAndPassword
} from '../utils/firebase';

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

  // Firebase Mobile OTP login
  const [loginDigits, setLoginDigits] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const loginConfirmRef = useRef(null);

  // Signup fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [smsOtp, setSmsOtp] = useState('');

  // Firebase verification state on signup
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const fbUserRef = useRef(null);
  const signupConfirmRef = useRef(null);
  const [authError, setAuthError] = useState('');
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
      if (isFirebaseConfigured) {
        const auth = getFirebaseAuth();
        const verifier = createRecaptcha('recaptcha-container');
        const confirmation = await signInWithPhoneNumber(auth, `+91${loginDigits}`, verifier);
        loginConfirmRef.current = confirmation;
        setLoginOtpSent(true);
        addToast(`SMS OTP sent via Firebase to +91${loginDigits}.`);
      } else {
        const res = await apiFetch('/api/auth/otp/send', {
          method: 'POST',
          body: JSON.stringify({ phone: `+91${loginDigits}` })
        });
        setLoginOtpSent(true);
        addToast(res.message || `6-digit OTP sent to +91${loginDigits}`);
      }
    } catch (err) {
      addToast(err.message || 'Could not send SMS OTP. Check Firebase Phone Auth settings.');
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
      if (isFirebaseConfigured && loginConfirmRef.current) {
        const cred = await loginConfirmRef.current.confirm(loginOtp.trim());
        const idToken = await cred.user.getIdToken(true);
        const data = await apiFetch('/api/auth/firebase', {
          method: 'POST',
          body: JSON.stringify({ idToken, mode: 'login' })
        });
        setUser(data.user);
        addToast(`Signed in via Firebase SMS OTP! Welcome back, ${data.user.name}.`);
        refreshMe();
        navigate('/');
      } else {
        const data = await apiFetch('/api/auth/login-otp', {
          method: 'POST',
          body: JSON.stringify({ phone: `+91${loginDigits}`, code: loginOtp })
        });
        setUser(data.user);
        addToast(`Signed in via OTP! Welcome back, ${data.user.name}.`);
        refreshMe();
        navigate('/');
      }
    } catch (err) {
      addToast(err.message || 'Invalid or expired OTP code.');
    } finally {
      setBusy(false);
    }
  };

  // Step 1 on Signup: Send Firebase Email Verification Link
  const handleSendEmailVerification = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      addToast('Please enter a valid email address.');
      return;
    }
    if (signupPassword.length < 6) {
      addToast('Please enter a password (min 6 characters) before verifying email.');
      return;
    }
    try {
      setBusy(true);
      const auth = getFirebaseAuth();
      const cleanEmail = email.trim().toLowerCase();
      let userCred;
      try {
        userCred = await createUserWithEmailAndPassword(auth, cleanEmail, signupPassword);
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          userCred = await signInWithEmailAndPassword(auth, cleanEmail, signupPassword);
        } else {
          throw err;
        }
      }
      fbUserRef.current = userCred.user;
      await userCred.user.reload();
      if (userCred.user.emailVerified) {
        setEmailVerified(true);
        setEmailSent(true);
        addToast('Your email is already verified!');
      } else {
        await sendEmailVerification(userCred.user);
        setEmailSent(true);
        addToast(`Verification email sent to ${cleanEmail}! Click the link in your inbox, then click "Check Verification".`);
      }
    } catch (err) {
      addToast(err.message || 'Could not send Firebase verification email.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckEmailVerified = async () => {
    if (!fbUserRef.current) return;
    try {
      setBusy(true);
      await fbUserRef.current.reload();
      if (fbUserRef.current.emailVerified) {
        setEmailVerified(true);
        addToast('Email verified! Now verify your 10-digit +91 mobile number.');
      } else {
        addToast('Email not verified yet. Please click the link sent to your inbox (check Spam too).');
      }
    } catch (err) {
      addToast(err.message || 'Could not refresh verification status.');
    } finally {
      setBusy(false);
    }
  };

  // Step 2 on Signup: Link & Verify +91 Mobile via Firebase SMS OTP
  const handleSendSignupSms = async () => {
    setAuthError('');
    if (!isValid10DigitIndian(phoneDigits)) {
      const msg = 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
      setAuthError(msg);
      addToast(msg);
      return;
    }
    if (!fbUserRef.current) {
      const msg = 'Complete Step 1 (Verify Email & click "Check Email Verification") first so your phone links to your account.';
      setAuthError(msg);
      addToast(msg);
      return;
    }
    try {
      setBusy(true);
      const verifier = createRecaptcha('recaptcha-container');
      const confirmation = await linkWithPhoneNumber(fbUserRef.current, `+91${phoneDigits}`, verifier);
      signupConfirmRef.current = confirmation;
      setSmsSent(true);
      addToast(`Real SMS OTP sent via Firebase to +91${phoneDigits}!`);
    } catch (err) {
      const msg = err.code === 'auth/billing-not-enabled'
        ? 'Firebase Phone SMS requires Blaze plan or a Test Phone Number in Firebase Console (Authentication → Sign-in method → Phone → Phone numbers for testing).'
        : (err.message || 'Could not send Firebase SMS OTP. If using Brave, disable Shields on localhost for reCAPTCHA.');
      setAuthError(msg);
      addToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySignupSms = async () => {
    if (!signupConfirmRef.current || !smsOtp.trim()) {
      addToast('Enter the 6-digit SMS OTP sent to your phone.');
      return;
    }
    try {
      setBusy(true);
      const cred = await signupConfirmRef.current.confirm(smsOtp.trim());
      fbUserRef.current = cred.user;
      setPhoneVerified(true);
      addToast('Mobile number verified via Firebase SMS OTP!');
    } catch (err) {
      addToast(err.message || 'Invalid or expired SMS OTP.');
    } finally {
      setBusy(false);
    }
  };

  // Step 3 on Signup: Exchange verified Firebase ID Token for SERVEO session
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!fbUserRef.current || !emailVerified || !phoneVerified) {
      addToast('Please verify both your Email and +91 Mobile OTP first.');
      return;
    }
    try {
      setBusy(true);
      const idToken = await fbUserRef.current.getIdToken(true);
      const data = await apiFetch('/api/auth/firebase', {
        method: 'POST',
        body: JSON.stringify({
          idToken,
          mode: 'signup',
          name: name.trim(),
          username: username.trim(),
          password: signupPassword,
          bloodGroup: bloodGroup || null
        })
      });
      setUser(data.user);
      addToast(`Account created & verified via Firebase! Welcome, ${data.user.name}.`);
      refreshMe();
      navigate('/');
    } catch (err) {
      addToast(err.message || 'Could not complete registration.');
    } finally {
      setBusy(false);
    }
  };

  const renderPhoneInput = (digits, setDigits, invalid, disabled = false) => (
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
        disabled={disabled}
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
      {/* Invisible reCAPTCHA mount for Firebase Phone Auth */}
      <div id="recaptcha-container" />

      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 800 }}>
            SERVEO <span className="serif-italic" style={{ fontSize: '1.55rem' }}>Account</span>
          </h1>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Secured with Firebase Email &amp; +91 SMS OTP authentication.
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
                <Phone size={13} /> Firebase SMS OTP
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
                    <span>Indian Mobile Number (+91 fixed · 10 digits)</span>
                    {loginPhoneInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Must be 10 digits (6–9 start)</span>}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {renderPhoneInput(loginDigits, setLoginDigits, loginPhoneInvalid)}
                    <button type="button" onClick={handleSendLoginOtp} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                      <Phone size={14} /> {loginOtpSent ? 'Resend' : 'Send SMS'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="form-label">6-Digit SMS OTP</label>
                  <input
                    required
                    maxLength={6}
                    inputMode="numeric"
                    className="input-field"
                    placeholder="Enter 6-digit SMS OTP"
                    value={loginOtp}
                    onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
                <button type="submit" disabled={busy || !loginOtpSent} className="pill-btn pill-btn-gold" style={{ width: '100%', padding: '12px' }}>
                  <ShieldCheck size={15} /> {busy ? 'Verifying SMS OTP...' : 'Verify OTP & Sign In'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

            <div>
              <label className="form-label">Password (min 6 chars)</label>
              <input
                required
                disabled={emailVerified}
                type="password"
                minLength={6}
                className="input-field"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
              />
            </div>

            {/* Step 1: Firebase Email Verification */}
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Step 1 · Email Address</span>
                {emailInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Invalid email format</span>}
                {emailVerified && <span style={{ color: '#10B981', fontSize: '0.74rem', fontWeight: 700 }}>✓ Verified</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Mail size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    required
                    disabled={emailVerified}
                    type="email"
                    className="input-field"
                    style={{ paddingLeft: 38 }}
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {!emailVerified && (
                  <button type="button" onClick={handleSendEmailVerification} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                    <Mail size={14} /> {emailSent ? 'Resend' : 'Verify Email'}
                  </button>
                )}
              </div>
              {emailSent && !emailVerified && (
                <button
                  type="button"
                  onClick={handleCheckEmailVerified}
                  disabled={busy}
                  className="pill-btn"
                  style={{ width: '100%', marginTop: 8, background: 'var(--accent-gold-soft)', color: '#111827' }}
                >
                  <RefreshCw size={14} /> I Clicked the Link — Check Email Verification
                </button>
              )}
            </div>

            {/* Step 2: Fixed +91 10-digit Mobile + Firebase SMS OTP */}
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Step 2 · Indian Mobile (+91 fixed · 10 digits)</span>
                {signupPhoneInvalid && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>Must be 10 digits (6–9 start)</span>}
                {phoneVerified && <span style={{ color: '#10B981', fontSize: '0.74rem', fontWeight: 700 }}>✓ Verified</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {renderPhoneInput(phoneDigits, setPhoneDigits, signupPhoneInvalid, phoneVerified)}
                {!phoneVerified && (
                  <button type="button" onClick={handleSendSignupSms} disabled={busy} className="pill-btn" style={{ flexShrink: 0 }}>
                    <Phone size={14} /> {smsSent ? 'Resend' : 'Send SMS'}
                  </button>
                )}
              </div>
            </div>

            {smsSent && !phoneVerified && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  maxLength={6}
                  inputMode="numeric"
                  className="input-field"
                  placeholder="Enter 6-digit SMS OTP"
                  value={smsOtp}
                  onChange={(e) => setSmsOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <button type="button" onClick={handleVerifySignupSms} disabled={busy} className="pill-btn pill-btn-dark" style={{ flexShrink: 0 }}>
                  <CheckCircle2 size={14} /> Confirm OTP
                </button>
              </div>
            )}

            {authError && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: '#FEE2E2', color: '#991B1B', fontSize: '0.82rem', lineHeight: 1.45 }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !emailVerified || !phoneVerified}
              className="pill-btn pill-btn-gold"
              style={{ width: '100%', padding: '12px', marginTop: 4 }}
            >
              <ShieldCheck size={15} /> {busy ? 'Creating Account...' : 'Create Verified SERVEO Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
