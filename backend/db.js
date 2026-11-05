const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { INITIAL_EVENTS, INITIAL_CONTACTS } = require('./seeds');

// Haversine formula to compute distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class DatabaseManager {
  constructor() {
    this.mode = 'postgres'; // 'postgres' or 'fallback'
    this.pool = null;
    this.fallbackFile = path.join(__dirname, 'data', 'serveo-db.json');
    this.fallbackData = null;
  }

  async initialize() {
    // Automated tests must never connect to a developer's or production database.
    if (process.env.SERVEO_TEST_MODE === 'true') {
      this.mode = 'fallback';
      this.initFallback();
      return;
    }

    const databaseUrl = process.env.DATABASE_URL || 
      `postgres://${process.env.POSTGRES_USER || 'serveo'}:${process.env.POSTGRES_PASSWORD || 'serveo-local-only'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'serveo'}`;

    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 3000,
      });

      // Test connection
      const client = await this.pool.connect();
      client.release();
      this.mode = 'postgres';
      console.log('✅ Connected to PostgreSQL database');

      // Initialize schema
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await this.pool.query(schemaSql);
      }

      // Check if events table needs initial seeding
      const res = await this.pool.query('SELECT COUNT(*) FROM events');
      if (parseInt(res.rows[0].count, 10) === 0) {
        console.log('🌱 Seeding initial 18 public-service events into PostgreSQL...');
        for (const ev of INITIAL_EVENTS) {
          await this.pool.query(
            `INSERT INTO events (id, title, category, organizer, verified, city, address, lat, lng, date, start_time, end_time, volunteers_needed, volunteers_joined, urgency, description, donation_link, tags, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             ON CONFLICT (id) DO NOTHING`,
            [
              ev.id, ev.title, ev.category, ev.organizer, ev.verified,
              ev.city, ev.address, ev.lat, ev.lng, ev.date,
              ev.startTime, ev.endTime, ev.volunteersNeeded, ev.volunteersJoined,
              ev.urgency, ev.description, ev.donationLink, ev.tags || [], ev.status || 'approved'
            ]
          );

          const contact = INITIAL_CONTACTS[ev.id];
          if (contact) {
            await this.pool.query(
              `INSERT INTO event_contacts (event_id, org_type, contact, email)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (event_id) DO NOTHING`,
              [ev.id, contact.orgType, contact.contact, contact.email]
            );
          }
        }
        console.log('✅ PostgreSQL seeding complete.');
      }
    } catch (err) {
      console.warn(`⚠️ PostgreSQL connection not available (${err.message}).`);
      console.log('🔄 Initializing embedded persistent local datastore (backend/data/serveo-db.json)...');
      this.mode = 'fallback';
      this.initFallback();
    }
  }

  initFallback() {
    const dataDir = path.dirname(this.fallbackFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(this.fallbackFile)) {
      try {
        this.fallbackData = JSON.parse(fs.readFileSync(this.fallbackFile, 'utf8'));
      } catch (e) {
        this.fallbackData = null;
      }
    }

    if (!this.fallbackData || !this.fallbackData.events || this.fallbackData.events.length === 0) {
      this.fallbackData = {
        users: [],
        events: JSON.parse(JSON.stringify(INITIAL_EVENTS)),
        event_contacts: JSON.parse(JSON.stringify(INITIAL_CONTACTS)),
        volunteer_applications: [],
        attendance: [],
        event_reviews: [],
        notifications: [],
        urgent_blood_requests: [],
        urgent_blood_offers: []
      };
      this.saveFallback();
      console.log('🌱 Seeded 18 public welfare events into local database file.');
    }
    if (!Array.isArray(this.fallbackData.event_reviews)) this.fallbackData.event_reviews = [];
    if (!Array.isArray(this.fallbackData.notifications)) this.fallbackData.notifications = [];
    if (!Array.isArray(this.fallbackData.urgent_blood_requests)) this.fallbackData.urgent_blood_requests = [];
    if (!Array.isArray(this.fallbackData.urgent_blood_offers)) this.fallbackData.urgent_blood_offers = [];
    if (!Array.isArray(this.fallbackData.terms_acceptances)) this.fallbackData.terms_acceptances = [];
    console.log('✅ Local persistent datastore ready.');
  }

  saveFallback() {
    try {
      fs.writeFileSync(this.fallbackFile, JSON.stringify(this.fallbackData, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save fallback data:', e);
    }
  }

  async getTermsAcceptance({ userId, guestId, version }) {
    if (this.mode === 'postgres') {
      if (userId) {
        const userResult = await this.pool.query(
          'SELECT terms_version, accepted_at FROM terms_acceptances WHERE user_id = $1 AND terms_version = $2 LIMIT 1',
          [String(userId), version]
        );
        if (userResult.rows[0]) return { version: userResult.rows[0].terms_version, acceptedAt: userResult.rows[0].accepted_at };
      }
      if (!guestId) return null;
      const guestResult = await this.pool.query(
        'SELECT terms_version, accepted_at FROM terms_acceptances WHERE guest_id = $1 AND terms_version = $2 LIMIT 1',
        [guestId, version]
      );
      if (!guestResult.rows[0]) return null;
      if (userId) {
        await this.pool.query(
          'UPDATE terms_acceptances SET user_id = $1, guest_id = NULL WHERE guest_id = $2 AND terms_version = $3 AND NOT EXISTS (SELECT 1 FROM terms_acceptances WHERE user_id = $1 AND terms_version = $3)',
          [String(userId), guestId, version]
        );
      }
      return { version: guestResult.rows[0].terms_version, acceptedAt: guestResult.rows[0].accepted_at };
    }

    const records = this.fallbackData.terms_acceptances || [];
    let record = userId && records.find(item => item.userId === String(userId) && item.termsVersion === version);
    if (!record && guestId) record = records.find(item => item.guestId === guestId && item.termsVersion === version);
    if (record && userId && record.guestId === guestId) {
      const alreadyLinked = records.some(item => item.userId === String(userId) && item.termsVersion === version);
      if (!alreadyLinked) {
        record.userId = String(userId);
        record.guestId = null;
        this.saveFallback();
      }
    }
    return record ? { version: record.termsVersion, acceptedAt: record.acceptedAt } : null;
  }

  async recordTermsAcceptance({ userId, guestId, version }) {
    const acceptedAt = new Date().toISOString();
    if (this.mode === 'postgres') {
      const result = await this.pool.query(
        `INSERT INTO terms_acceptances (user_id, guest_id, terms_version, accepted_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING accepted_at`,
        [userId ? String(userId) : null, userId ? null : guestId, version, acceptedAt]
      );
      const existing = result.rows[0] || await this.getTermsAcceptance({ userId, guestId, version });
      return { version, acceptedAt: existing?.acceptedAt || acceptedAt };
    }

    const current = await this.getTermsAcceptance({ userId, guestId, version });
    if (current) return current;
    const record = { userId: userId ? String(userId) : null, guestId: userId ? null : guestId, termsVersion: version, acceptedAt };
    this.fallbackData.terms_acceptances.push(record);
    this.saveFallback();
    return { version, acceptedAt };
  }

  // ==================== EVENTS ====================

  async getEvents({ status = 'approved', category, search, urgency, lat, lng, radiusKm }) {
    if (this.mode === 'postgres') {
      let query = `
        SELECT e.*, 
               ec.contact, ec.email as contact_email, ec.org_type,
               u.organization_banned
        FROM events e
        LEFT JOIN event_contacts ec ON e.id = ec.event_id
        LEFT JOIN users u ON e.owner_id = u.id
        WHERE (u.organization_banned IS NULL OR u.organization_banned = FALSE)
      `;
      const params = [];

      if (status && status !== 'all') {
        params.push(status);
        query += ` AND e.status = $${params.length}`;
      }

      if (category && category !== 'all') {
        params.push(category);
        query += ` AND e.category = $${params.length}`;
      }

      if (urgency && urgency !== 'all') {
        params.push(urgency);
        query += ` AND e.urgency = $${params.length}`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(e.title) LIKE $${params.length} OR LOWER(e.city) LIKE $${params.length} OR LOWER(e.state) LIKE $${params.length} OR LOWER(e.district) LIKE $${params.length} OR LOWER(e.organizer) LIKE $${params.length} OR LOWER(e.address) LIKE $${params.length})`;
      }

      query += ` ORDER BY e.created_at DESC`;

      const res = await this.pool.query(query, params);
      let events = res.rows.map(this.formatPostgresEvent);

      if (lat != null && lng != null && radiusKm) {
        events = events.filter(ev => {
          const d = haversineDistance(Number(lat), Number(lng), ev.lat, ev.lng);
          ev.distanceKm = d;
          return d <= radiusKm;
        });
      }

      return events;
    } else {
      let list = this.fallbackData.events.filter(e => {
        // Exclude banned organizers
        if (e.ownerId) {
          const owner = this.fallbackData.users.find(u => u.id === e.ownerId);
          if (owner && owner.organizationBanned) return false;
        }

        if (status && status !== 'all' && e.status !== status) return false;
        if (category && category !== 'all' && e.category !== category) return false;
        if (urgency && urgency !== 'all' && e.urgency !== urgency) return false;
        if (search && search.trim()) {
          const s = search.trim().toLowerCase();
          const match =
            (e.title && e.title.toLowerCase().includes(s)) ||
            (e.city && e.city.toLowerCase().includes(s)) ||
            (e.state && e.state.toLowerCase().includes(s)) ||
            (e.district && e.district.toLowerCase().includes(s)) ||
            (e.organizer && e.organizer.toLowerCase().includes(s)) ||
            (e.address && e.address.toLowerCase().includes(s));
          if (!match) return false;
        }
        return true;
      });

      if (lat != null && lng != null && radiusKm) {
        list = list.filter(ev => {
          const d = haversineDistance(Number(lat), Number(lng), ev.lat, ev.lng);
          ev.distanceKm = d;
          return d <= radiusKm;
        });
      }

      return list;
    }
  }

  async getEventById(id) {
    if (this.mode === 'postgres') {
      const query = `
        SELECT e.*, 
               ec.contact, ec.email as contact_email, ec.org_type,
               u.organization_banned
        FROM events e
        LEFT JOIN event_contacts ec ON e.id = ec.event_id
        LEFT JOIN users u ON e.owner_id = u.id
        WHERE e.id = $1
      `;
      const res = await this.pool.query(query, [String(id)]);
      if (res.rows.length === 0) return null;
      return this.formatPostgresEvent(res.rows[0]);
    } else {
      const ev = this.fallbackData.events.find(e => String(e.id) === String(id));
      if (!ev) return null;
      const contact = this.fallbackData.event_contacts[id] || null;
      return { ...ev, contactInfo: contact };
    }
  }

  async createEvent(eventData, contactData, ownerId = null) {
    const id = eventData.id || 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const formattedEvent = {
      id: String(id),
      ownerId: ownerId,
      title: eventData.title,
      category: eventData.category,
      organizer: eventData.organizer,
      verified: Boolean(eventData.verified),
      city: eventData.city,
      state: eventData.state || null,
      district: eventData.district || null,
      address: eventData.address,
      lat: Number(eventData.lat),
      lng: Number(eventData.lng),
      date: eventData.date,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      volunteersNeeded: Math.max(1, Number(eventData.volunteersNeeded) || 50),
      volunteersJoined: Number(eventData.volunteersJoined) || 0,
      urgency: eventData.urgency || 'upcoming',
      description: eventData.description || '',
      donationLink: eventData.donationLink || null,
      tags: Array.isArray(eventData.tags) ? eventData.tags : [eventData.category],
      status: eventData.status || 'approved',
      notifiedCount: 0,
      createdAt: now,
      updatedAt: now
    };

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO events (id, owner_id, title, category, organizer, verified, city, state, district, address, lat, lng, date, start_time, end_time, volunteers_needed, volunteers_joined, urgency, description, donation_link, tags, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
        [
          formattedEvent.id, ownerId, formattedEvent.title, formattedEvent.category,
          formattedEvent.organizer, formattedEvent.verified, formattedEvent.city,
          formattedEvent.state, formattedEvent.district, formattedEvent.address, formattedEvent.lat, formattedEvent.lng,
          formattedEvent.date, formattedEvent.startTime, formattedEvent.endTime,
          formattedEvent.volunteersNeeded, formattedEvent.volunteersJoined,
          formattedEvent.urgency, formattedEvent.description, formattedEvent.donationLink,
          formattedEvent.tags, formattedEvent.status, now, now
        ]
      );

      if (contactData) {
        await this.pool.query(
          `INSERT INTO event_contacts (event_id, owner_id, org_type, contact, email, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (event_id) DO UPDATE SET contact = $4, email = $5, org_type = $3`,
          [formattedEvent.id, ownerId, contactData.orgType || null, contactData.contact || '', contactData.email || '', now]
        );
      }
    } else {
      this.fallbackData.events.unshift(formattedEvent);
      if (contactData) {
        this.fallbackData.event_contacts[formattedEvent.id] = {
          orgType: contactData.orgType || null,
          contact: contactData.contact || '',
          email: contactData.email || '',
          createdAt: now
        };
      }
      this.saveFallback();
    }

    // Process notification receipts for users opted in within 1 km
    await this.generateNearbyNotificationReceipts(formattedEvent, 1.0);

    return formattedEvent;
  }

  async updateEventStatus(id, patch) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      const allowed = ['status', 'verified', 'urgency', 'volunteers_joined'];
      const setClauses = ['updated_at = $1'];
      const params = [now, String(id)];

      if (patch.status !== undefined) {
        params.push(patch.status);
        setClauses.push(`status = $${params.length}`);
      }
      if (patch.verified !== undefined) {
        params.push(Boolean(patch.verified));
        setClauses.push(`verified = $${params.length}`);
      }
      if (patch.urgency !== undefined) {
        params.push(patch.urgency);
        setClauses.push(`urgency = $${params.length}`);
      }
      if (patch.volunteersJoined !== undefined) {
        params.push(Number(patch.volunteersJoined));
        setClauses.push(`volunteers_joined = $${params.length}`);
      }

      await this.pool.query(
        `UPDATE events SET ${setClauses.join(', ')} WHERE id = $2`,
        params
      );
      return await this.getEventById(id);
    } else {
      const ev = this.fallbackData.events.find(e => String(e.id) === String(id));
      if (!ev) return null;
      if (patch.status !== undefined) ev.status = patch.status;
      if (patch.verified !== undefined) ev.verified = Boolean(patch.verified);
      if (patch.urgency !== undefined) ev.urgency = patch.urgency;
      if (patch.volunteersJoined !== undefined) ev.volunteersJoined = Number(patch.volunteersJoined);
      ev.updatedAt = now;
      this.saveFallback();
      return ev;
    }
  }

  async deleteEvent(id) {
    if (this.mode === 'postgres') {
      await this.pool.query('DELETE FROM events WHERE id = $1', [String(id)]);
      return true;
    } else {
      const idx = this.fallbackData.events.findIndex(e => String(e.id) === String(id));
      if (idx !== -1) {
        this.fallbackData.events.splice(idx, 1);
        delete this.fallbackData.event_contacts[id];
        this.saveFallback();
        return true;
      }
      return false;
    }
  }

  async joinEvent(id, user = null) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `UPDATE events SET volunteers_joined = volunteers_joined + 1, updated_at = $1 WHERE id = $2 RETURNING volunteers_joined`,
        [now, String(id)]
      );
      if (user) {
        await this.pool.query(
          `INSERT INTO volunteer_applications (id, event_id, user_id, applicant_name, applicant_phone, applicant_email, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'registered', $7)
           ON CONFLICT (event_id, user_id) DO NOTHING`,
          ['app_' + Date.now(), String(id), user.id, user.name, user.phone, user.email, now]
        );
      }
      return res.rows[0]?.volunteers_joined || 1;
    } else {
      const ev = this.fallbackData.events.find(e => String(e.id) === String(id));
      if (ev) {
        ev.volunteersJoined = (ev.volunteersJoined || 0) + 1;
        ev.updatedAt = now;
        if (user) {
          this.fallbackData.volunteer_applications.push({
            id: 'app_' + Date.now(),
            eventId: String(id),
            userId: user.id,
            applicantName: user.name,
            applicantPhone: user.phone,
            applicantEmail: user.email,
            status: 'registered',
            createdAt: now
          });
        }
        this.saveFallback();
        return ev.volunteersJoined;
      }
      return 1;
    }
  }

  async getContact(id) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM event_contacts WHERE event_id = $1', [String(id)]);
      if (res.rows.length === 0) return null;
      return {
        orgType: res.rows[0].org_type,
        contact: res.rows[0].contact,
        email: res.rows[0].email,
        createdAt: res.rows[0].created_at
      };
    } else {
      return this.fallbackData.event_contacts[String(id)] || null;
    }
  }

  // ==================== USER ACCOUNTS & AUTH ====================

  async findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    const phoneClean = identifier.trim();

    if (this.mode === 'postgres') {
      const query = `
        SELECT * FROM users 
        WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR phone = $2
      `;
      const res = await this.pool.query(query, [clean, phoneClean]);
      if (res.rows.length === 0) return null;
      return this.formatPostgresUser(res.rows[0]);
    } else {
      const user = this.fallbackData.users.find(u => 
        u.email.toLowerCase() === clean ||
        u.username.toLowerCase() === clean ||
        u.phone === phoneClean
      );
      return user || null;
    }
  }

  async findUserById(id) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM users WHERE id = $1', [String(id)]);
      if (res.rows.length === 0) return null;
      return this.formatPostgresUser(res.rows[0]);
    } else {
      return this.fallbackData.users.find(u => String(u.id) === String(id)) || null;
    }
  }

  async createUser({ name, username, email, phone, passwordHash, notificationLat, notificationLng, bloodGroup }) {
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const user = {
      id,
      name,
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      emailVerified: true,
      phone: phone.trim(),
      phoneVerified: true,
      passwordHash,
      bloodGroup: bloodGroup || null,
      notificationLat: notificationLat || null,
      notificationLng: notificationLng || null,
      notificationsEnabled: true,
      pushTokens: [],
      subscriptionStatus: 'free',
      organizationBanned: false,
      falseAlarmCount: 0,
      isAdmin: false,
      createdAt: now,
      updatedAt: now
    };

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO users (id, name, username, email, email_verified, phone, phone_verified, password_hash, blood_group, notification_lat, notification_lng, notifications_enabled, subscription_status, organization_banned, false_alarm_count, is_admin, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          user.id, user.name, user.username, user.email, user.emailVerified,
          user.phone, user.phoneVerified, user.passwordHash, user.bloodGroup, user.notificationLat,
          user.notificationLng, user.notificationsEnabled, user.subscriptionStatus,
          user.organizationBanned, user.falseAlarmCount, user.isAdmin, now, now
        ]
      );
    } else {
      this.fallbackData.users.push(user);
      this.saveFallback();
    }

    return user;
  }

  async updateUserLocation(userId, lat, lng) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      await this.pool.query(
        `UPDATE users SET notification_lat = $1, notification_lng = $2, updated_at = $3 WHERE id = $4`,
        [Number(lat), Number(lng), now, String(userId)]
      );
    } else {
      const u = this.fallbackData.users.find(x => String(x.id) === String(userId));
      if (u) {
        u.notificationLat = Number(lat);
        u.notificationLng = Number(lng);
        u.updatedAt = now;
        this.saveFallback();
      }
    }
  }

  async updateDonorProfile(userId, bloodGroup, lat, lng) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      await this.pool.query('UPDATE users SET blood_group = $1, notification_lat = $2, notification_lng = $3, notifications_enabled = TRUE, updated_at = $4 WHERE id = $5', [bloodGroup, Number(lat), Number(lng), now, String(userId)]);
      const openRequests = (await this.pool.query("SELECT id, requester_id, blood_group, units, hospital, city, lat, lng FROM urgent_blood_requests WHERE status = 'open' AND expires_at > NOW() AND blood_group = $1 AND requester_id <> $2", [bloodGroup, String(userId)])).rows;
      const existing = (await this.pool.query('SELECT urgent_request_id FROM notifications WHERE user_id = $1 AND urgent_request_id IS NOT NULL', [String(userId)])).rows;
      const notified = new Set(existing.map(row => String(row.urgent_request_id)));
      for (const request of openRequests) {
        const distance = haversineDistance(Number(lat), Number(lng), Number(request.lat), Number(request.lng));
        if (distance > 25 || notified.has(String(request.id))) continue;
        await this.pool.query('INSERT INTO notifications (id, user_id, urgent_request_id, distance_km, title, message, delivered, created_at) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)', ['notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), String(userId), request.id, distance, `Urgent ${bloodGroup} blood needed`, `${request.units} unit(s) requested at ${request.hospital}, ${request.city} (${distance.toFixed(1)} km away).`, now]);
      }
      return;
    }
    const user = this.fallbackData.users.find(item => String(item.id) === String(userId));
    if (!user) return;
    user.bloodGroup = bloodGroup;
    user.notificationLat = Number(lat);
    user.notificationLng = Number(lng);
    user.notificationsEnabled = true;
    user.updatedAt = now;
    const notified = new Set(this.fallbackData.notifications.filter(item => String(item.userId) === String(userId) && item.urgentRequestId).map(item => String(item.urgentRequestId)));
    for (const request of this.fallbackData.urgent_blood_requests) {
      if (request.status !== 'open' || new Date(request.expiresAt) <= new Date() || request.bloodGroup !== bloodGroup || String(request.requesterId) === String(userId) || notified.has(String(request.id))) continue;
      const distance = haversineDistance(Number(lat), Number(lng), Number(request.lat), Number(request.lng));
      if (distance > 25) continue;
      this.fallbackData.notifications.push({ id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), userId: String(userId), urgentRequestId: request.id, distanceKm: distance, title: `Urgent ${bloodGroup} blood needed`, message: `${request.units} unit(s) requested at ${request.hospital}, ${request.city} (${distance.toFixed(1)} km away).`, delivered: true, createdAt: now });
    }
    this.saveFallback();
  }

  async createUrgentBloodRequest(data) {
    const now = new Date();
    const request = {
      id: 'blood_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      requesterId: String(data.requesterId), patientName: data.patientName, bloodGroup: data.bloodGroup,
      units: Number(data.units), hospital: data.hospital, address: data.address, city: data.city,
      lat: Number(data.lat), lng: Number(data.lng), contactPhone: data.contactPhone, details: data.details || '',
      status: 'open', createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
    };
    const donors = this.mode === 'postgres'
      ? (await this.pool.query('SELECT id, notification_lat, notification_lng FROM users WHERE notifications_enabled = TRUE AND blood_group = $1 AND notification_lat IS NOT NULL AND notification_lng IS NOT NULL AND id <> $2', [request.bloodGroup, request.requesterId])).rows
      : this.fallbackData.users.filter(user => user.notificationsEnabled && user.bloodGroup === request.bloodGroup && user.notificationLat != null && user.notificationLng != null && String(user.id) !== request.requesterId);
    const matches = donors.map(user => {
      const lat = user.notification_lat ?? user.notificationLat;
      const lng = user.notification_lng ?? user.notificationLng;
      return { id: user.id, distance: haversineDistance(Number(lat), Number(lng), request.lat, request.lng) };
    }).filter(user => user.distance <= 25);

    if (this.mode === 'postgres') {
      await this.pool.query(`INSERT INTO urgent_blood_requests (id, requester_id, patient_name, blood_group, units, hospital, address, city, lat, lng, contact_phone, details, status, created_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'open',$13,$14)`, [request.id, request.requesterId, request.patientName, request.bloodGroup, request.units, request.hospital, request.address, request.city, request.lat, request.lng, request.contactPhone, request.details, request.createdAt, request.expiresAt]);
      for (const donor of matches) await this.pool.query(`INSERT INTO notifications (id, user_id, urgent_request_id, distance_km, title, message, delivered, created_at) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)`, ['notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), donor.id, request.id, donor.distance, `Urgent ${request.bloodGroup} blood needed`, `${request.units} unit(s) requested at ${request.hospital}, ${request.city} (${donor.distance.toFixed(1)} km away).`, request.createdAt]);
    } else {
      this.fallbackData.urgent_blood_requests.push(request);
      for (const donor of matches) this.fallbackData.notifications.push({ id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), userId: donor.id, urgentRequestId: request.id, distanceKm: donor.distance, title: `Urgent ${request.bloodGroup} blood needed`, message: `${request.units} unit(s) requested at ${request.hospital}, ${request.city} (${donor.distance.toFixed(1)} km away).`, delivered: true, createdAt: request.createdAt });
      this.saveFallback();
    }
    return { ...request, notifiedDonors: matches.length };
  }

  async listUrgentBloodRequests() {
    const requests = this.mode === 'postgres'
      ? (await this.pool.query("SELECT id, requester_id, patient_name, blood_group, units, hospital, address, city, lat, lng, details, status, created_at, expires_at FROM urgent_blood_requests WHERE status = 'open' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 100")).rows
      : this.fallbackData.urgent_blood_requests.filter(request => request.status === 'open' && new Date(request.expiresAt) > new Date());
    return requests.map(row => ({ id: row.id, requesterId: row.requester_id ?? row.requesterId, patientName: row.patient_name ?? row.patientName, bloodGroup: row.blood_group ?? row.bloodGroup, units: row.units, hospital: row.hospital, address: row.address, city: row.city, lat: Number(row.lat), lng: Number(row.lng), details: row.details || '', status: row.status, createdAt: row.created_at ?? row.createdAt, expiresAt: row.expires_at ?? row.expiresAt }));
  }

  async closeUrgentBloodRequest(requestId, requesterId) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("UPDATE urgent_blood_requests SET status = 'closed' WHERE id = $1 AND requester_id = $2 AND status = 'open' RETURNING id", [String(requestId), String(requesterId)]);
      return result.rowCount > 0;
    }
    const request = this.fallbackData.urgent_blood_requests.find(item => item.id === String(requestId) && String(item.requesterId) === String(requesterId) && item.status === 'open');
    if (!request) return false;
    request.status = 'closed';
    this.saveFallback();
    return true;
  }

  async expressBloodDonationInterest(requestId, donor) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("SELECT requester_id, blood_group FROM urgent_blood_requests WHERE id = $1 AND status = 'open' AND expires_at > NOW()", [String(requestId)]);
      if (!result.rows[0]) return null;
      if (result.rows[0].blood_group !== donor.bloodGroup || String(result.rows[0].requester_id) === String(donor.id)) return null;
      const offer = await this.pool.query('INSERT INTO urgent_blood_offers (id, request_id, donor_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (request_id, donor_id) DO NOTHING RETURNING id', ['offer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), String(requestId), String(donor.id), new Date().toISOString()]);
      if (!offer.rows[0]) return { success: true, alreadyResponded: true };
      await this.pool.query('INSERT INTO notifications (id, user_id, urgent_request_id, title, message, delivered, created_at) VALUES ($1,$2,$3,$4,$5,TRUE,$6)', ['notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), result.rows[0].requester_id, String(requestId), 'A matching donor responded', `${donor.name} (${donor.bloodGroup}) is interested in donating. Contact: ${donor.phone}`, new Date().toISOString()]);
      return { success: true };
    }
    const request = this.fallbackData.urgent_blood_requests.find(item => item.id === String(requestId) && item.status === 'open' && new Date(item.expiresAt) > new Date());
    if (!request || request.bloodGroup !== donor.bloodGroup || String(request.requesterId) === String(donor.id)) return null;
    if (this.fallbackData.urgent_blood_offers.some(offer => offer.requestId === request.id && String(offer.donorId) === String(donor.id))) return { success: true, alreadyResponded: true };
    this.fallbackData.urgent_blood_offers.push({ id: 'offer_' + Date.now(), requestId: request.id, donorId: String(donor.id), createdAt: new Date().toISOString() });
    this.fallbackData.notifications.push({ id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), userId: request.requesterId, urgentRequestId: request.id, title: 'A matching donor responded', message: `${donor.name} (${donor.bloodGroup}) is interested in donating. Contact: ${donor.phone}`, delivered: true, createdAt: new Date().toISOString() });
    this.saveFallback();
    return { success: true };
  }

  // ==================== REVIEWS & FALSE ALARM BAN ====================

  async getEventReviews(eventId) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query(
        `SELECT r.id, r.rating, r.outcome, r.comment, r.photos, r.created_at, u.name AS reviewer_name
         FROM event_reviews r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.event_id = $1
         ORDER BY r.created_at DESC`,
        [String(eventId)]
      );
      return result.rows.map(row => ({
        id: row.id,
        rating: Number(row.rating),
        outcome: row.outcome,
        comment: row.comment || '',
        photos: Array.isArray(row.photos) ? row.photos : [],
        createdAt: row.created_at,
        reviewerName: row.reviewer_name || 'Community member'
      }));
    }

    return this.fallbackData.event_reviews
      .filter(review => String(review.eventId) === String(eventId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(review => ({
        id: review.id,
        rating: Number(review.rating),
        outcome: review.outcome,
        comment: review.comment || '',
        photos: Array.isArray(review.photos) ? review.photos : [],
        createdAt: review.createdAt,
        reviewerName: this.fallbackData.users.find(user => String(user.id) === String(review.userId))?.name || 'Community member'
      }));
  }

  async getOrganizerOverview(identifier) {
    const key = String(identifier || '').trim();
    if (!key) return { eventCount: 0, categories: [] };

    if (this.mode === 'postgres') {
      const result = await this.pool.query(
        `SELECT COUNT(*) AS event_count, ARRAY_AGG(DISTINCT category) AS categories
         FROM events
         WHERE status IN ('approved', 'completed')
           AND (owner_id = $1 OR LOWER(organizer) = LOWER($1))`,
        [key]
      );
      return {
        eventCount: Number(result.rows[0]?.event_count) || 0,
        categories: Array.isArray(result.rows[0]?.categories) ? result.rows[0].categories : []
      };
    }

    const matching = this.fallbackData.events.filter(event =>
      ['approved', 'completed'].includes(event.status) &&
      (String(event.ownerId || '') === key || String(event.organizer || '').toLowerCase() === key.toLowerCase())
    );
    return {
      eventCount: matching.length,
      categories: [...new Set(matching.map(event => event.category).filter(Boolean))]
    };
  }

  async createReview({ eventId, userId, rating, outcome, comment, photos = [] }) {
    const now = new Date().toISOString();
    const event = await this.getEventById(eventId);
    if (!event) throw new Error('Event not found');

    const organizerId = event.ownerId || null;
    const reviewId = 'rev_' + Date.now();

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO event_reviews (id, event_id, user_id, organizer_id, rating, outcome, comment, photos, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (event_id, user_id) DO UPDATE SET rating = $5, outcome = $6, comment = $7, photos = $8, created_at = $9`,
        [reviewId, String(eventId), String(userId), organizerId, rating, outcome, comment, JSON.stringify(photos), now]
      );

      // Check false-alarm rule: 2 distinct false-alarm reviews restrict the organizer
      if (outcome === 'false_alarm' && organizerId) {
        const falseAlarmRes = await this.pool.query(
          `SELECT COUNT(DISTINCT user_id) as false_count FROM event_reviews WHERE organizer_id = $1 AND outcome = 'false_alarm'`,
          [organizerId]
        );
        const count = parseInt(falseAlarmRes.rows[0].false_count, 10);
        if (count >= 2) {
          console.warn(`🚨 Organizer ${organizerId} has received ${count} distinct false-alarm reviews! Banning organizer and suspending public events.`);
          await this.pool.query(
            `UPDATE users SET organization_banned = TRUE, false_alarm_count = $1 WHERE id = $2`,
            [count, organizerId]
          );
          await this.pool.query(
            `UPDATE events SET status = 'suspended' WHERE owner_id = $1`,
            [organizerId]
          );
        }
      }
    } else {
      const existingIdx = this.fallbackData.event_reviews.findIndex(r => r.eventId === String(eventId) && r.userId === String(userId));
      const record = { id: reviewId, eventId: String(eventId), userId: String(userId), organizerId, rating, outcome, comment, photos, createdAt: now };
      if (existingIdx !== -1) {
        this.fallbackData.event_reviews[existingIdx] = record;
      } else {
        this.fallbackData.event_reviews.push(record);
      }

      if (outcome === 'false_alarm' && organizerId) {
        const distinctReviewers = new Set(
          this.fallbackData.event_reviews
            .filter(r => r.organizerId === organizerId && r.outcome === 'false_alarm')
            .map(r => r.userId)
        );
        if (distinctReviewers.size >= 2) {
          console.warn(`🚨 Organizer ${organizerId} has received ${distinctReviewers.size} distinct false-alarm reviews. Banning organizer.`);
          const org = this.fallbackData.users.find(u => u.id === organizerId);
          if (org) org.organizationBanned = true;
          this.fallbackData.events.forEach(e => {
            if (e.ownerId === organizerId) e.status = 'suspended';
          });
        }
      }
      this.saveFallback();
    }
  }

  // ==================== VOLUNTEERS & LOCATION TRACKING ====================

  async createVolunteerApplication({ eventId, userId, applicantName, applicantPhone, applicantEmail, trackingConsent }) {
    const id = 'vapp_' + Date.now();
    const now = new Date().toISOString();
    const event = await this.getEventById(eventId);

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO volunteer_applications (id, event_id, user_id, applicant_name, applicant_phone, applicant_email, organizer_id, status, tracking_consent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered', $8, $9)`,
        [id, String(eventId), userId, applicantName, applicantPhone, applicantEmail, event?.ownerId || null, Boolean(trackingConsent), now]
      );
      await this.pool.query(
        'UPDATE events SET volunteers_joined = volunteers_joined + 1, updated_at = $1 WHERE id = $2',
        [now, String(eventId)]
      );
    } else {
      this.fallbackData.volunteer_applications.push({
        id,
        eventId: String(eventId),
        userId,
        applicantName,
        applicantPhone,
        applicantEmail,
        organizerId: event?.ownerId || null,
        status: 'registered',
        trackingConsent: Boolean(trackingConsent),
        trackingLat: null,
        trackingLng: null,
        createdAt: now
      });
      const fallbackEvent = this.fallbackData.events.find(item => String(item.id) === String(eventId));
      if (fallbackEvent) {
        fallbackEvent.volunteersJoined = (fallbackEvent.volunteersJoined || 0) + 1;
        fallbackEvent.updatedAt = now;
      }
      this.saveFallback();
    }
    return id;
  }

  async updateVolunteerTracking(applicationId, lat, lng) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      // Live location is only sent after volunteer consent
      await this.pool.query(
        `UPDATE volunteer_applications 
         SET tracking_lat = $1, tracking_lng = $2, tracking_updated_at = $3 
         WHERE id = $4 AND tracking_consent = TRUE`,
        [Number(lat), Number(lng), now, String(applicationId)]
      );
    } else {
      const app = this.fallbackData.volunteer_applications.find(a => a.id === String(applicationId));
      if (app && app.trackingConsent) {
        app.trackingLat = Number(lat);
        app.trackingLng = Number(lng);
        app.trackingUpdatedAt = now;
        this.saveFallback();
      }
    }
  }

  async getEventVolunteers(eventId) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `SELECT id, applicant_name, applicant_phone, applicant_email, status, tracking_consent, tracking_lat, tracking_lng, tracking_updated_at, created_at 
         FROM volunteer_applications WHERE event_id = $1 ORDER BY created_at DESC`,
        [String(eventId)]
      );
      return res.rows.map(r => ({
        id: r.id,
        name: r.applicant_name,
        phone: r.applicant_phone,
        email: r.applicant_email,
        status: r.status,
        trackingConsent: r.tracking_consent,
        tracking: r.tracking_consent && r.tracking_lat != null ? { lat: r.tracking_lat, lng: r.tracking_lng, updatedAt: r.tracking_updated_at } : null,
        createdAt: r.created_at
      }));
    } else {
      return this.fallbackData.volunteer_applications
        .filter(a => a.eventId === String(eventId))
        .map(a => ({
          id: a.id,
          name: a.applicantName,
          phone: a.applicantPhone,
          email: a.applicantEmail,
          status: a.status,
          trackingConsent: a.trackingConsent,
          tracking: a.trackingConsent && a.trackingLat != null ? { lat: a.trackingLat, lng: a.trackingLng, updatedAt: a.trackingUpdatedAt } : null,
          createdAt: a.createdAt
        }));
    }
  }

  async getUserVolunteerApplications(userId) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `SELECT va.event_id AS id, va.status, va.created_at,
                e.title, e.category, e.organizer, e.date, e.city, e.address
         FROM volunteer_applications va
         LEFT JOIN events e ON e.id = va.event_id
         WHERE va.user_id = $1
         ORDER BY va.created_at DESC`,
        [String(userId)]
      );
      return res.rows.map(row => ({
        id: String(row.id), kind: 'volunteer', status: row.status,
        title: row.title || 'Community event', category: row.category || 'other',
        organizer: row.organizer || '', date: row.date || '', city: row.city || '', address: row.address || '',
        createdAt: row.created_at,
      }));
    }

    const applications = this.fallbackData.volunteer_applications
      .filter(application => String(application.userId || '') === String(userId))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return Promise.all(applications.map(async application => {
      const event = await this.getEventById(application.eventId);
      return {
        id: String(application.eventId), kind: 'volunteer', status: application.status || 'registered',
        title: event?.title || 'Community event', category: event?.category || 'other',
        organizer: event?.organizer || '', date: event?.date || '', city: event?.city || '', address: event?.address || '',
        createdAt: application.createdAt,
      };
    }));
  }

  // ==================== NOTIFICATIONS ====================

  async generateNearbyNotificationReceipts(event, maxDistanceKm = 1.0) {
    const now = new Date().toISOString();
    if (!event || event.lat == null || event.lng == null) return;

    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `SELECT id, notification_lat, notification_lng FROM users 
         WHERE notifications_enabled = TRUE AND notification_lat IS NOT NULL AND notification_lng IS NOT NULL`
      );

      for (const u of res.rows) {
        const dist = haversineDistance(u.notification_lat, u.notification_lng, event.lat, event.lng);
        if (dist <= maxDistanceKm) {
          await this.pool.query(
            `INSERT INTO notifications (id, user_id, event_id, distance_km, title, message, delivered, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`,
            [
              'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
              u.id, event.id, dist,
              `🚨 Nearby Event: ${event.title}`,
              `${event.organizer} is hosting ${event.title} approximately ${dist.toFixed(1)} km away.`,
              now
            ]
          );
        }
      }
    } else {
      const users = this.fallbackData.users.filter(u => u.notificationsEnabled && u.notificationLat != null && u.notificationLng != null);
      for (const u of users) {
        const dist = haversineDistance(u.notificationLat, u.notificationLng, event.lat, event.lng);
        if (dist <= maxDistanceKm) {
          this.fallbackData.notifications.push({
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            userId: u.id,
            eventId: event.id,
            distanceKm: dist,
            title: `🚨 Nearby Event: ${event.title}`,
            message: `${event.organizer} is hosting ${event.title} approximately ${dist.toFixed(1)} km away.`,
            delivered: true,
            createdAt: now
          });
        }
      }
      this.saveFallback();
    }
  }

  async getUserNotifications(userId) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [String(userId)]
      );
      return res.rows;
    } else {
      return this.fallbackData.notifications
        .filter(n => n.userId === String(userId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  // ==================== FORMATTERS ====================

  formatPostgresEvent(r) {
    return {
      id: r.id,
      ownerId: r.owner_id,
      title: r.title,
      category: r.category,
      organizer: r.organizer,
      verified: r.verified,
      city: r.city,
      state: r.state || '',
      district: r.district || '',
      address: r.address,
      lat: Number(r.lat),
      lng: Number(r.lng),
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      startTime: r.start_time,
      endTime: r.end_time,
      volunteersNeeded: r.volunteers_needed,
      volunteersJoined: r.volunteers_joined,
      urgency: r.urgency,
      description: r.description,
      donationLink: r.donation_link,
      tags: r.tags || [],
      status: r.status,
      notifiedCount: r.notified_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      contactInfo: r.contact ? {
        contact: r.contact,
        email: r.contact_email,
        orgType: r.org_type
      } : null
    };
  }

  formatPostgresUser(r) {
    return {
      id: r.id,
      name: r.name,
      username: r.username,
      email: r.email,
      emailVerified: r.email_verified,
      phone: r.phone,
      phoneVerified: r.phone_verified,
      bloodGroup: r.blood_group || null,
      passwordHash: r.password_hash,
      notificationLat: r.notification_lat,
      notificationLng: r.notification_lng,
      notificationsEnabled: r.notifications_enabled,
      pushTokens: r.push_tokens,
      subscriptionStatus: r.subscription_status,
      organizationBanned: r.organization_banned,
      falseAlarmCount: r.false_alarm_count,
      isAdmin: r.is_admin,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}

const db = new DatabaseManager();
module.exports = db;
