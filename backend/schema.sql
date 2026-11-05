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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_user_volunteer UNIQUE (event_id, user_id)
);

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
    distance_km DOUBLE PRECISION,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    delivered BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group VARCHAR(3);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS urgent_request_id VARCHAR(64);

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
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_urgent_request_fk') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_urgent_request_fk
            FOREIGN KEY (urgent_request_id) REFERENCES urgent_blood_requests(id) ON DELETE CASCADE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_urgent_blood_requests_open ON urgent_blood_requests(status, blood_group, expires_at);
CREATE TABLE IF NOT EXISTS urgent_blood_offers (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES urgent_blood_requests(id) ON DELETE CASCADE,
    donor_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_blood_request_donor UNIQUE (request_id, donor_id)
);

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
