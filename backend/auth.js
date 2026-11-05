const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// JWT secret must be set in environment - no fallback for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in backend/.env or backend/.env.local');
}
const COOKIE_NAME = 'serveo_token';

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());
}

// Twilio Verify API integration
async function sendTwilioOtp(phone) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    if (process.env.NODE_ENV === 'development' && process.env.DEV_OTP_ALLOW === 'true') {
      console.log(`[DEV MODE] Twilio credentials not set. Simulated OTP 123456 generated for ${phone}.`);
      return { success: true, simulated: true, code: '123456' };
    }
    const err = new Error('SMS verification provider is not configured on this server.');
    err.code = 'SMS_PROVIDER_NOT_CONFIGURED';
    throw err;
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
    if (process.env.NODE_ENV === 'development' && process.env.DEV_OTP_ALLOW === 'true') {
      if (code === '123456') {
        return { approved: true, simulated: true };
      }
      return { approved: false, message: 'Invalid test OTP. Use 123456 in dev mode.' };
    }
    const err = new Error('SMS verification provider is not configured on this server.');
    err.code = 'SMS_PROVIDER_NOT_CONFIGURED';
    throw err;
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

module.exports = {
  normalizeIndianPhone,
  isValidIndianPhone,
  isValidEmail,
  sendTwilioOtp,
  verifyTwilioOtp,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  authenticateOptional,
  authenticateRequired,
  COOKIE_NAME
};
