require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const {
  normalizeIndianPhone,
  isValidIndianPhone,
  isValidEmail,
  sendTwilioOtp,
  verifyTwilioOtp,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  authenticateOptional,
  authenticateRequired
} = require('./auth');

const app = express();
const PORT = process.env.PORT || process.env.SERVEO_PORT || 3000;
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

// Restrict CORS to known origins and local development hosts
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no Origin header) and allowed origins (including any localhost/127.0.0.1 port or file://)
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === 'null') {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} is not allowed`));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
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
      message: result.simulated
        ? 'Test mode enabled: use 123456 as your verification code.'
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

// Step 2: Verify OTP and create user account
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, username, email, phone: rawPhone, code, password, notificationLat, notificationLng, bloodGroup } = req.body;

    if (!name || !username || !email || !rawPhone || !password) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'All fields are required.' });
    }

    const phone = normalizeIndianPhone(rawPhone);
    if (!phone || !isValidIndianPhone(phone)) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'Invalid Indian mobile number.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' });
    }

    // Verify Twilio OTP
    if (!code) {
      return res.status(400).json({ error: 'MISSING_OTP', message: 'SMS verification code is required.' });
    }

    const otpCheck = await verifyTwilioOtp(phone, String(code).trim());
    if (!otpCheck.approved) {
      return res.status(400).json({ error: 'INVALID_OTP', message: otpCheck.message || 'Invalid or expired OTP code.' });
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

// Fast 1-Click Login (Demo Only)
app.post('/api/auth/quick-login', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'DISABLED', message: 'Demo features are disabled in production.' });
  }
  try {
    const role = req.body.role || 'organizer';
    const isOrg = role === 'organizer';
    const ident = isOrg ? 'organizer@redcross.org' : 'volunteer@serveo.in';
    const username = isOrg ? 'redcross' : 'volunteer_demo';
    const name = isOrg ? 'Indian Red Cross Society' : 'Aarav Sharma (Volunteer)';
    const phone = isOrg ? '+919876543210' : '+919876543211';

    let user = await db.findUserByIdentifier(ident) || await db.findUserByIdentifier(username);
    if (!user) {
      const passwordHash = await bcrypt.hash('Password123!', 10);
      user = await db.createUser({
        name,
        username,
        email: ident,
        phone,
        passwordHash,
        isAdmin: isOrg,
        notificationLat: 28.6139,
        notificationLng: 77.2090
      });
    } else if (isOrg && !user.isAdmin) {
      // In dev mode, ensure demo organizer has moderation capabilities
      user.isAdmin = true;
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
        isAdmin: user.isAdmin,
        organizationBanned: user.organizationBanned
      },
      token
    });
  } catch (err) {
    console.error('Quick login error:', err);
    res.status(500).json({ error: 'QUICK_LOGIN_FAILED', message: err.message });
  }
});

// Fast 1-Click Register (Demo Only)
app.post('/api/auth/quick-register', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'DISABLED', message: 'Demo features are disabled in production.' });
  }
  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const isOrg = req.body.role === 'organizer';
    const name = req.body.name || (isOrg ? `Community Organizer ${randomSuffix}` : `Community Member ${randomSuffix}`);
    const username = (req.body.username || `${isOrg ? 'organizer' : 'user'}_${randomSuffix}`).toLowerCase().trim();
    const email = (req.body.email || `user${randomSuffix}@serveo.in`).toLowerCase().trim();
    const phone = req.body.phone ? (normalizeIndianPhone(req.body.phone) || `+9198765${randomSuffix}`) : `+9198765${randomSuffix}`;
    const password = req.body.password || 'Password123!';

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser({
      name,
      username,
      email,
      phone,
      passwordHash,
      isAdmin: isOrg,
      notificationLat: 28.6139,
      notificationLng: 77.2090
    });

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        organizationBanned: user.organizationBanned
      },
      token
    });
  } catch (err) {
    console.error('Quick register error:', err);
    res.status(500).json({ error: 'QUICK_REGISTER_FAILED', message: err.message });
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

app.put('/api/donors/profile', authenticateRequired, async (req, res) => {
  try {
    const bloodGroup = String(req.body.bloodGroup || '').toUpperCase();
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!BLOOD_GROUPS.includes(bloodGroup) || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'INVALID_DONOR_PROFILE', message: 'Choose a valid blood group and share a valid location to receive nearby donor alerts.' });
    }
    await db.updateDonorProfile(req.user.id, bloodGroup, lat, lng);
    res.json({ success: true, bloodGroup });
  } catch (err) {
    res.status(500).json({ error: 'DONOR_PROFILE_FAILED', message: err.message });
  }
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

// List events with filtering and proximity
app.get('/api/events', async (req, res) => {
  try {
    const { status, category, search, urgency, lat, lng, radiusKm } = req.query;
    const events = await db.getEvents({
      status: status || 'approved',
      category,
      search,
      urgency,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      radiusKm: radiusKm ? Number(radiusKm) : null
    });
    res.json(events);
  } catch (err) {
    console.error('Fetch events error:', err);
    res.status(500).json({ error: 'FETCH_EVENTS_FAILED', message: err.message });
  }
});

// Get single event by id
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'FETCH_EVENT_FAILED', message: err.message });
  }
});

// Get contact info for an event
app.get('/api/events/:id/contact', async (req, res) => {
  try {
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
      volunteersNeeded, address, pincode, city, state, district, lat, lng, organizer,
      donationLink, tags, orgType, contact, email
    } = req.body;

    const requiredEventText = [title, description, category, startTime, endTime, address, pincode, city, state, district, organizer];
    if (requiredEventText.some(value => typeof value !== 'string' || !value.trim()) || !date || lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') {
      return res.status(400).json({ error: 'MISSING_EVENT_FIELDS', message: 'Missing required event fields.' });
    }

    if (String(state).length > 120 || String(district).length > 120 || String(city).length > 80 || String(address).length > 250) {
      return res.status(400).json({ error: 'INVALID_EVENT_LOCATION', message: 'State, district, city, or local address is too long.' });
    }
    if (!/^\d{6}$/.test(String(pincode))) {
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

    // Events start as 'pending' — requires admin approval to appear on public map
    const eventStatus = 'pending';

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
      pincode: String(pincode),
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
      verified: req.user?.isAdmin === true || false
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
    // Check authorization: Admin, Organizer, or development mode
    const isAuthorized = req.user.isAdmin || 
      req.user.email?.includes('organizer') || 
      req.user.email?.includes('redcross') || 
      process.env.NODE_ENV === 'development';

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
    const isAuthorized = req.user.isAdmin || 
      req.user.email?.includes('organizer') || 
      req.user.email?.includes('redcross') || 
      process.env.NODE_ENV === 'development';

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
    if (!event) {
      return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'This event is no longer available.' });
    }

    const appId = await db.createVolunteerApplication({
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
      applicationId: appId,
      volunteersJoined: updated?.volunteersJoined
    });
  } catch (err) {
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
    if (!event || (event.organizerId !== req.user.id && !req.user.isAdmin)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const list = await db.getEventVolunteers(req.params.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    databaseMode: db.mode,
    timestamp: new Date().toISOString()
  });
});

// ==================== STATIC WEB APP HOSTING ====================
// Serve frontend static files from `frontend/` (or `serveo/` if present)
const fs = require('fs');
const frontendPath = fs.existsSync(path.join(__dirname, '../frontend'))
  ? path.join(__dirname, '../frontend')
  : path.join(__dirname, '../serveo');

app.use(express.static(frontendPath));

// Clean URLs & friendly route aliases
const htmlRoutes = ['map', 'events', 'event-detail', 'events-detail', 'event', 'post-event', 'organizer', 'organization', 'dashboard', 'impact', 'about', 'seed', 'login', 'premium', 'terms', 'privacy'];
htmlRoutes.forEach(r => {
  app.get(`/${r}`, (req, res) => {
    if (['event', 'events-detail'].includes(r)) {
      return res.sendFile(path.join(frontendPath, 'event-detail.html'));
    }
    if (['organization', 'dashboard'].includes(r)) {
      return res.sendFile(path.join(frontendPath, 'organizer.html'));
    }
    res.sendFile(path.join(frontendPath, `${r}.html`));
  });
});

// Organization login dedicated URL redirects / routes
app.get(['/organization-login', '/organizer-login', '/org-login'], (req, res) => {
  res.redirect('/login.html?role=organizer');
});

// Dynamic event-detail routes: /event/1, /event-detail/1, /events-detail/1
app.get(['/event/:id', '/event-detail/:id', '/events-detail/:id'], (req, res) => {
  res.sendFile(path.join(frontendPath, 'event-detail.html'));
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Fallback to index.html for unrecognized non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ==================== START SERVER ====================
async function start() {
  await db.initialize();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🌍 SERVEO Platform Backend running at http://localhost:${PORT}`);
    console.log(`📡 Real-Time SSE Stream live at /api/events/stream`);
    console.log(`📦 Database Mode: ${db.mode.toUpperCase()}`);
    console.log(`======================================================\n`);
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
