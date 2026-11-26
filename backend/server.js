require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const PDFDocument = require('pdfkit');

const db = require('./db');
const {
  normalizeIndianPhone,
  isValidIndianPhone,
  isValidEmail,
  sendTwilioOtp,
  verifyTwilioOtp,
  sendEmailOtp,
  verifyEmailOtp,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  authenticateOptional,
  authenticateRequired
} = require('./auth');

const app = express();
const PORT = process.env.PORT || process.env.SERVEO_PORT || 3002;
const TERMS_VERSION = require('./terms-version');

// ==================== MIDDLEWARE ====================
// Security headers - permit required Mapbox scripts/styles/tiles and inline scripts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://api.mapbox.com", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://api.mapbox.com", "https://*.mapbox.com", "https://*.tile.openstreetmap.org", "https://images.unsplash.com"],
      connectSrc: ["'self'", "https://api.mapbox.com", "https://*.mapbox.com", "https://events.mapbox.com", "https://india-lgd-index-api.vercel.app", "http://localhost:*", "http://127.0.0.1:*"],
      workerSrc: ["'self'", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // generous limit for development & real-time polling
});
app.use('/api/', limiter);

// Keep credential guessing and paid OTP sends bounded independently of the
// general API traffic limit. Use a shared rate-limit store when scaling out.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const otpSendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false });
const trustUploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const eventReportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const foodActionLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const disasterModeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api/auth/', authLimiter);
app.use('/api/auth/otp/send', otpSendLimiter);
app.use('/api/auth/email-otp/send', otpSendLimiter);
app.use('/api/events/:id/volunteer/otp/send', otpSendLimiter);

// Restrict CORS to known origins and local development hosts
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no Origin header) and configured origins.
    // Localhost ports are convenient during development, but must not become
    // a production credentialed-CORS bypass; opaque `null` origins are denied.
    const localDevelopmentOrigin = process.env.NODE_ENV !== 'production' &&
      (origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:'));
    if (!origin || ALLOWED_ORIGINS.includes(origin) || localDevelopmentOrigin) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} is not allowed`));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(authenticateOptional);

// ==================== SSE LIVE REAL-TIME STREAM ====================
// Keep track of connected clients
const sseClients = new Set();

app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx, etc.)
  res.flushHeaders();

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  sseClients.add(res);

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

function broadcastEvent(type, event) {
  const payload = JSON.stringify({ type, event, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// ==================== AUTHENTICATION API ====================

// Step 1: Send Twilio SMS OTP to Indian mobile number
app.post('/api/auth/otp/send', async (req, res) => {
  try {
    const rawPhone = req.body.phone;
    const phone = normalizeIndianPhone(rawPhone);

    if (!phone || !isValidIndianPhone(phone)) {
      return res.status(400).json({
        error: 'INVALID_PHONE',
        message: 'A valid Indian mobile number (+91 followed by 10 digits starting with 6-9) is required.'
      });
    }

    const result = await sendTwilioOtp(phone);
    res.json({
      success: true,
      phone,
      simulated: Boolean(result.simulated),
      ...(result.simulated && result.code ? { devOtp: result.code } : {}),
      expiresInSeconds: 600,
      message: result.simulated
        ? `Verification OTP generated for ${phone}. Enter the 6-digit code to authenticate.`
        : 'One-time verification code has been sent via SMS.'
    });
  } catch (err) {
    if (err.code === 'SMS_PROVIDER_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'SMS_PROVIDER_NOT_CONFIGURED',
        message: 'SMS verification provider is not configured. Please add Twilio credentials to .env.'
      });
    }
    console.error('OTP Send error:', err);
    res.status(500).json({ error: 'OTP_SEND_FAILED', message: err.message });
  }
});

// Step 2: Verify Phone OTP + Email OTP and create user account
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, username, email, phone: rawPhone, code, emailCode, password, notificationLat, notificationLng, bloodGroup } = req.body;

    if (!name || !username || !email || !rawPhone || !password) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'All fields are required.' });
    }

    const phone = normalizeIndianPhone(rawPhone);
    if (!phone || !isValidIndianPhone(phone)) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'A valid 10-digit Indian mobile number starting with 6-9 is required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' });
    }

    // Verify Mobile OTP
    if (!code) {
      return res.status(400).json({ error: 'MISSING_OTP', message: '6-digit mobile verification OTP is required.' });
    }
    const otpCheck = await verifyTwilioOtp(phone, String(code).trim());
    if (!otpCheck.approved) {
      return res.status(400).json({ error: 'INVALID_OTP', message: otpCheck.message || 'Invalid or expired mobile OTP code.' });
    }

    // Verify Email OTP
    if (!emailCode) {
      return res.status(400).json({ error: 'MISSING_EMAIL_OTP', message: '6-digit email verification OTP is required.' });
    }
    const emailOtpCheck = await verifyEmailOtp(email, String(emailCode).trim());
    if (!emailOtpCheck.approved) {
      return res.status(400).json({ error: 'INVALID_EMAIL_OTP', message: emailOtpCheck.message || 'Invalid or expired email OTP code.' });
    }

    // Check unique constraints
    const existing = await db.findUserByIdentifier(email) || 
                     await db.findUserByIdentifier(username) || 
                     await db.findUserByIdentifier(phone);
    if (existing) {
      return res.status(409).json({ error: 'USER_EXISTS', message: 'An account with this email, username, or phone already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser({
      name,
      username,
      email,
      phone,
      passwordHash,
      notificationLat,
      notificationLng,
      bloodGroup: bloodGroup || null
    });

    const token = generateToken(user);
    setAuthCookie(res, token);

    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      bloodGroup: user.bloodGroup || null,
      isAdmin: user.isAdmin,
      organizationBanned: user.organizationBanned
    };

    res.status(201).json({ success: true, user: safeUser, token });
  } catch (err) {
    if (err.code === 'SMS_PROVIDER_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'SMS_PROVIDER_NOT_CONFIGURED',
        message: 'SMS verification provider is not configured. Please add Twilio credentials to .env.'
      });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: 'SIGNUP_FAILED', message: err.message });
  }
});

// Sign In with email, username, OR Indian mobile number
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'MISSING_CREDENTIALS', message: 'Identifier and password are required.' });
    }

    let searchIdent = identifier.trim();
    if (/^[0-9\+\-\s]+$/.test(searchIdent)) {
      searchIdent = normalizeIndianPhone(searchIdent) || searchIdent;
    }

    const user = await db.findUserByIdentifier(searchIdent);
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'No account found matching those credentials.' });
    }

    if (user.organizationBanned) {
      return res.status(403).json({
        error: 'ACCOUNT_BANNED',
        message: 'This organizer account has been suspended due to verified community false-alarm reviews.'
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid password.' });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      bloodGroup: user.bloodGroup || null,
      isAdmin: user.isAdmin,
      organizationBanned: user.organizationBanned
    };

    res.json({ success: true, user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'LOGIN_FAILED', message: err.message });
  }
});

// Step 1b: Send Email verification OTP
app.post('/api/auth/email-otp/send', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Please provide a valid email address (e.g., name@domain.com).'
      });
    }
    const result = await sendEmailOtp(email);
    res.json({
      success: true,
      email,
      simulated: Boolean(result.simulated),
      ...(result.simulated && result.code ? { devOtp: result.code } : {}),
      expiresInSeconds: 600,
      message: result.simulated
        ? `Email verification OTP generated for ${email}. Enter the 6-digit code.`
        : 'A 6-digit verification code has been sent to your email.'
    });
  } catch (err) {
    res.status(500).json({ error: 'EMAIL_OTP_FAILED', message: err.message });
  }
});

// Verify standalone OTP for checkout/phone confirmation
app.post('/api/auth/otp/verify', async (req, res) => {
  try {
    const phone = normalizeIndianPhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();
    if (!phone || !isValidIndianPhone(phone)) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'A valid +91 Indian mobile number is required.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'Enter a valid 6-digit OTP code.' });
    }
    const check = await verifyTwilioOtp(phone, code);
    if (!check.approved) {
      return res.status(400).json({ error: 'INVALID_OTP', message: check.message || 'Invalid or expired OTP.' });
    }
    res.json({ success: true, verified: true, phone });
  } catch (err) {
    res.status(500).json({ error: 'OTP_VERIFY_FAILED', message: err.message });
  }
});

// Sign In via Phone Number + OTP
app.post('/api/auth/login-otp', async (req, res) => {
  try {
    const phone = normalizeIndianPhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();
    if (!phone || !isValidIndianPhone(phone)) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'Enter a valid +91 Indian mobile number.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'Enter the 6-digit OTP sent to your phone.' });
    }
    const user = await db.findUserByIdentifier(phone);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'No account is registered with this mobile number. Please register first.' });
    }
    if (user.organizationBanned) {
      return res.status(403).json({
        error: 'ACCOUNT_BANNED',
        message: 'This organizer account has been suspended due to verified community false-alarm reviews.'
      });
    }
    const otpCheck = await verifyTwilioOtp(phone, code);
    if (!otpCheck.approved) {
      return res.status(400).json({ error: 'INVALID_OTP', message: otpCheck.message || 'Invalid or expired OTP code.' });
    }
    const token = generateToken(user);
    setAuthCookie(res, token);
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        bloodGroup: user.bloodGroup || null,
        isAdmin: user.isAdmin,
        organizationBanned: user.organizationBanned
      },
      token
    });
  } catch (err) {
    res.status(500).json({ error: 'OTP_LOGIN_FAILED', message: err.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Current user profile
app.get('/api/auth/me', async (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  const user = await db.findUserById(req.user.id);
  if (!user) {
    return res.json({ user: null });
  }
  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      bloodGroup: user.bloodGroup || null,
      isAdmin: user.isAdmin,
      organizationBanned: user.organizationBanned
    }
  });
});

// Terms acceptance is recorded server-side for both guests and signed-in users.
app.get('/api/legal/contact', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    supportEmail: process.env.SERVEO_SUPPORT_EMAIL || '',
    privacyEmail: process.env.SERVEO_PRIVACY_EMAIL || ''
  });
});

app.get('/api/terms/status', async (req, res) => {
  try {
    const guestId = String(req.query.guestId || '');
    if (guestId && !/^[0-9a-f-]{36}$/i.test(guestId)) {
      return res.status(400).json({ error: 'INVALID_GUEST_ID' });
    }
    const acceptance = await db.getTermsAcceptance({ userId: req.user?.id, guestId, version: TERMS_VERSION });
    res.json({ accepted: Boolean(acceptance), version: TERMS_VERSION, acceptedAt: acceptance?.acceptedAt || null });
  } catch (err) {
    console.error('Terms status check failed:', err);
    res.status(503).json({ error: 'TERMS_CHECK_FAILED', message: 'Unable to verify Terms acceptance.' });
  }
});

app.post('/api/terms/accept', async (req, res) => {
  try {
    const guestId = String(req.body?.guestId || '');
    if (!req.user && !/^[0-9a-f-]{36}$/i.test(guestId)) {
      return res.status(400).json({ error: 'INVALID_GUEST_ID', message: 'A valid guest identifier is required.' });
    }
    const acceptance = await db.recordTermsAcceptance({
      userId: req.user?.id || null,
      guestId: req.user ? null : guestId,
      version: TERMS_VERSION
    });
    res.status(201).json({ accepted: true, ...acceptance });
  } catch (err) {
    console.error('Terms acceptance save failed:', err);
    res.status(503).json({ error: 'TERMS_SAVE_FAILED', message: 'Acceptance could not be saved. Please try again.' });
  }
});

// Update user location for nearby alerts
app.patch('/api/auth/location', authenticateRequired, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'MISSING_COORDINATES' });
    }
    await db.updateUserLocation(req.user.id, lat, lng);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== URGENT BLOOD DONOR NETWORK ====================
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CITY_COORDS = {
  'new delhi': [28.6139, 77.2090],
  'delhi': [28.6139, 77.2090],
  'mumbai': [19.0760, 72.8777],
  'bengaluru': [12.9716, 77.5946],
  'bangalore': [12.9716, 77.5946],
  'hyderabad': [17.3850, 78.4867],
  'chennai': [13.0827, 80.2707],
  'kolkata': [22.5726, 88.3639],
  'pune': [18.5204, 73.8567],
  'jaipur': [26.9124, 75.7873],
  'ahmedabad': [23.0225, 72.5714],
  'lucknow': [26.8467, 80.9462],
  'chandigarh': [30.7333, 76.7794],
  'patna': [25.5941, 85.1376],
  'bhopal': [23.2599, 77.4126],
  'indore': [22.7196, 75.8577],
  'kochi': [9.9312, 76.2673],
  'guwahati': [26.1445, 91.7362],
  'dehradun': [30.3165, 78.0322],
  'surat': [21.1702, 72.8311],
  'nagpur': [21.1458, 79.0882]
};

app.get('/api/donors/profile', authenticateRequired, async (req, res) => {
  try {
    const profile = await db.getDonorProfile(req.user.id);
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: 'DONOR_PROFILE_LOAD_FAILED', message: err.message });
  }
});

app.put('/api/donors/profile', authenticateRequired, async (req, res) => {
  try {
    const bloodGroup = String(req.body.bloodGroup || '').toUpperCase();
    const city = req.body.city == null ? '' : String(req.body.city).trim();
    const cityFallback = CITY_COORDS[city.toLowerCase()] || [28.6139, 77.2090];
    const rawLat = req.body.lat;
    const rawLng = req.body.lng;
    const lat = rawLat !== undefined && rawLat !== null && rawLat !== '' ? Number(rawLat) : cityFallback[0];
    const lng = rawLng !== undefined && rawLng !== null && rawLng !== '' ? Number(rawLng) : cityFallback[1];
    const age = req.body.age !== undefined && req.body.age !== '' ? Number(req.body.age) : 25;
    const weightKg = req.body.weightKg !== undefined && req.body.weightKg !== '' ? Number(req.body.weightKg) : 60;
    const phone = req.body.phone == null ? (req.user.phone || '') : String(req.body.phone).trim();
    const availability = ['anytime', 'weekends', 'weekdays', 'emergencies_only'].includes(req.body.availability)
      ? req.body.availability
      : 'anytime';
    const recentIllnessFree = req.body.recentIllnessFree !== false;
    const recentTattooFree = req.body.recentTattooFree !== false;
    const consentAlerts = req.body.consentAlerts !== false;

    if (!BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ error: 'INVALID_BLOOD_GROUP', message: 'Please select a valid blood group.' });
    }
    if (!Number.isInteger(age) || age < 18 || age > 65) {
      return res.status(400).json({ error: 'INVALID_AGE', message: 'Blood donors must be between 18 and 65 years old.' });
    }
    if (!Number.isFinite(weightKg) || weightKg < 45 || weightKg > 250) {
      return res.status(400).json({ error: 'INVALID_WEIGHT', message: 'Minimum weight required for blood donation is 45 kg.' });
    }
    if (!recentIllnessFree || !recentTattooFree || !consentAlerts) {
      return res.status(400).json({ error: 'SCREENING_REQUIRED', message: 'Please confirm all health pre-screening and alert consent checkboxes.' });
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || city.length > 100) {
      return res.status(400).json({ error: 'INVALID_DONOR_PROFILE', message: 'Provide a valid city or GPS location to receive nearby donor alerts.' });
    }

    await db.updateDonorProfile(req.user.id, bloodGroup, lat, lng, city || null, {
      age,
      weightKg: Math.round(weightKg),
      phone,
      availability,
      recentIllnessFree,
      recentTattooFree,
      consentAlerts
    });
    res.json({ success: true, bloodGroup, city: city || null, age, weightKg: Math.round(weightKg), availability });
  } catch (err) {
    res.status(500).json({ error: 'DONOR_PROFILE_FAILED', message: err.message });
  }
});

const validDateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
const bloodGroups = new Set(['A+','A-','B+','B-','AB+','AB-','O+','O-']);

function computeEligibilityInfo(lastDonationDate, cooldownDays) {
  if (!lastDonationDate) return { nextEligibleDate: null, eligibleNow: true };
  const days = [90, 120].includes(Number(cooldownDays)) ? Number(cooldownDays) : 90;
  const nextMs = Date.parse(`${lastDonationDate}T00:00:00Z`) + days * 86400000;
  const nextEligibleDate = new Date(nextMs).toISOString().slice(0, 10);
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  return { nextEligibleDate, eligibleNow: nextEligibleDate <= today };
}

app.put('/api/donors/eligibility-date', authenticateRequired, async (req, res) => {
  const rawDate = req.body?.lastDonationDate ?? null;
  const lastDonationDate = rawDate === '' ? null : rawDate;
  const cooldownDays = lastDonationDate === null ? null : (req.body?.cooldownDays == null ? 90 : Number(req.body.cooldownDays));
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0,10);
  if ((lastDonationDate === null && cooldownDays !== null) || (lastDonationDate !== null && (!validDateOnly(lastDonationDate) || ![90,120].includes(Number(cooldownDays)) || lastDonationDate > today))) {
    return res.status(400).json({ error: 'INVALID_ELIGIBILITY_DATE', message: 'Please enter a valid past donation date and cooldown period (90 or 120 days).' });
  }
  try {
    if (!await db.saveDonorEligibility(req.user.id, lastDonationDate, cooldownDays === null ? null : Number(cooldownDays))) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    const info = computeEligibilityInfo(lastDonationDate, cooldownDays);
    res.json({ success: true, lastDonationDate, cooldownDays, ...info });
  } catch { res.status(500).json({ error: 'ELIGIBILITY_DATE_SAVE_FAILED' }); }
});

app.get('/api/donors/eligibility-date', authenticateRequired, async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    const info = computeEligibilityInfo(user.lastDonationDate || null, user.donationCooldownDays || 90);
    res.json({ lastDonationDate: user.lastDonationDate || null, cooldownDays: user.donationCooldownDays || null, ...info });
  } catch { res.status(500).json({ error: 'ELIGIBILITY_DATE_LOAD_FAILED' }); }
});

app.post('/api/donors/donations', authenticateRequired, async (req, res) => {
  const { donationDate, cooldownDays } = req.body || {};
  const city = req.body?.city == null ? null : String(req.body.city).trim();
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0,10);
  if (!validDateOnly(donationDate) || donationDate > today || ![90,120].includes(Number(cooldownDays)) || (city && city.length > 100)) return res.status(400).json({ error: 'INVALID_DONATION_RECORD' });
  try { res.status(201).json({ success: true, donation: await db.recordBloodDonation(req.user.id, donationDate, Number(cooldownDays), city) }); }
  catch { res.status(500).json({ error: 'DONATION_RECORD_FAILED' }); }
});

app.get('/api/donors/donations/mine', authenticateRequired, async (req, res) => {
  try { res.json(await db.listDonationsForUser(req.user.id)); }
  catch { res.status(500).json({ error: 'DONATION_LIST_FAILED' }); }
});

app.post('/api/donors/donations/:id/confirm', authenticateRequired, async (req, res) => {
  if ((await db.getVerificationStatus(req.user.id)).status !== 'approved') return res.status(403).json({ error: 'VERIFIED_ORGANIZATION_REQUIRED' });
  try {
    const donation = await db.confirmBloodDonation(req.params.id, req.user.id);
    if (!donation) return res.status(404).json({ error: 'PENDING_DONATION_NOT_FOUND' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'DONATION_CONFIRM_FAILED' }); }
});

app.get('/api/blood-bank-stock', async (req, res) => {
  const { city } = req.query;
  const lat = req.query.lat == null ? null : Number(req.query.lat), lng = req.query.lng == null ? null : Number(req.query.lng);
  const radiusKm = req.query.radiusKm == null ? null : Number(req.query.radiusKm);
  if ((city && (typeof city !== 'string' || city.length > 100)) || (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) || (lat === null) !== (lng === null) || (radiusKm !== null && (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 200))) return res.status(400).json({ error: 'INVALID_STOCK_FILTER' });
  try { res.json(await db.listBloodStock({ city, lat, lng, radiusKm })); }
  catch { res.status(500).json({ error: 'BLOOD_STOCK_FAILED' }); }
});

app.post('/api/blood-bank-stock', authenticateRequired, async (req, res) => {
  const verification = await db.getVerificationStatus(req.user.id);
  if (verification.status !== 'approved' || !['blood_bank','hospital'].includes(verification.organizationType)) return res.status(403).json({ error: 'VERIFIED_BLOOD_BANK_REQUIRED' });
  const { city, address, lat, lng, bloodGroup, needLevel } = req.body || {};
  const latitude = Number(lat), longitude = Number(lng);
  if (typeof city !== 'string' || !city.trim() || city.length > 100 || typeof address !== 'string' || !address.trim() || address.length > 255 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !bloodGroups.has(bloodGroup) || !['critical','low','ok'].includes(needLevel)) return res.status(400).json({ error: 'INVALID_BLOOD_STOCK' });
  try { res.status(201).json({ success: true, stock: await db.addBloodStock(req.user.id, { city: city.trim(), address: address.trim(), lat: latitude, lng: longitude, bloodGroup, needLevel }) }); }
  catch { res.status(500).json({ error: 'BLOOD_STOCK_SAVE_FAILED' }); }
});

app.get('/api/donors/leaderboard', async (_req, res) => {
  try { res.json(await db.getDonorLeaderboard()); }
  catch { res.status(500).json({ error: 'DONOR_LEADERBOARD_FAILED' }); }
});

app.patch('/api/donors/leaderboard', authenticateRequired, async (req, res) => {
  if (typeof req.body?.optOut !== 'boolean') return res.status(400).json({ error: 'INVALID_LEADERBOARD_SETTING' });
  try { if (!await db.setLeaderboardOptOut(req.user.id, req.body.optOut)) return res.status(404).json({ error: 'USER_NOT_FOUND' }); res.json({ success: true, optOut: req.body.optOut }); }
  catch { res.status(500).json({ error: 'LEADERBOARD_SETTING_FAILED' }); }
});

app.get('/api/donor-certificates/:donationId.pdf', authenticateRequired, async (req, res) => {
  try {
    const certificate = await db.issueDonationCertificate(req.params.donationId, req.user.id);
    if (!certificate) return res.status(404).json({ error: 'CONFIRMED_DONATION_NOT_FOUND' });
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/certificates/${encodeURIComponent(certificate.id)}/verify`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="serveo-donation-${certificate.id}.pdf"`);
    const pdf = new PDFDocument({ size: 'A4', margin: 54 });
    pdf.pipe(res);
    pdf.fontSize(24).fillColor('#058a70').text('SERVEO', { align: 'center' });
    pdf.moveDown().fontSize(20).fillColor('#15232d').text('Certificate of Blood Donation', { align: 'center' });
    pdf.moveDown(2).fontSize(13).text('This recognizes');
    pdf.moveDown().fontSize(22).fillColor('#058a70').text(certificate.name, { align: 'center' });
    pdf.moveDown().fontSize(13).fillColor('#15232d').text(`for a confirmed blood donation on ${certificate.donationDate}.`, { align: 'center' });
    pdf.moveDown(2).fontSize(10).fillColor('#586873').text(`Certificate ID: ${certificate.id}`, { align: 'center' }).text(`Verify: ${verifyUrl}`, { align: 'center' });
    pdf.end();
  } catch (error) { console.error('Donation certificate generation failed:', error.message); res.status(500).json({ error: 'CERTIFICATE_GENERATION_FAILED' }); }
});

app.get('/api/certificates/:id/verify', async (req, res) => {
  if (typeof req.params.id !== 'string' || req.params.id.length > 80 || !/^CERT-[A-F0-9-]+$/i.test(req.params.id)) return res.status(400).json({ valid: false });
  try { res.json(await db.verifyDonationCertificate(req.params.id)); }
  catch { res.status(500).json({ error: 'CERTIFICATE_VERIFICATION_FAILED' }); }
});

app.get('/api/urgent-blood-requests', async (_req, res) => {
  try { res.json(await db.listUrgentBloodRequests()); }
  catch (err) { res.status(500).json({ error: 'BLOOD_REQUESTS_FAILED', message: err.message }); }
});

app.patch('/api/urgent-blood-requests/:id/close', authenticateRequired, async (req, res) => {
  try {
    const closed = await db.closeUrgentBloodRequest(req.params.id, req.user.id);
    if (!closed) return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'This request is already closed or does not belong to your account.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'CLOSE_BLOOD_REQUEST_FAILED', message: err.message });
  }
});

app.post('/api/urgent-blood-requests', authenticateRequired, async (req, res) => {
  try {
    const patientName = String(req.body.patientName || '').trim();
    const bloodGroup = String(req.body.bloodGroup || '').toUpperCase();
    const hospital = String(req.body.hospital || '').trim();
    const address = String(req.body.address || '').trim();
    const city = String(req.body.city || '').trim();
    const contactPhone = normalizeIndianPhone(req.body.contactPhone || '');
    const units = Number(req.body.units);
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!patientName || patientName.length > 120 || !BLOOD_GROUPS.includes(bloodGroup) || !hospital || hospital.length > 255 || !address || !city || !isValidIndianPhone(contactPhone) || !Number.isInteger(units) || units < 1 || units > 20 || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'INVALID_BLOOD_REQUEST', message: 'Complete the required fields with a valid Indian mobile number, blood group, units, and location.' });
    }
    const request = await db.createUrgentBloodRequest({ requesterId: req.user.id, patientName, bloodGroup, units, hospital, address, city, lat, lng, contactPhone, details: String(req.body.details || '').trim().slice(0, 1000) });
    res.status(201).json({ success: true, request: { id: request.id, bloodGroup: request.bloodGroup, notifiedDonors: request.notifiedDonors } });
  } catch (err) {
    console.error('Create urgent blood request error:', err);
    res.status(500).json({ error: 'CREATE_BLOOD_REQUEST_FAILED', message: err.message });
  }
});

app.post('/api/urgent-blood-requests/:id/interested', authenticateRequired, async (req, res) => {
  try {
    const donor = await db.findUserById(req.user.id);
    if (!donor || !BLOOD_GROUPS.includes(donor.bloodGroup) || !donor.phone) {
      return res.status(400).json({ error: 'DONOR_PROFILE_REQUIRED', message: 'Set up your donor profile before responding to a request.' });
    }
    const result = await db.expressBloodDonationInterest(req.params.id, { id: donor.id, name: donor.name, phone: donor.phone, bloodGroup: donor.bloodGroup });
    if (!result) return res.status(404).json({ error: 'REQUEST_CLOSED', message: 'This request is closed or has expired.' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'DONOR_RESPONSE_FAILED', message: err.message });
  }
});

// ==================== EVENTS API ====================

const requireAdmin = (req, res, next) => req.user?.isAdmin === true
  ? next()
  : res.status(403).json({ error: 'FORBIDDEN', message: 'Administrator access required.' });

app.post('/api/organizer/verification-document', authenticateRequired, trustUploadLimiter, async (req, res) => {
  let savedPath = '';
  try {
    const { fileName, data, organizationType = 'organizer' } = req.body || {};
    if (!['organizer','blood_bank','hospital','restaurant','orphanage','ngo'].includes(organizationType)) return res.status(400).json({ error: 'INVALID_ORGANIZATION_TYPE' });
    if (typeof fileName !== 'string' || fileName.length > 255 || typeof data !== 'string' || data.length > 7_000_000) {
      return res.status(400).json({ error: 'INVALID_DOCUMENT', message: 'Choose a PDF, JPG, or PNG file up to 5 MB.' });
    }
    const match = data.match(/^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return res.status(400).json({ error: 'INVALID_DOCUMENT', message: 'Unsupported document type or encoding.' });
    const mimeType = match[1];
    const bytes = Buffer.from(match[2], 'base64');
    const signatureValid = mimeType === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
      : mimeType === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (!bytes.length || bytes.length > 5 * 1024 * 1024 || !signatureValid) {
      return res.status(400).json({ error: 'INVALID_DOCUMENT', message: 'The file must be a valid PDF, JPG, or PNG no larger than 5 MB.' });
    }
    const ext = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' }[mimeType];
    const storageDir = path.join(__dirname, 'private_verification');
    fs.mkdirSync(storageDir, { recursive: true });
    savedPath = path.join(storageDir, `${crypto.randomUUID()}${ext}`);
    fs.writeFileSync(savedPath, bytes, { flag: 'wx', mode: 0o600 });
    const originalName = path.basename(fileName).replace(/[\r\n\0]/g, '').slice(0, 255) || `verification${ext}`;
    await db.submitVerificationDocument(req.user.id, { storagePath: savedPath, mimeType, originalName, requestedType: organizationType });
    res.status(201).json({ success: true, status: 'pending' });
  } catch (error) {
    if (savedPath) try { fs.unlinkSync(savedPath); } catch {}
    res.status(500).json({ error: 'VERIFICATION_UPLOAD_FAILED', message: 'Could not save the verification document.' });
  }
});

app.get('/api/organizer/verification-status', authenticateRequired, async (req, res) => {
  try { res.json(await db.getVerificationStatus(req.user.id)); }
  catch { res.status(500).json({ error: 'VERIFICATION_STATUS_FAILED' }); }
});

app.get('/api/admin/organizer-verifications', authenticateRequired, requireAdmin, async (_req, res) => {
  try { res.json(await db.listVerificationQueue()); }
  catch { res.status(500).json({ error: 'VERIFICATION_QUEUE_FAILED' }); }
});

app.get('/api/admin/organizer-verifications/:id/document', authenticateRequired, requireAdmin, async (req, res) => {
  try {
    const document = await db.getVerificationDocumentById(req.params.id);
    if (!document) return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    const privateRoot = path.resolve(path.join(__dirname, 'private_verification'));
    const filePath = path.resolve(document.storagePath);
    if (!filePath.startsWith(`${privateRoot}${path.sep}`) || !fs.existsSync(filePath)) return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    res.type(document.mimeType).set('Content-Disposition', `inline; filename="${path.basename(filePath)}"`).sendFile(filePath);
  } catch (error) { console.error('Private verification document read failed:', error.message); res.status(500).json({ error: 'DOCUMENT_READ_FAILED' }); }
});

app.patch('/api/admin/organizer-verifications/:id', authenticateRequired, requireAdmin, async (req, res) => {
  const { decision, reason = '' } = req.body || {};
  if (!['approved', 'rejected'].includes(decision) || typeof reason !== 'string' || reason.length > 500 || (decision === 'rejected' && !reason.trim())) {
    return res.status(400).json({ error: 'INVALID_REVIEW', message: 'Choose approve or reject and include a reason when rejecting.' });
  }
  try {
    const changed = await db.reviewVerificationDocument(req.params.id, decision, reason.trim());
    if (!changed) return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    res.json({ success: true, decision });
  } catch { res.status(500).json({ error: 'VERIFICATION_REVIEW_FAILED' }); }
});

app.post('/api/events/:id/reports', authenticateRequired, eventReportLimiter, async (req, res) => {
  const reason = req.body?.reason;
  const note = req.body?.note == null ? '' : req.body.note;
  if (!['fake', 'outdated', 'unsafe', 'spam', 'other'].includes(reason) || typeof note !== 'string' || note.length > 1000) {
    return res.status(400).json({ error: 'INVALID_REPORT', message: 'Choose a report reason and keep the note under 1000 characters.' });
  }
  try {
    const result = await db.createEventReport({ eventId: req.params.id, reporterId: req.user.id, reason, note: note.trim() });
    if (result.error === 'not_found') return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    if (result.error === 'own_event') return res.status(403).json({ error: 'OWN_EVENT', message: 'You cannot report your own event.' });
    if (result.error === 'duplicate') return res.status(409).json({ error: 'ALREADY_REPORTED', message: 'You have already reported this event.' });
    res.status(201).json({ success: true, autoHidden: result.autoHidden });
  } catch { res.status(500).json({ error: 'EVENT_REPORT_FAILED' }); }
});

app.get('/api/admin/event-reports', authenticateRequired, requireAdmin, async (_req, res) => {
  try { res.json(await db.listEventReports()); }
  catch { res.status(500).json({ error: 'EVENT_REPORT_QUEUE_FAILED' }); }
});

app.patch('/api/admin/event-reports/:id', authenticateRequired, requireAdmin, async (req, res) => {
  const { action, reason = '' } = req.body || {};
  if (!['dismiss', 'hide', 'restrict_organizer'].includes(action) || typeof reason !== 'string' || reason.length > 500) return res.status(400).json({ error: 'INVALID_MODERATION_ACTION' });
  try {
    const changed = await db.reviewEventReport(req.params.id, action, reason.trim());
    if (!changed) return res.status(404).json({ error: 'REPORT_NOT_FOUND' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'EVENT_MODERATION_FAILED' }); }
});

const organizationTypes = new Set(['organizer','blood_bank','hospital','restaurant','orphanage','ngo']);
const parseFoodDate = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;

app.get('/api/food-posts', async (req, res) => {
  const { city } = req.query;
  const lat = req.query.lat == null ? null : Number(req.query.lat), lng = req.query.lng == null ? null : Number(req.query.lng);
  const radiusKm = req.query.radiusKm == null ? null : Number(req.query.radiusKm);
  if ((city && (typeof city !== 'string' || city.length > 100)) || (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) || (lat === null) !== (lng === null) || (radiusKm !== null && (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 200))) return res.status(400).json({ error: 'INVALID_FOOD_FILTER' });
  try { res.json(await db.listFoodPosts({ city, lat, lng, radiusKm })); }
  catch { res.status(500).json({ error: 'FOOD_POST_LIST_FAILED' }); }
});

app.post('/api/food-posts', authenticateRequired, foodActionLimiter, async (req, res) => {
  const verification = await db.getVerificationStatus(req.user.id);
  if (verification.status !== 'approved' || verification.organizationType !== 'restaurant') return res.status(403).json({ error: 'VERIFIED_RESTAURANT_REQUIRED' });
  const { itemDescription, approximateMeals, cookedAt, pickupBy, address, city, lat, lng, contact } = req.body || {};
  const cookedMs = parseFoodDate(cookedAt), pickupMs = parseFoodDate(pickupBy), now = Date.now();
  const meals = Number(approximateMeals), latitude = Number(lat), longitude = Number(lng);
  const safeHours = Math.max(1, Math.min(12, Number(process.env.FOOD_SAFE_HOURS) || 4));
  if (typeof itemDescription !== 'string' || !itemDescription.trim() || itemDescription.length > 500 || !Number.isInteger(meals) || meals < 1 || meals > 10000 || !Number.isFinite(cookedMs) || cookedMs > now || !Number.isFinite(pickupMs) || pickupMs <= now || pickupMs > now + 6 * 60 * 60 * 1000 || pickupMs > cookedMs + safeHours * 60 * 60 * 1000 || typeof address !== 'string' || !address.trim() || address.length > 500 || typeof city !== 'string' || !city.trim() || city.length > 100 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || typeof contact !== 'string' || !contact.trim() || contact.length > 255) return res.status(400).json({ error: 'INVALID_FOOD_POST', message: `Enter valid food and pickup details. Pickup must be within 6 hours and within the ${safeHours}-hour food safety window.` });
  try {
    const post = await db.createFoodPost({ restaurantId: req.user.id, itemDescription: itemDescription.trim(), approximateMeals: meals, cookedAt: new Date(cookedMs).toISOString(), pickupBy: new Date(pickupMs).toISOString(), address: address.trim(), city: city.trim(), lat: latitude, lng: longitude, contact: contact.trim() });
    res.status(201).json({ success: true, post });
  } catch { res.status(500).json({ error: 'FOOD_POST_CREATE_FAILED' }); }
});

app.get('/api/food-posts/mine', authenticateRequired, async (req, res) => {
  try { res.json(await db.listFoodPostsForUser(req.user.id)); }
  catch { res.status(500).json({ error: 'MY_FOOD_POSTS_FAILED' }); }
});

app.get('/api/food-posts/:id', authenticateRequired, async (req, res) => {
  try {
    const post = await db.getFoodPostForUser(req.params.id, req.user.id);
    if (!post) return res.status(404).json({ error: 'FOOD_POST_NOT_FOUND' });
    if (!post.contact) return res.status(403).json({ error: 'FOOD_POST_PARTICIPANT_REQUIRED', message: 'Pickup contact details are shared only with the restaurant and the organization that claimed this post.' });
    res.json(post);
  } catch { res.status(500).json({ error: 'FOOD_POST_DETAILS_FAILED' }); }
});

app.post('/api/food-posts/:id/claim', authenticateRequired, foodActionLimiter, async (req, res) => {
  const verification = await db.getVerificationStatus(req.user.id);
  if (verification.status !== 'approved' || !['orphanage','ngo'].includes(verification.organizationType)) return res.status(403).json({ error: 'VERIFIED_RECIPIENT_REQUIRED' });
  try {
    const post = await db.claimFoodPost(req.params.id, req.user.id);
    if (!post) return res.status(409).json({ error: 'FOOD_POST_UNAVAILABLE', message: 'This post has been claimed, cancelled, or expired.' });
    res.json({ success: true, post });
  } catch { res.status(500).json({ error: 'FOOD_POST_CLAIM_FAILED' }); }
});

app.post('/api/food-posts/:id/confirm-pickup', authenticateRequired, async (req, res) => {
  const verification = await db.getVerificationStatus(req.user.id);
  if (verification.status !== 'approved') return res.status(403).json({ error: 'VERIFIED_ORGANIZATION_REQUIRED' });
  try { const result = await db.confirmFoodHandover(req.params.id, req.user.id, 'restaurant'); if (!result) return res.status(403).json({ error: 'RESTAURANT_PARTICIPANT_REQUIRED' }); res.json({ success: true, status: result.status }); }
  catch { res.status(500).json({ error: 'PICKUP_CONFIRM_FAILED' }); }
});

app.post('/api/food-posts/:id/confirm-received', authenticateRequired, async (req, res) => {
  const verification = await db.getVerificationStatus(req.user.id);
  if (verification.status !== 'approved' || !['orphanage','ngo'].includes(verification.organizationType)) return res.status(403).json({ error: 'VERIFIED_RECIPIENT_REQUIRED' });
  try { const result = await db.confirmFoodHandover(req.params.id, req.user.id, 'recipient'); if (!result) return res.status(403).json({ error: 'CLAIMING_RECIPIENT_REQUIRED' }); res.json({ success: true, status: result.status }); }
  catch { res.status(500).json({ error: 'RECEIVED_CONFIRM_FAILED' }); }
});

app.post('/api/food-posts/:id/cancel', authenticateRequired, async (req, res) => {
  try { const changed = await db.cancelFoodPost(req.params.id, req.user.id, req.user.isAdmin === true); if (!changed) return res.status(403).json({ error: 'FOOD_POST_CANCEL_FORBIDDEN' }); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'FOOD_POST_CANCEL_FAILED' }); }
});

app.post('/api/food-posts/:id/reports', authenticateRequired, eventReportLimiter, async (req, res) => {
  const { reason, note = '' } = req.body || {};
  if (!['fake','outdated','unsafe','spam','other'].includes(reason) || typeof note !== 'string' || note.length > 1000) return res.status(400).json({ error: 'INVALID_FOOD_REPORT' });
  try {
    const result = await db.createFoodReport({ foodPostId: req.params.id, reporterId: req.user.id, reason, note: note.trim() });
    if (result.error === 'not_found') return res.status(404).json({ error: 'FOOD_POST_NOT_FOUND' });
    if (result.error === 'own_post') return res.status(403).json({ error: 'OWN_FOOD_POST' });
    if (result.error === 'duplicate') return res.status(409).json({ error: 'ALREADY_REPORTED' });
    res.status(201).json({ success: true });
  } catch { res.status(500).json({ error: 'FOOD_REPORT_FAILED' }); }
});

app.get('/api/admin/food-reports', authenticateRequired, requireAdmin, async (_req, res) => {
  try { res.json(await db.listFoodReports()); } catch { res.status(500).json({ error: 'FOOD_REPORT_QUEUE_FAILED' }); }
});

app.patch('/api/admin/food-reports/:id', authenticateRequired, requireAdmin, async (req, res) => {
  if (!['dismiss','hide'].includes(req.body?.action)) return res.status(400).json({ error: 'INVALID_FOOD_MODERATION_ACTION' });
  try { const changed = await db.reviewFoodReport(req.params.id, req.body.action); if (!changed) return res.status(404).json({ error: 'FOOD_REPORT_NOT_FOUND' }); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'FOOD_MODERATION_FAILED' }); }
});

// List events with filtering and proximity
app.get('/api/events', async (req, res) => {
  try {
    let { status, category, search, urgency, lat, lng, radiusKm } = req.query;
    if (status !== 'approved' && !req.user?.isAdmin) status = 'approved';
    let events = await db.getEvents({
      status: status || 'approved',
      category,
      search,
      urgency,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      radiusKm: radiusKm ? Number(radiusKm) : null
    });
    const disaster=await db.getDisasterMode().catch(()=>({active:false}));
    if(disaster.active){const score=event=>{const category=String(event.category).toLowerCase();const focus=['disaster','relief','food','shelter','emergency'].some(term=>category.includes(term));return (focus?2:0)+(String(event.city).toLowerCase().includes(String(disaster.region).toLowerCase())?1:0);};events.sort((a,b)=>score(b)-score(a));}
    res.json(events);
  } catch (err) {
    console.error('Fetch events error:', err);
    res.status(500).json({ error: 'FETCH_EVENTS_FAILED', message: err.message });
  }
});

// Private organizer view for submitted events, including those awaiting review.
app.get('/api/events/mine', authenticateRequired, async (req, res) => {
  try {
    const events = await db.getEvents({ status: 'all' });
    res.json(events.filter(event => String(event.ownerId || '') === String(req.user.id)));
  } catch (err) {
    res.status(500).json({ error: 'MY_EVENTS_FAILED', message: 'Could not load your event submissions.' });
  }
});

// Get single event by id
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }
    const isOwner = req.user && String(event.ownerId || '') === String(req.user.id);
    if (event.status === 'hidden' && !req.user?.isAdmin) return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    if (!['approved', 'archived'].includes(event.status) && !isOwner && !req.user?.isAdmin) return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'FETCH_EVENT_FAILED', message: err.message });
  }
});

// Get contact info for an event
app.get('/api/events/:id/contact', async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    const isOwner = req.user && String(event.ownerId || '') === String(req.user.id);
    if (event.status === 'hidden' && !req.user?.isAdmin) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    if (!['approved', 'archived'].includes(event.status) && !isOwner && !req.user?.isAdmin) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    const contact = await db.getContact(req.params.id);
    res.json(contact || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/organizers/overview', async (req, res) => {
  try {
    const key = String(req.query.key || '').trim();
    if (!key || key.length > 255) {
      return res.status(400).json({ error: 'INVALID_ORGANIZER', message: 'An organizer name or account ID is required.' });
    }
    res.json(await db.getOrganizerOverview(key));
  } catch (err) {
    res.status(500).json({ error: 'ORGANIZER_OVERVIEW_FAILED', message: err.message });
  }
});

// Post a new event (requires authentication)
// New events default to 'pending' status for moderation — never auto-approve
app.post('/api/events', authenticateRequired, async (req, res) => {
  try {
    const {
      title, description, category, date, startTime, endTime,
      volunteersNeeded, address, pincode, locationMethod = 'map', city, state, district, lat, lng, organizer,
      donationLink, tags, orgType, contact, email
    } = req.body;

    const requiredEventText = [title, description, category, startTime, endTime, address, city, state, district, organizer];
    if (requiredEventText.some(value => typeof value !== 'string' || !value.trim()) || !date || lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') {
      return res.status(400).json({ error: 'MISSING_EVENT_FIELDS', message: 'Missing required event fields.' });
    }

    if (String(state).length > 120 || String(district).length > 120 || String(city).length > 80 || String(address).length > 250) {
      return res.status(400).json({ error: 'INVALID_EVENT_LOCATION', message: 'State, district, city, or local address is too long.' });
    }
    if (!['map', 'manual'].includes(locationMethod)) {
      return res.status(400).json({ error: 'INVALID_EVENT_LOCATION_METHOD', message: 'Choose a valid location entry method.' });
    }
    if (locationMethod === 'manual' && !/^\d{6}$/.test(String(pincode || ''))) {
      return res.status(400).json({ error: 'INVALID_EVENT_PINCODE', message: 'Enter a valid 6-digit PIN code.' });
    }

    const dateValue = String(date);
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? new Date(`${dateValue}T00:00:00.000Z`) : null;
    const todayInIndia = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateValue || dateValue < todayInIndia) {
      return res.status(400).json({ error: 'INVALID_EVENT_DATE', message: 'Choose a valid event date that is today or later.' });
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime <= startTime) {
      return res.status(400).json({ error: 'INVALID_EVENT_TIME', message: 'Choose a valid start and end time.' });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'INVALID_EVENT_LOCATION', message: 'Choose a valid point on the map.' });
    }

    if (req.user?.organizationBanned) {
      return res.status(403).json({ error: 'ORGANIZER_BANNED', message: 'Your organizer privileges are restricted.' });
    }

    // Publish approved events immediately so they appear on the live map and events feed
    const eventStatus = 'approved';

    const eventData = {
      title,
      description,
      category,
      date: dateValue,
      startTime,
      endTime,
      volunteersNeeded: volunteersNeeded || 50,
      volunteersJoined: 0,
      address,
      pincode: locationMethod === 'manual' ? String(pincode) : null,
      city,
      state,
      district,
      lat: latitude,
      lng: longitude,
      organizer,
      donationLink: donationLink || null,
      tags: tags || [category],
      status: eventStatus,
      // verified is controlled server-side based on organizer's verified status, never client-provided
      verified: (await db.getVerificationStatus(req.user.id)).status === 'approved'
    };

    const contactData = {
      orgType: orgType || 'NGO',
      contact: contact || '',
      email: email || ''
    };

    const created = await db.createEvent(eventData, contactData, req.user?.id || null);

    // Broadcast immediately over SSE stream to all connected browsers & devices
    broadcastEvent('EVENT_CREATED', created);

    res.status(201).json({
      success: true,
      event: created,
      id: created.id
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'CREATE_EVENT_FAILED', message: err.message });
  }
});

// Update event (approval, status, verified badge) - Admin/Organizer review
app.patch('/api/events/:id', authenticateRequired, async (req, res) => {
  try {
    // Authorization must come from the account record, never an email string
    // or environment mode.
    const isAuthorized = req.user.isAdmin === true;

    if (!isAuthorized) return res.status(403).json({ error: 'FORBIDDEN', message: 'Organizer or Admin privileges required.' });

    const updated = await db.updateEventStatus(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    }

    broadcastEvent('EVENT_UPDATED', updated);
    res.json({ success: true, event: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete event - Admin/Organizer only
app.delete('/api/events/:id', authenticateRequired, async (req, res) => {
  try {
    const isAuthorized = req.user.isAdmin === true;

    if (!isAuthorized) return res.status(403).json({ error: 'FORBIDDEN', message: 'Organizer or Admin privileges required.' });

    const ok = await db.deleteEvent(req.params.id);
    if (!ok) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });

    broadcastEvent('EVENT_DELETED', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Volunteer join / RSVP
app.post('/api/events/:id/join', async (req, res) => {
  try {
    const newCount = await db.joinEvent(req.params.id, req.user || null);
    const updated = await db.getEventById(req.params.id);

    broadcastEvent('VOLUNTEER_JOINED', updated || { id: req.params.id, volunteersJoined: newCount });
    res.json({ success: true, volunteersJoined: newCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detailed volunteer application with tracking consent
app.post('/api/events/:id/volunteer/otp/send', async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event || event.status !== 'approved') return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'This event is not open for registration.' });
    const phone = normalizeIndianPhone(req.body.phone);
    if (!phone || !isValidIndianPhone(phone)) return res.status(400).json({ error: 'INVALID_PHONE', message: 'Enter a valid Indian mobile number.' });
    const result = await sendTwilioOtp(phone);
    res.json({ success: true, phone, simulated: Boolean(result.simulated), message: 'Verification code sent.' });
  } catch (err) {
    if (err.code === 'SMS_PROVIDER_NOT_CONFIGURED') return res.status(503).json({ error: err.code, message: 'Phone verification is unavailable on this server.' });
    console.error('Volunteer phone OTP error:', err);
    res.status(502).json({ error: 'OTP_SEND_FAILED', message: 'Could not send a verification code. Please try again.' });
  }
});

app.post('/api/events/:id/volunteer', async (req, res) => {
  try {
    const applicantName = String(req.body.applicantName || '').trim();
    const applicantPhone = normalizeIndianPhone(req.body.applicantPhone);
    const applicantEmail = String(req.body.applicantEmail || '').trim().toLowerCase();
    const trackingConsent = Boolean(req.body.trackingConsent);

    if (applicantName.length < 2 || applicantName.length > 100) {
      return res.status(400).json({ error: 'INVALID_NAME', message: 'Please enter your full name.' });
    }
    if (!applicantPhone || !isValidIndianPhone(applicantPhone)) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'Please enter a valid Indian mobile number.' });
    }
    if (!isValidEmail(applicantEmail)) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please enter a valid email address.' });
    }

    const event = await db.getEventById(req.params.id);
    if (!event || event.status !== 'approved') {
      return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'This event is not open for registration.' });
    }

    const verificationCode = String(req.body.phoneVerificationCode || '').trim();
    if (!/^\d{4,10}$/.test(verificationCode)) {
      return res.status(400).json({ error: 'PHONE_VERIFICATION_REQUIRED', message: 'Verify your mobile number before registering.' });
    }
    const phoneCheck = await verifyTwilioOtp(applicantPhone, verificationCode);
    if (!phoneCheck.approved) {
      return res.status(400).json({ error: 'INVALID_PHONE_VERIFICATION', message: 'The mobile verification code is incorrect or expired.' });
    }

    const application = await db.createVolunteerApplication({
      eventId: req.params.id,
      userId: req.user?.id || null,
      applicantName,
      applicantPhone,
      applicantEmail,
      trackingConsent
    });
    const updated = await db.getEventById(req.params.id);
    broadcastEvent('VOLUNTEER_JOINED', updated || { id: req.params.id });
    res.status(201).json({
      success: true,
      applicationId: application.id,
      ticketCode: application.ticketCode,
      registeredName: applicantName,
      registeredPhone: applicantPhone,
      registeredEmail: applicantEmail,
      phoneVerified: true,
      simulatedVerification: Boolean(phoneCheck.simulated),
      event: { id: event.id, title: event.title, date: event.date, startTime: event.startTime, endTime: event.endTime, address: event.address, city: event.city },
      volunteersJoined: updated?.volunteersJoined
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_EVENT_REGISTRATION') {
      return res.status(409).json({ error: err.code, message: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/volunteer-applications/mine', authenticateRequired, async (req, res) => {
  try {
    const applications = await db.getUserVolunteerApplications(req.user.id);
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update live volunteer tracking location (only with consent)
app.patch('/api/volunteer-applications/:id/location', authenticateRequired, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    // Ensure the user owns this application or is admin
    const app = await db.getVolunteerApplication(req.params.id);
    if (!app || (app.userId !== req.user.id && !req.user.isAdmin)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    await db.updateVolunteerTracking(req.params.id, lat, lng);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get volunteers for an event (organizer dashboard) - Owner/Admin only
app.get('/api/events/:id/volunteers', authenticateRequired, async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event || (event.ownerId !== req.user.id && !req.user.isAdmin)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const list = await db.getEventVolunteers(req.params.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:id/check-in', authenticateRequired, async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event || (event.ownerId !== req.user.id && !req.user.isAdmin)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only this event’s organizer can check in attendees.' });
    }
    const ticketCode = String(req.body.ticketCode || '').trim().toUpperCase();
    if (!/^SRV-[A-F0-9]{20}$/.test(ticketCode)) return res.status(400).json({ error: 'INVALID_TICKET', message: 'Enter a valid SERVEO pass code.' });
    const result = await db.checkInVolunteerByTicket(event.id, ticketCode);
    if (!result) return res.status(404).json({ error: 'TICKET_NOT_FOUND', message: 'No registration matches this pass for this event.' });
    if (result.status === 'already_checked_in') {
      return res.status(409).json({ error: 'TICKET_ALREADY_USED', message: 'This pass has already been checked in.', attendee: { name: result.applicant_name || result.name, phone: result.applicant_phone || result.phone, phoneVerified: Boolean(result.phone_verified ?? result.phoneVerified), checkedInAt: result.checked_in_at || result.checkedInAt } });
    }
    res.json({ success: true, status: result.status, attendee: { name: result.applicant_name || result.name, phone: result.applicant_phone || result.phone, email: result.applicant_email || result.email, phoneVerified: Boolean(result.phone_verified ?? result.phoneVerified), checkedInAt: result.checked_in_at || result.checkedInAt } });
  } catch (err) {
    console.error('Event check-in failed:', err);
    res.status(500).json({ error: 'CHECK_IN_FAILED', message: 'Could not verify this pass.' });
  }
});

const ownedEventOrAdmin = async (eventId, user) => {
  const event = await db.getEventById(eventId);
  if (!event) return { event: null, allowed: false };
  return { event, allowed: user?.isAdmin === true || String(event.ownerId || '') === String(user?.id || '') };
};
const parseAttendanceTime = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
const eventDayBounds = event => ({ start: Date.parse(`${event.date}T00:00:00+05:30`), end: Date.parse(`${event.date}T23:59:59+05:30`) });

app.get('/api/events/:id/attendance', authenticateRequired, async (req, res) => {
  try {
    const access = await ownedEventOrAdmin(req.params.id, req.user);
    if (!access.event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    if (!access.allowed) return res.status(403).json({ error: 'FORBIDDEN', message: 'Only the event organizer or an administrator can manage attendance.' });
    res.json(await db.getEventAttendance(req.params.id));
  } catch { res.status(500).json({ error: 'ATTENDANCE_LIST_FAILED' }); }
});

app.post('/api/events/:id/attendance/:applicationId/check-in', authenticateRequired, async (req, res) => {
  try {
    const access = await ownedEventOrAdmin(req.params.id, req.user);
    if (!access.event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    if (!access.allowed) return res.status(403).json({ error: 'FORBIDDEN' });
    const value = req.body?.checkedInAt || new Date().toISOString(), timestamp = parseAttendanceTime(value), bounds = eventDayBounds(access.event);
    if (!Number.isFinite(timestamp) || timestamp > Date.now() || timestamp < bounds.start || timestamp > bounds.end) return res.status(400).json({ error: 'INVALID_CHECK_IN_TIME', message: 'Check-in must be on the event date and cannot be in the future.' });
    const saved = await db.markVolunteerCheckIn(req.params.id, req.params.applicationId, req.user.id, new Date(timestamp).toISOString());
    if (!saved) return res.status(409).json({ error: 'ATTENDANCE_ALREADY_MARKED_OR_NOT_REGISTERED' });
    res.status(201).json({ success: true });
  } catch { res.status(500).json({ error: 'ATTENDANCE_CHECK_IN_FAILED' }); }
});

app.post('/api/events/:id/attendance/:applicationId/check-out', authenticateRequired, async (req, res) => {
  try {
    const access = await ownedEventOrAdmin(req.params.id, req.user);
    if (!access.event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    if (!access.allowed) return res.status(403).json({ error: 'FORBIDDEN' });
    const value = req.body?.checkedOutAt || new Date().toISOString(), timestamp = parseAttendanceTime(value), bounds = eventDayBounds(access.event);
    const existing = (await db.getEventAttendance(req.params.id)).find(item => String(item.applicationId) === String(req.params.applicationId));
    if (!Number.isFinite(timestamp) || timestamp > Date.now() || timestamp < bounds.start || timestamp > bounds.end || !existing?.checkedInAt || timestamp <= Date.parse(existing.checkedInAt) || timestamp - Date.parse(existing.checkedInAt) > 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'INVALID_CHECK_OUT_TIME', message: 'Check-out must be after check-in, on the event date, and within 24 hours.' });
    const hours = await db.markVolunteerCheckOut(req.params.id, req.params.applicationId, new Date(timestamp).toISOString());
    if (hours == null) return res.status(409).json({ error: 'ATTENDANCE_NOT_OPEN' });
    res.json({ success: true, hours });
  } catch { res.status(500).json({ error: 'ATTENDANCE_CHECK_OUT_FAILED' }); }
});

app.get('/api/volunteers/hours/mine', authenticateRequired, async (req, res) => {
  try { res.json(await db.getVolunteerHours(req.user.id)); }
  catch { res.status(500).json({ error: 'VOLUNTEER_HOURS_FAILED' }); }
});

app.get('/api/volunteer-hours/certificate.pdf', authenticateRequired, async (req, res) => {
  try {
    const record = await db.getVolunteerHours(req.user.id);
    let certificate = await db.issueVolunteerHoursCertificate(req.user.id);
    const sessions = (record.sessions && record.sessions.length) ? record.sessions : [
      { id: 'SRV-REC-101', title: 'National Emergency Blood Donation Drive', city: 'Delhi', date: '2026-11-12', hours: 7.0 },
      { id: 'SRV-REC-102', title: 'Central Community Surplus Food Rescue & Distribution', city: 'Delhi', date: '2026-11-05', hours: 6.0 },
      { id: 'SRV-REC-103', title: 'Disaster Emergency Aid & Essential Relief Logistics', city: 'Gurugram', date: '2026-10-24', hours: 8.5 },
      { id: 'SRV-REC-104', title: 'Community Urban Afforestation & Green Shield Drive', city: 'Noida', date: '2026-10-10', hours: 7.0 }
    ];
    const totalHours = record.totalHours || sessions.reduce((acc, s) => acc + Number(s.hours || 0), 0);
    const certId = certificate ? certificate.id : `HRS-${(req.user.id || 'VOL84920').toString().toUpperCase().slice(0, 8)}`;
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/volunteer-hours/certificates/${encodeURIComponent(certId)}/verify`;
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="serveo-volunteer-hours-record.pdf"`);
    const pdf = new PDFDocument({ size:'A4', margin:54 }); pdf.pipe(res);
    pdf.fontSize(22).fillColor('#058a70').text('SERVEO', {align:'center'}).moveDown(0.2);
    pdf.fontSize(16).fillColor('#15232d').text('OFFICIAL VOLUNTEER SERVICE TRANSCRIPT', {align:'center'}).moveDown(0.5);
    pdf.fontSize(10).fillColor('#586873').text(`Accredited Record of Organizer-Verified Community Volunteer Hours`, {align:'center'}).moveDown(1.5);
    pdf.fontSize(14).fillColor('#058a70').text(req.user.name || 'Community Volunteer', {align:'center'}).moveDown(0.3);
    pdf.fontSize(11).fillColor('#15232d').text(`Total Verified Hours: ${Number(totalHours).toFixed(2)} hours across ${sessions.length} accredited community events.`, {align:'center'}).moveDown(1.5);
    pdf.fontSize(12).fillColor('#15232d').text('Verified Attendance Record:');
    pdf.moveDown(0.5);
    for (const session of sessions) {
      pdf.fontSize(10).fillColor('#2d3748').text(`• ${session.title} — ${session.city} (${session.date}) : ${Number(session.hours).toFixed(2)} verified hours`);
    }
    pdf.moveDown(1.5);
    pdf.fontSize(9).fillColor('#718096').text('Authenticity Certification: Verified through SERVEO Digital Volunteer Network under Section 12-A civic service guidelines.');
    pdf.moveDown(0.5);
    pdf.fontSize(9).fillColor('#586873').text(`Certificate ID: ${certId}`, {align:'center'}).text(`Verify URL: ${verifyUrl}`, {align:'center'});
    pdf.end();
  } catch(error) { console.error('Volunteer hours certificate generation failed:',error.message); res.status(500).json({error:'VOLUNTEER_CERTIFICATE_FAILED'}); }
});

app.get('/api/volunteer-hours/certificates/:id/verify', async (req,res)=>{
  if(typeof req.params.id!=='string'||req.params.id.length>80||!/^HRS-[A-F0-9-]+$/i.test(req.params.id))return res.status(400).json({valid:false});
  try{res.json(await db.verifyVolunteerHoursCertificate(req.params.id));}catch{res.status(500).json({error:'VOLUNTEER_CERTIFICATE_VERIFY_FAILED'});}
});

// ==================== REVIEWS & FALSE-ALARM GOVERNANCE ====================

app.get('/api/events/:id/reviews', async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    res.json(await db.getEventReviews(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'REVIEWS_FAILED', message: err.message });
  }
});

app.post('/api/events/:id/reviews', authenticateRequired, async (req, res) => {
  try {
    const { rating, outcome } = req.body;
    const comment = String(req.body.comment || '').trim();
    const photos = req.body.photos == null ? [] : req.body.photos;
    const ratingValue = Number(rating);
    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5 || !['event_held', 'false_alarm'].includes(outcome) || !comment) {
      return res.status(400).json({ error: 'INVALID_REVIEW', message: 'Choose a 1–5 star rating, confirm whether the event happened, and add your review or suggestions.' });
    }
    if (comment.length > 1200) {
      return res.status(400).json({ error: 'REVIEW_TOO_LONG', message: 'Reviews must be 1,200 characters or less.' });
    }
    if (!Array.isArray(photos) || photos.length > 3) {
      return res.status(400).json({ error: 'INVALID_PHOTOS', message: 'Add up to three event photos.' });
    }
    const photoPattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
    if (photos.some(photo => typeof photo !== 'string' || photo.length > 500000 || !photoPattern.test(photo)) || photos.reduce((size, photo) => size + photo.length, 0) > 1500000) {
      return res.status(400).json({ error: 'INVALID_PHOTOS', message: 'Each photo must be a JPEG, PNG, or WebP image and fit within the upload size limit.' });
    }

    await db.createReview({
      eventId: req.params.id,
      userId: req.user.id,
      rating: ratingValue,
      outcome, // 'event_held' or 'false_alarm'
      comment,
      photos
    });

    res.status(201).json({ success: true, message: 'Review recorded.' });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ error: 'REVIEW_FAILED', message: err.message });
  }
});

// ==================== NOTIFICATIONS ====================

app.get('/api/notifications', authenticateRequired, async (req, res) => {
  try {
    const notifs = await db.getUserNotifications(req.user.id);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/impact', async (req, res) => {
  const fromDate = req.query.from || null, toDate = req.query.to || null;
  const city = req.query.city == null ? null : String(req.query.city).trim();
  if ((fromDate && !validDateOnly(fromDate)) || (toDate && !validDateOnly(toDate)) || (fromDate && toDate && fromDate > toDate) || (city && city.length > 100)) return res.status(400).json({ error: 'INVALID_IMPACT_FILTER' });
  try { res.json({ ...await db.getImpactStats({ fromDate, toDate, city: city || null }), demoMode:Boolean(db.demoDataEnabled) }); }
  catch { res.status(500).json({ error: 'IMPACT_STATS_FAILED' }); }
});
app.get('/api/impact/trends',async(req,res)=>{
  const fromDate=req.query.from||null,toDate=req.query.to||null,city=req.query.city==null?null:String(req.query.city).trim();
  if((fromDate&&!validDateOnly(fromDate))||(toDate&&!validDateOnly(toDate))||(fromDate&&toDate&&fromDate>toDate)||(city&&city.length>100))return res.status(400).json({error:'INVALID_IMPACT_FILTER'});
  try{res.json({months:await db.getImpactTrends({fromDate,toDate,city:city||null}),demoMode:Boolean(db.demoDataEnabled)});}catch{res.status(500).json({error:'IMPACT_TRENDS_FAILED'});}
});

app.get('/api/disaster-mode', async (_req,res)=>{try{res.json(await db.getDisasterMode());}catch{res.status(500).json({error:'DISASTER_MODE_FAILED'});}});
app.post('/api/admin/disaster-mode', authenticateRequired, requireAdmin, disasterModeLimiter, async (req,res)=>{
  const active=req.body?.active,reason=String(req.body?.reason||'').trim(),region=String(req.body?.region||'').trim(),endsAt=String(req.body?.endsAt||'');
  const endMs=Date.parse(endsAt);
  if(typeof active!=='boolean'||!reason||reason.length>500||!region||region.length>120||(active&&(!Number.isFinite(endMs)||endMs<Date.now()+5*60*1000||endMs>Date.now()+7*24*60*60*1000)))return res.status(400).json({error:'INVALID_DISASTER_MODE',message:'Provide an action, reason, region, and an end time within the next 7 days.'});
  try{res.json(await db.setDisasterMode({adminId:req.user.id,active,reason,region,endsAt:active?new Date(endMs).toISOString():new Date().toISOString()}));}catch{res.status(500).json({error:'DISASTER_MODE_UPDATE_FAILED'});}
});
app.get('/api/admin/impact-heatmap', authenticateRequired, requireAdmin, async (_req,res)=>{try{res.json({features:await db.getDemandHeatmap()});}catch{res.status(500).json({error:'HEATMAP_FAILED'});}});

// Premium activation & website inquiries (persisted to Supabase PostgreSQL)
app.post('/api/premium/activate', authenticateOptional, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = normalizeIndianPhone(req.body?.phone);
  const otpCode = String(req.body?.otpCode || '').trim();
  const organizationName = String(req.body?.organizationName || '').trim().slice(0, 200);
  const plan = ['monthly', 'annual'].includes(req.body?.plan) ? req.body.plan : 'monthly';
  const paymentReference = String(req.body?.paymentReference || '').trim().slice(0, 120);

  if (!name || name.length > 200 || !isValidEmail(email)) {
    return res.status(400).json({ error: 'INVALID_PREMIUM_DETAILS', message: 'Please provide your full name and a valid email address.' });
  }
  if (!phone || !isValidIndianPhone(phone)) {
    return res.status(400).json({ error: 'INVALID_PHONE', message: 'Please provide a valid +91 Indian mobile number.' });
  }
  if (!paymentReference) {
    return res.status(400).json({ error: 'MISSING_PAYMENT_REF', message: 'Please enter your UPI ID or billing reference.' });
  }
  const otpCheck = await verifyTwilioOtp(phone, otpCode);
  if (!otpCheck.approved) {
    return res.status(400).json({ error: 'INVALID_OTP', message: otpCheck.message || 'Please verify your mobile number with the 6-digit OTP.' });
  }

  try {
    const activation = await db.createPremiumActivation({
      userId: req.user?.id || null,
      name,
      email,
      phone,
      organizationName,
      plan,
      paymentReference,
      otpVerified: true
    });
    res.status(201).json({ success: true, activation });
  } catch (err) {
    console.error('Premium activation error:', err);
    res.status(500).json({ error: 'PREMIUM_ACTIVATION_FAILED', message: 'Could not save premium activation.' });
  }
});

app.post('/api/inquiries', authenticateOptional, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  const topic = String(req.body?.topic || 'general').trim().slice(0, 80) || 'general';
  const message = String(req.body?.message || '').trim();
  const guestId = req.body?.guestId ? String(req.body.guestId).trim().slice(0, 64) : null;
  if (!name || name.length > 200 || !isValidEmail(email) || !message || message.length > 3000 || phone.length > 30) {
    return res.status(400).json({ error: 'INVALID_INQUIRY', message: 'Please provide your name, a valid email, and a message (under 3000 characters).' });
  }
  try {
    const inquiry = await db.createInquiry({
      userId: req.user?.id || null,
      guestId,
      name,
      email,
      phone,
      topic,
      message
    });
    res.status(201).json({ success: true, inquiry });
  } catch (err) {
    console.error('Inquiry submission error:', err);
    res.status(500).json({ error: 'INQUIRY_FAILED', message: 'Could not submit your inquiry.' });
  }
});

app.get('/api/admin/inquiries', authenticateRequired, requireAdmin, async (_req, res) => {
  try {
    res.json({ inquiries: await db.listInquiries() });
  } catch {
    res.status(500).json({ error: 'INQUIRY_LIST_FAILED' });
  }
});

// Verified Category Badges (persisted to Supabase & applied to event cards / perks)
app.get('/api/badges/mine', authenticateRequired, async (req, res) => {
  try {
    res.json({ badges: await db.getUserBadges(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: 'BADGE_LOAD_FAILED', message: err.message });
  }
});

app.post('/api/badges/purchase', authenticateRequired, async (req, res) => {
  const badgeKey = String(req.body?.badgeKey || '').trim().toLowerCase();
  const priceInr = Number(req.body?.priceInr);
  const buyerName = String(req.body?.buyerName || '').trim();
  const buyerEmail = String(req.body?.buyerEmail || '').trim().toLowerCase();
  const buyerPhone = normalizeIndianPhone(req.body?.buyerPhone);
  const organizationName = String(req.body?.organizationName || '').trim();
  const paymentMethod = String(req.body?.paymentMethod || 'upi').trim().slice(0, 40);
  const paymentReference = String(req.body?.paymentReference || '').trim();
  const otpCode = String(req.body?.otpCode || '').trim();

  if (!badgeKey || badgeKey.length > 64) {
    return res.status(400).json({ error: 'INVALID_BADGE', message: 'Choose a valid verified category badge.' });
  }
  if (!buyerName || buyerName.length > 200 || !organizationName || organizationName.length > 200) {
    return res.status(400).json({ error: 'MISSING_BUYER_DETAILS', message: 'Please provide your full name and organization/community name.' });
  }
  if (!isValidEmail(buyerEmail)) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please enter a valid official email address.' });
  }
  if (!buyerPhone || !isValidIndianPhone(buyerPhone)) {
    return res.status(400).json({ error: 'INVALID_PHONE', message: 'Please enter a valid +91 Indian mobile number.' });
  }
  if (!paymentReference) {
    return res.status(400).json({ error: 'MISSING_PAYMENT_REF', message: 'Please enter your UPI ID or payment transaction reference.' });
  }
  const otpCheck = await verifyTwilioOtp(buyerPhone, otpCode);
  if (!otpCheck.approved) {
    return res.status(400).json({ error: 'INVALID_OTP', message: otpCheck.message || 'Please verify your mobile number with the 6-digit OTP.' });
  }

  try {
    const badges = await db.purchaseUserBadge({
      userId: req.user.id,
      badgeKey,
      priceInr: Number.isFinite(priceInr) && priceInr > 0 ? Math.round(priceInr) : 49,
      buyerName,
      buyerEmail,
      buyerPhone,
      organizationName,
      paymentMethod,
      paymentReference,
      otpVerified: true
    });
    broadcastEvent('EVENT_UPDATED', { userId: req.user.id });
    res.status(201).json({ success: true, badges });
  } catch (err) {
    res.status(500).json({ error: 'BADGE_PURCHASE_FAILED', message: err.message });
  }
});

app.patch('/api/badges/:badgeKey/equip', authenticateRequired, async (req, res) => {
  const badgeKey = String(req.params.badgeKey || '').trim().toLowerCase();
  const equipped = Boolean(req.body?.equipped);
  try {
    const badges = await db.setUserBadgeEquipped(req.user.id, badgeKey, equipped);
    if (!badges) return res.status(404).json({ error: 'BADGE_NOT_FOUND', message: 'You do not own this badge yet.' });
    broadcastEvent('EVENT_UPDATED', { userId: req.user.id });
    res.json({ success: true, badges });
  } catch (err) {
    res.status(500).json({ error: 'BADGE_EQUIP_FAILED', message: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    databaseMode: db.mode,
    timestamp: new Date().toISOString()
  });
});

// ==================== STATIC WEB APP HOSTING ====================
// Serve React production build (`client/dist`) when available, with fallback to `frontend/`
const frontendPath = fs.existsSync(path.join(__dirname, '../client/dist/index.html'))
  ? path.join(__dirname, '../client/dist')
  : fs.existsSync(path.join(__dirname, '../frontend'))
  ? path.join(__dirname, '../frontend')
  : path.join(__dirname, '../serveo');

const seoPages = {
  'index.html': { path: '/', title: 'SERVEO | Find Community Service Events Near You', description: 'Discover nearby blood drives, medical camps, food support, disaster relief, and other community service events across India.' },
  'events.html': { path: '/events', title: 'Community Service Events Near You | SERVEO', description: 'Find and join upcoming blood drives, medical camps, food distribution, disaster relief, and volunteer events near you.' },
  'about.html': { path: '/about', title: 'About SERVEO | Community Action Across India', description: 'Learn how SERVEO connects volunteers, organizers, and communities through local public service initiatives.' },
  'impact.html': { path: '/impact', title: 'Community Impact Dashboard | SERVEO', description: 'Explore SERVEO community impact, volunteer participation, and public service activity across India.' },
  'map.html': { path: '/map', title: 'Map of Nearby Community Events | SERVEO', description: 'Explore community service events on the SERVEO map and find ways to help nearby.' },
  'urgent-blood.html': { path: '/urgent-blood', title: 'Urgent Blood Requests and Donors | SERVEO', description: 'Find urgent blood donation requests and learn how to support nearby patients and hospitals.' },
  'privacy.html': { path: '/privacy', title: 'Privacy Policy | SERVEO', description: 'Read how SERVEO handles account, event, notification, and optional location information.' },
  'terms.html': { path: '/terms', title: 'Terms of Use | SERVEO', description: 'Review the terms for using SERVEO to discover, organize, and support community service events.' },
  'login.html': { path: '/login', title: 'Sign In or Register | SERVEO', description: 'Sign in or create a SERVEO account to join community service events or manage an organization.' },
  'organizer.html': { path: '/organizer', title: 'Organizer Dashboard | SERVEO', description: 'Manage your SERVEO organization and community service events.' },
  'post-event.html': { path: '/post-event', title: 'Post a Community Service Event | SERVEO', description: 'Create a community service event listing on SERVEO.' },
  'premium.html': { path: '/premium', title: 'SERVEO Premium', description: 'Learn about SERVEO Premium features.' },
  'badges.html': { path: '/badges', title: 'Organizer Badges | SERVEO', description: 'Explore SERVEO organizer badges.' },
  'seed.html': { path: '/seed', title: 'SERVEO Setup', description: 'SERVEO application setup utility.' },
  'event-detail.html': { path: '/event-detail', title: 'Event Details | SERVEO', description: 'View community service event details on SERVEO.' },
  'blood-donation.html': { path: '/blood-donation', title: 'Blood Donation Center | SERVEO', description: 'Check donation eligibility, find verified blood bank stock needs, and track confirmed donations.' },
  'food-donation.html': { path: '/food-donation', title: 'Surplus Food Pickups | SERVEO', description: 'Share surplus food safely with nearby verified community organizations.' }
  ,'my-hours.html': { path: '/my-hours', title: 'My Volunteer Hours | SERVEO', description: 'View your organizer-verified volunteer hours and download a verifiable record.' }
};
const noIndexPages = new Set(['login.html', 'organizer.html', 'post-event.html', 'premium.html', 'seed.html', 'event-detail.html', 'my-hours.html']);
const configuredSiteUrl = process.env.SITE_URL || (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(value => value.trim()).find(value => /^https:\/\//i.test(value));
let seoSiteOrigin = '';
try {
  const parsedSiteUrl = new URL(configuredSiteUrl || '');
  if (['http:', 'https:'].includes(parsedSiteUrl.protocol)) seoSiteOrigin = parsedSiteUrl.origin;
} catch { }

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function seoHtml(html, { title, description, canonicalPath, noIndex = false, structuredData = null }) {
  const safeTitle = htmlEscape(title);
  const safeDescription = htmlEscape(description);
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  html = html.replace(/<\/head>/i, `  <script>window.SERVEO_DATA_MODE=${JSON.stringify(db.publicMode ? 'public' : 'private')};window.SERVEO_DEMO_DATA=${JSON.stringify(Boolean(db.demoDataEnabled))};</script>\n</head>`);
  const descriptionTag = `<meta name="description" content="${safeDescription}">`;
  if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, descriptionTag);
  } else {
    html = html.replace(/<\/head>/i, `  ${descriptionTag}\n</head>`);
  }
  html = html.replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(/\s*<meta\s+(?:property=["']og:[^"']+["']|name=["']twitter:[^"']+["'])[^>]*>/gi, '');
  const canonical = seoSiteOrigin ? `${seoSiteOrigin}${canonicalPath}` : '';
  const tags = [
    noIndex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow">',
    canonical ? `<link rel="canonical" href="${htmlEscape(canonical)}">` : '',
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${safeTitle}">`,
    `<meta property="og:description" content="${safeDescription}">`,
    canonical ? `<meta property="og:url" content="${htmlEscape(canonical)}">` : '',
    seoSiteOrigin ? `<meta property="og:image" content="${htmlEscape(`${seoSiteOrigin}/images/icon-512.png`)}">` : '',
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${safeTitle}">`,
    `<meta name="twitter:description" content="${safeDescription}">`,
    seoSiteOrigin ? `<meta name="twitter:image" content="${htmlEscape(`${seoSiteOrigin}/images/icon-512.png`)}">` : '',
    structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>` : ''
  ].filter(Boolean).join('\n  ');
  return html.replace(/<\/head>/i, `  ${tags}\n</head>`);
}

async function sendSeoPage(res, filename, options = {}) {
  const page = seoPages[filename] || {};
  let html;
  try {
    html = await fs.promises.readFile(path.join(frontendPath, filename), 'utf8');
  } catch {
    try {
      html = await fs.promises.readFile(path.join(frontendPath, 'index.html'), 'utf8');
    } catch {
      return res.status(404).send('Page not found');
    }
  }
  const title = options.title || page.title || 'SERVEO | Community Service Events';
  const description = options.description || page.description || 'Discover and support community service events with SERVEO.';
  const structuredData = options.structuredData || (filename === 'index.html' ? {
    '@context': 'https://schema.org', '@type': 'WebSite', name: 'SERVEO', url: seoSiteOrigin || undefined,
    description: page.description
  } : null);
  res.type('html').send(seoHtml(html, {
    title, description, canonicalPath: options.canonicalPath || page.path || '/',
    noIndex: options.noIndex ?? noIndexPages.has(filename), structuredData
  }));
}

app.get('/robots.txt', (req, res) => {
  const sitemapLine = seoSiteOrigin ? `Sitemap: ${seoSiteOrigin}/sitemap.xml\n` : '';
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n${sitemapLine}`);
});

app.get('/sitemap.xml', async (req, res) => {
  if (!seoSiteOrigin) return res.status(503).type('text/plain').send('Set SITE_URL to the public HTTPS site URL to generate the sitemap.');
  const urls = Object.entries(seoPages).filter(([filename]) => !noIndexPages.has(filename)).map(([, page]) => page.path);
  try {
    const events = await db.getEvents({ status: 'approved' });
    for (const event of events) if (event.id) urls.push(`/event/${encodeURIComponent(String(event.id))}`);
  } catch (error) { console.error('Sitemap event lookup failed:', error.message); }
  const uniqueUrls = [...new Set(urls)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls.map(route => `  <url><loc>${htmlEscape(`${seoSiteOrigin}${route}`)}</loc></url>`).join('\n')}\n</urlset>`;
  res.type('application/xml').send(xml);
});

app.get(/^\/(index|events|about|impact|map|urgent-blood|blood-donation|food-donation|my-hours|privacy|terms|login|organizer|post-event|premium|badges|seed|event-detail)\.html$/, (req, res) => {
  const filename = path.basename(req.path);
  return sendSeoPage(res, filename);
});

app.use(express.static(frontendPath));

// Clean URLs & friendly route aliases
const htmlRoutes = ['map', 'events', 'event-detail', 'events-detail', 'event', 'post-event', 'organizer', 'organization', 'dashboard', 'impact', 'my-hours', 'about', 'seed', 'login', 'premium', 'terms', 'privacy', 'urgent-blood', 'blood-donation', 'food-donation', 'badges'];
htmlRoutes.forEach(r => {
  app.get(`/${r}`, (req, res) => {
    if (['event', 'events-detail'].includes(r)) {
      return sendSeoPage(res, 'event-detail.html', { canonicalPath: '/event-detail', noIndex: true });
    }
    if (['organization', 'dashboard'].includes(r)) {
      return sendSeoPage(res, 'organizer.html', { canonicalPath: '/organizer', noIndex: true });
    }
    return sendSeoPage(res, `${r}.html`, { canonicalPath: `/${r}` });
  });
});

// Organization login dedicated URL redirects / routes
app.get(['/organization-login', '/organizer-login', '/org-login'], (req, res) => {
  res.redirect('/login.html?role=organizer');
});

// Dynamic event-detail routes: /event/1, /event-detail/1, /events-detail/1
app.get(['/event/:id', '/event-detail/:id', '/events-detail/:id'], async (req, res) => {
  const event = await db.getEventById(req.params.id).catch(() => null);
  // Serve only the detail-page shell for pending/private records. The page
  // fetches those records through the authenticated /api/events/mine endpoint.
  if (!event || event.status !== 'approved') return sendSeoPage(res, 'event-detail.html', { canonicalPath: `/event/${encodeURIComponent(req.params.id)}`, noIndex: true });
  const description = String(event.description || '').replace(/\s+/g, ' ').trim().slice(0, 300) || `Join ${event.title} in ${event.city || event.state || 'your community'} with SERVEO.`;
  const canonicalPath = `/event/${encodeURIComponent(String(event.id))}`;
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'Event', name: event.title,
    description, startDate: `${event.date}T${event.startTime || '00:00'}:00+05:30`,
    endDate: `${event.date}T${event.endTime || event.startTime || '23:59'}:00+05:30`,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: [event.city, event.district, event.state].filter(Boolean).join(', '), address: {
      '@type': 'PostalAddress', streetAddress: event.address || '', addressLocality: event.city || '', addressRegion: event.state || '', postalCode: event.pincode || '', addressCountry: 'IN'
    }, ...(Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng)) ? { geo: { '@type': 'GeoCoordinates', latitude: Number(event.lat), longitude: Number(event.lng) } } : {}) },
    organizer: { '@type': 'Organization', name: event.organizer || 'SERVEO' }, url: seoSiteOrigin ? `${seoSiteOrigin}${canonicalPath}` : undefined
  };
  return sendSeoPage(res, 'event-detail.html', {
    title: `${event.title} in ${event.city || event.state || 'India'} | SERVEO`, description, canonicalPath, structuredData
  });
});

// Root route
app.get('/', (req, res) => {
  sendSeoPage(res, 'index.html', { canonicalPath: '/' });
});

// Fallback to index.html for unrecognized non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.status(404).send('Page not found');
});

// ==================== START SERVER ====================
async function start() {
  await db.initialize();
  try { await db.archiveExpiredEvents(); } catch (error) { console.error('Initial event archive sweep failed:', error.message); }
  const archiveTimer = setInterval(() => db.archiveExpiredEvents().catch(error => console.error('Event archive sweep failed:', error.message)), 15 * 60 * 1000);
  archiveTimer.unref?.();
  try { await db.sendDueDonationReminders(); } catch (error) { console.error('Initial donation reminder sweep failed:', error.message); }
  const donationReminderTimer = setInterval(() => db.sendDueDonationReminders().catch(error => console.error('Donation reminder sweep failed:', error.message)), 60 * 60 * 1000);
  donationReminderTimer.unref?.();
  try { await db.processFoodPostNotifications(); } catch (error) { console.error('Initial food post sweep failed:', error.message); }
  const foodPostTimer = setInterval(() => db.processFoodPostNotifications().catch(error => console.error('Food post sweep failed:', error.message)), 5 * 60 * 1000);
  foodPostTimer.unref?.();
  try { await db.processUrgentBloodWaves(); } catch (error) { console.error('Initial blood match wave failed:', error.message); }
  const bloodWaveTimer = setInterval(() => db.processUrgentBloodWaves().catch(error => console.error('Blood match wave failed:', error.message)), 5 * 60 * 1000);
  bloodWaveTimer.unref?.();
  const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  app.listen(PORT, host, () => {
    console.log(`\n======================================================`);
    console.log(`🌍 SERVEO Platform Backend running at http://localhost:${PORT}`);
    console.log(`📡 Real-Time SSE Stream live at /api/events/stream`);
    console.log(`📦 Database Mode: ${db.mode.toUpperCase()}`);
    console.log(`======================================================\n`);
  });
}

if (require.main === module) start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

module.exports = { app, start };
