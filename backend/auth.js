const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

// JWT secret must be set in environment - no fallback for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in backend/.env or backend/.env.local');
}
const COOKIE_NAME = 'serveo_token';

// In-memory OTP stores for real 6-digit phone & email OTP verification
const otpStore = new Map();
const emailOtpStore = new Map();
// Track pre-verified emails/phones so signup can skip re-verification
const verifiedEmails = new Map(); // email -> expiresAt
const verifiedPhones = new Map(); // phone -> expiresAt
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const VERIFIED_TTL_MS = 15 * 60 * 1000; // pre-verified flag valid for 15 min

function hashOtp(key, code) {
  return crypto.createHash('sha256').update(`${String(key).toLowerCase()}:${String(code).trim()}`).digest('hex');
}

function issueOtp(store, key, label) {
  const code = String(crypto.randomInt(100000, 1000000));
  store.set(key, {
    hash: hashOtp(key, code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0
  });
  console.log(`[SERVEO ${label} OTP] Generated 6-digit code for ${key}: ${code} (valid 10m)`);
  return code;
}

function checkOtp(store, key, code, label) {
  const cleanCode = String(code || '').trim();
  if (process.env.SERVEO_TEST_MODE === 'true' && process.env.DEV_OTP_ALLOW === 'true' && cleanCode === '123456') {
    return { approved: true, simulated: true };
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    return { approved: false, message: `Enter a valid 6-digit ${label} OTP code.` };
  }
  const entry = store.get(key);
  if (!entry) {
    return { approved: false, message: `No active ${label} OTP found. Please request a new code.` };
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { approved: false, message: `${label} OTP expired. Please request a new 6-digit code.` };
  }
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    store.delete(key);
    return { approved: false, message: `Too many incorrect ${label} OTP attempts. Please request a new code.` };
  }
  const candidateHash = hashOtp(key, cleanCode);
  const match = crypto.timingSafeEqual(Buffer.from(entry.hash, 'hex'), Buffer.from(candidateHash, 'hex'));
  if (!match) {
    entry.attempts += 1;
    return { approved: false, message: `Incorrect ${label} OTP (${OTP_MAX_ATTEMPTS - entry.attempts} attempts left).` };
  }
  store.delete(key);
  return { approved: true, simulated: true };
}

// Normalize Indian phone numbers to E.164: +919876543210
function normalizeIndianPhone(raw) {
  if (!raw) return null;
  let cleaned = String(raw).replace(/[\s\-\(\)]/g, '');
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = '+91' + cleaned;
  } else if (/^91[6-9]\d{9}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  } else if (/^0[6-9]\d{9}$/.test(cleaned)) {
    cleaned = '+91' + cleaned.slice(1);
  }
  return cleaned;
}

function isValidIndianPhone(phone) {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

function isValidEmail(email) {
  const val = String(email || '').trim().toLowerCase();
  if (!val || val.length > 254 || val.includes('..')) return false;
  return /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(val);
}

// Twilio Verify API integration with real 6-digit random OTP fallback
async function sendTwilioOtp(phone) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    const code = issueOtp(otpStore, phone, 'SMS');
    return { success: true, simulated: true, code };
  }

  const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;
  const body = new URLSearchParams({ To: phone, Channel: 'sms' });
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Twilio OTP request failed');
  }

  return { success: true, status: data.status };
}

async function verifyTwilioOtp(phone, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    const result = checkOtp(otpStore, phone, code, 'SMS');
    if (result.approved) {
      verifiedPhones.set(phone, Date.now() + VERIFIED_TTL_MS);
    }
    return result;
  }

  const url = `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`;
  const body = new URLSearchParams({ To: phone, Code: code });
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const data = await res.json();
  if (!res.ok || data.status !== 'approved') {
    return { approved: false, message: data.message || 'Incorrect verification code.' };
  }

  verifiedPhones.set(phone, Date.now() + VERIFIED_TTL_MS);
  return { approved: true, status: data.status };
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      isAdmin: Boolean(user.isAdmin)
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function setAuthCookie(res, token) {
  const isSecure = process.env.COOKIE_SECURE === 'true';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax'
  });
}

function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

function authenticateOptional(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }
  next();
}

function authenticateRequired(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sign in is required to perform this action.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session expired or invalid. Please sign in again.' });
  }
  return next();
}

function createUnsubscribeToken(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const payload = Buffer.from(cleanEmail, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`unsub:${cleanEmail}`).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyUnsubscribeToken(token) {
  const raw = String(token || '').trim();
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  try {
    const cleanEmail = Buffer.from(payload, 'base64url').toString('utf8').trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) return null;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`unsub:${cleanEmail}`).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return cleanEmail;
  } catch {
    return null;
  }
}

async function sendEmailOtp(email, siteOrigin = '') {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const code = issueOtp(emailOtpStore, cleanEmail, 'EMAIL');
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const baseUrl = String(siteOrigin || process.env.SITE_URL || 'http://localhost:3002').replace(/\/+$/, '');
    const unsubToken = createUnsubscribeToken(cleanEmail);
    const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
    const businessLine = process.env.SERVEO_BUSINESS_ADDRESS || 'SERVEO Community Initiative · ABESIT Campus, Ghaziabad, UP 201009, India';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px 18px; background: #f8fafc;">
        <div style="background: #ffffff; padding: 32px 28px; border-radius: 18px; border: 1px solid #e2e8f0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);">
          <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: #111827; color: #facc15; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 14px;">
            SERVEO Community Verification
          </div>
          <h1 style="font-size: 22px; line-height: 1.3; font-weight: 800; color: #0f172a; margin: 0 0 10px;">
            Verify your email address
          </h1>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 22px;">
            Enter this 6-digit one-time verification code in SERVEO to verify <strong>${cleanEmail}</strong>:
          </p>
          <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 14px; padding: 18px 14px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #111827; margin-bottom: 22px;">
            ${code}
          </div>
          <p style="font-size: 13px; line-height: 1.5; color: #475569; margin: 0 0 10px;">
            This code is valid for <strong>10 minutes</strong> and can only be used once.
          </p>
          <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0 0 14px; padding-top: 14px; border-top: 1px solid #f1f5f9;">
            For your security, never share this OTP with anyone. If you did not request verification on SERVEO, you can safely ignore this email.
          </p>
          <p style="font-size: 11px; line-height: 1.5; color: #64748b; margin: 0;">
            ${businessLine}<br/>
            Don't want alert or community emails? <a href="${unsubscribeUrl}" style="color: #0f172a; text-decoration: underline;">Unsubscribe from non-essential emails</a>.
          </p>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'SERVEO Community <onboarding@resend.dev>',
      to: [cleanEmail],
      subject: `${code} is your SERVEO verification code`,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      },
      html,
      text: `Your SERVEO 6-digit email verification code is ${code}. It expires in 10 minutes.\n\n${businessLine}\nUnsubscribe from non-essential emails: ${unsubscribeUrl}`
    });

    if (error) {
      throw new Error(error.message || 'Could not send verification email via Resend.');
    }
    return { success: true, simulated: false, id: data?.id || null };
  }
  return { success: true, simulated: true, code };
}

async function verifyEmailOtp(email, code) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const result = checkOtp(emailOtpStore, cleanEmail, code, 'Email');
  if (result.approved) {
    verifiedEmails.set(cleanEmail, Date.now() + VERIFIED_TTL_MS);
  }
  return result;
}

function isEmailPreVerified(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const exp = verifiedEmails.get(cleanEmail);
  if (!exp) return false;
  if (Date.now() > exp) { verifiedEmails.delete(cleanEmail); return false; }
  return true;
}

function consumeEmailVerification(email) {
  verifiedEmails.delete(String(email || '').trim().toLowerCase());
}

function isPhonePreVerified(phone) {
  const exp = verifiedPhones.get(phone);
  if (!exp) return false;
  if (Date.now() > exp) { verifiedPhones.delete(phone); return false; }
  return true;
}

function consumePhoneVerification(phone) {
  verifiedPhones.delete(phone);
}

module.exports = {
  normalizeIndianPhone,
  isValidIndianPhone,
  isValidEmail,
  sendTwilioOtp,
  verifyTwilioOtp,
  sendEmailOtp,
  verifyEmailOtp,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  isEmailPreVerified,
  consumeEmailVerification,
  isPhonePreVerified,
  consumePhoneVerification,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  authenticateOptional,
  authenticateRequired,
  COOKIE_NAME
};
