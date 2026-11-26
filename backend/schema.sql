-- ====================================================================
-- SERVEO — PostgreSQL Schema for Community Public-Service Events
-- ====================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT TRUE,
    phone VARCHAR(30) UNIQUE NOT NULL,
    phone_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    blood_group VARCHAR(3),
    notification_lat DOUBLE PRECISION,
    notification_lng DOUBLE PRECISION,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    push_tokens JSONB DEFAULT '[]'::jsonb,
    subscription_status VARCHAR(50) DEFAULT 'free',
    organization_banned BOOLEAN DEFAULT FALSE,
    false_alarm_count INTEGER DEFAULT 0,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','approved','rejected')),
    organization_type VARCHAR(20),
    last_donation_date DATE,
    donation_cooldown_days INTEGER CHECK (donation_cooldown_days IN (90,120)),
    donation_reminder_sent_date DATE,
    leaderboard_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    home_city VARCHAR(100),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terms_acceptances (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    guest_id VARCHAR(64),
    terms_version VARCHAR(40) NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT terms_acceptance_has_identity CHECK ((user_id IS NOT NULL) <> (guest_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS terms_acceptance_user_version_uq
    ON terms_acceptances(user_id, terms_version) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS terms_acceptance_guest_version_uq
    ON terms_acceptances(guest_id, terms_version) WHERE guest_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    organizer VARCHAR(255) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(120),
    district VARCHAR(120),
    address TEXT NOT NULL,
    pincode VARCHAR(6),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    date DATE NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20) NOT NULL,
    volunteers_needed INTEGER NOT NULL DEFAULT 50,
    volunteers_joined INTEGER NOT NULL DEFAULT 0,
    urgency VARCHAR(30) NOT NULL DEFAULT 'upcoming',
    description TEXT NOT NULL,
    donation_link TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    status VARCHAR(30) NOT NULL DEFAULT 'approved',
    notified_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS state VARCHAR(120);
ALTER TABLE events ADD COLUMN IF NOT EXISTS district VARCHAR(120);
ALTER TABLE events ADD COLUMN IF NOT EXISTS pincode VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified';
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_type VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_donation_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS donation_cooldown_days INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS donation_reminder_sent_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_city VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS organizer_verification_documents (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    requested_type VARCHAR(20) NOT NULL DEFAULT 'organizer',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    review_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS event_reports (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    reporter_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('fake','outdated','unsafe','spam','other')),
    note TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','hidden','organizer_restricted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    UNIQUE (event_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_event_reports_pending ON event_reports(status, created_at);

CREATE TABLE IF NOT EXISTS blood_donations (
    id VARCHAR(64) PRIMARY KEY,
    donor_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    donation_date DATE NOT NULL,
    city VARCHAR(100),
    cooldown_days INTEGER NOT NULL CHECK (cooldown_days IN (90,120)),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
    confirmed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blood_donations_donor ON blood_donations(donor_id, donation_date DESC);

CREATE TABLE IF NOT EXISTS blood_bank_stock (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    blood_group VARCHAR(3) NOT NULL,
    need_level VARCHAR(10) NOT NULL CHECK (need_level IN ('critical','low','ok')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, blood_group)
);
CREATE INDEX IF NOT EXISTS idx_blood_stock_city_time ON blood_bank_stock(city, updated_at DESC);

CREATE TABLE IF NOT EXISTS donation_certificates (
    id VARCHAR(64) PRIMARY KEY,
    donation_id VARCHAR(64) NOT NULL UNIQUE REFERENCES blood_donations(id) ON DELETE CASCADE,
    donor_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS food_posts (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_description VARCHAR(500) NOT NULL,
    approximate_meals INTEGER NOT NULL CHECK (approximate_meals BETWEEN 1 AND 10000),
    cooked_at TIMESTAMPTZ NOT NULL,
    pickup_by TIMESTAMPTZ NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    contact TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','claimed','picked_up','completed','expired','cancelled')),
    claimed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    restaurant_confirmed_at TIMESTAMPTZ,
    recipient_confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_food_posts_open_pickup ON food_posts(status,pickup_by,city);

CREATE TABLE IF NOT EXISTS food_post_notifications (
    food_post_id VARCHAR(64) NOT NULL REFERENCES food_posts(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wave INTEGER NOT NULL DEFAULT 0,
    notified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (food_post_id,user_id)
);
CREATE TABLE IF NOT EXISTS food_reports (
    id VARCHAR(64) PRIMARY KEY,
    food_post_id VARCHAR(64) NOT NULL REFERENCES food_posts(id) ON DELETE CASCADE,
    reporter_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('fake','outdated','unsafe','spam','other')),
    note TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','hidden')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (food_post_id,reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_food_reports_pending ON food_reports(status,created_at);
ALTER TABLE food_posts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS event_contacts (
    event_id VARCHAR(64) PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    owner_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    org_type VARCHAR(100),
    contact VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS volunteer_applications (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    applicant_name VARCHAR(255),
    applicant_phone VARCHAR(50),
    applicant_email VARCHAR(255),
    organizer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'registered',
    tracking_consent BOOLEAN DEFAULT FALSE,
    tracking_lat DOUBLE PRECISION,
    tracking_lng DOUBLE PRECISION,
    tracking_updated_at TIMESTAMPTZ,
    ticket_code_hash CHAR(64) UNIQUE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_user_volunteer UNIQUE (event_id, user_id)
);

ALTER TABLE volunteer_applications ADD COLUMN IF NOT EXISTS ticket_code_hash CHAR(64) UNIQUE;
ALTER TABLE volunteer_applications ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE volunteer_applications ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS volunteer_attendance_records (
    id VARCHAR(64) PRIMARY KEY,
    application_id VARCHAR(64) NOT NULL UNIQUE REFERENCES volunteer_applications(id) ON DELETE CASCADE,
    event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL,
    checked_out_at TIMESTAMPTZ,
    hours NUMERIC(7,2),
    marked_by VARCHAR(64) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at),
    CHECK (hours IS NULL OR hours >= 0)
);
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_user ON volunteer_attendance_records(user_id,checked_out_at);
CREATE TABLE IF NOT EXISTS volunteer_hours_certificates (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Optional private development chart fixtures; never populated in public mode.
CREATE TABLE IF NOT EXISTS impact_demo_monthly_samples (
    month DATE PRIMARY KEY,
    volunteers_mobilized INTEGER NOT NULL CHECK (volunteers_mobilized >= 0),
    welfare_drives_completed INTEGER NOT NULL CHECK (welfare_drives_completed >= 0),
    donors_registered INTEGER NOT NULL DEFAULT 0 CHECK (donors_registered >= 0),
    donations_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (donations_confirmed >= 0),
    meals_delivered INTEGER NOT NULL DEFAULT 0 CHECK (meals_delivered >= 0),
    volunteer_hours NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (volunteer_hours >= 0),
    cities_covered INTEGER NOT NULL DEFAULT 0 CHECK (cities_covered >= 0)
);
ALTER TABLE impact_demo_monthly_samples ADD COLUMN IF NOT EXISTS donors_registered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE impact_demo_monthly_samples ADD COLUMN IF NOT EXISTS donations_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE impact_demo_monthly_samples ADD COLUMN IF NOT EXISTS meals_delivered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE impact_demo_monthly_samples ADD COLUMN IF NOT EXISTS volunteer_hours NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE impact_demo_monthly_samples ADD COLUMN IF NOT EXISTS cities_covered INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS attendance (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_user_attendance UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_reviews (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organizer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    outcome VARCHAR(30) CHECK (outcome IN ('event_held', 'false_alarm')),
    comment TEXT,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_user_review UNIQUE (event_id, user_id)
);

ALTER TABLE event_reviews
    ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id VARCHAR(64) REFERENCES events(id) ON DELETE CASCADE,
    urgent_request_id VARCHAR(64),
    food_post_id VARCHAR(64),
    distance_km DOUBLE PRECISION,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    delivered BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group VARCHAR(3);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS urgent_request_id VARCHAR(64);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS food_post_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS urgent_blood_requests (
    id VARCHAR(64) PRIMARY KEY,
    requester_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    patient_name VARCHAR(120) NOT NULL,
    blood_group VARCHAR(3) NOT NULL,
    units INTEGER NOT NULL DEFAULT 1 CHECK (units BETWEEN 1 AND 20),
    hospital VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    details TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
    ,matching_wave INTEGER NOT NULL DEFAULT 0
    ,last_wave_at TIMESTAMPTZ
);
ALTER TABLE urgent_blood_requests ADD COLUMN IF NOT EXISTS matching_wave INTEGER NOT NULL DEFAULT 0;
ALTER TABLE urgent_blood_requests ADD COLUMN IF NOT EXISTS last_wave_at TIMESTAMPTZ;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_urgent_request_fk') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_urgent_request_fk
            FOREIGN KEY (urgent_request_id) REFERENCES urgent_blood_requests(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_food_post_fk') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_food_post_fk
            FOREIGN KEY (food_post_id) REFERENCES food_posts(id) ON DELETE CASCADE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_urgent_blood_requests_open ON urgent_blood_requests(status, blood_group, expires_at);
CREATE TABLE IF NOT EXISTS urgent_blood_offers (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES urgent_blood_requests(id) ON DELETE CASCADE,
    donor_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    CONSTRAINT unique_blood_request_donor UNIQUE (request_id, donor_id)
);
ALTER TABLE urgent_blood_offers ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS disaster_mode_audit (
    id VARCHAR(64) PRIMARY KEY,
    admin_id VARCHAR(64) NOT NULL REFERENCES users(id),
    action VARCHAR(10) NOT NULL CHECK (action IN ('enabled','disabled','expired')),
    reason VARCHAR(500) NOT NULL,
    region VARCHAR(120) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS disaster_mode_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
    audit_id VARCHAR(64) REFERENCES disaster_mode_audit(id),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    reason VARCHAR(500), region VARCHAR(120), ends_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO disaster_mode_state(singleton,active) VALUES(TRUE,FALSE) ON CONFLICT(singleton) DO NOTHING;

-- Indexes for fast geospatial and filtered discovery
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(lat, lng);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_reviews_organizer ON event_reviews(organizer_id, outcome);
CREATE INDEX IF NOT EXISTS idx_volunteer_event ON volunteer_applications(event_id);

CREATE TABLE IF NOT EXISTS premium_activations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'demo_premium',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_premium_activations_email ON premium_activations(email, created_at DESC);

CREATE TABLE IF NOT EXISTS website_inquiries (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    guest_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) DEFAULT '',
    topic VARCHAR(80) NOT NULL DEFAULT 'general',
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_website_inquiries_status_created ON website_inquiries(status, created_at DESC);

CREATE TABLE IF NOT EXISTS blood_donor_profiles (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    blood_group VARCHAR(3) NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    age INTEGER NOT NULL CHECK (age BETWEEN 18 AND 65),
    weight_kg INTEGER NOT NULL CHECK (weight_kg BETWEEN 45 AND 250),
    city VARCHAR(100) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    phone VARCHAR(30) DEFAULT '',
    availability VARCHAR(40) NOT NULL DEFAULT 'anytime',
    recent_illness_free BOOLEAN NOT NULL DEFAULT TRUE,
    recent_tattoo_free BOOLEAN NOT NULL DEFAULT TRUE,
    consent_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
