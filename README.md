# SERVEO — Community Public-Service Events Platform

A crowdsourced, location-aware platform mapping emergency blood donation drives, free health screening camps, food distribution, disaster relief, animal rescue, and environmental initiatives in real time across India.

---

## Project Structure

This workspace is cleanly organized into two core components:

```
Serveo-app/
├── backend/                  # Node.js API server & database layer
│   ├── data/                 # Embedded persistent local datastore (serveo-db.json)
│   ├── auth.js               # Twilio Verify SMS OTP & account authentication
│   ├── db.js                 # PostgreSQL & local persistent DB engine
│   ├── package.json          # Backend dependencies
│   ├── schema.sql            # PostgreSQL 16 relational schema
│   ├── seeds.js              # 18 Initial Indian civic events
│   ├── server.js             # Primary Express HTTP server & SSE live stream
│   └── test.js               # Automated test suite (9 test modules)
│
├── frontend/                 # Client-side web application (PWA)
│   ├── css/                  # Glassmorphic CSS styling
│   ├── images/               # App icons & graphic assets
│   ├── js/                   # Frontend modules (app.js, db.js, maptiles.js, notifications.js)
│   ├── about.html            # Mission, tech stack, and team details
│   ├── event-detail.html     # Event details, location map & volunteer RSVP
│   ├── events.html           # Browse, category filter & sort
│   ├── impact.html           # Real-time social impact metrics & analytics
│   ├── index.html            # Landing page with interactive hero map
│   ├── manifest.json         # PWA Manifest
│   ├── map.html              # Live Map with 0–5 km nearby alerts
│   ├── organizer.html        # Organizer portal with approval queue & auth modal
│   ├── post-event.html       # Submit public welfare events
│   ├── seed.html             # Starter event loader
│   └── sw.js                 # PWA Service Worker (emergency offline support)
│
├── .env                      # Local server configuration
├── .env.example              # Example environment template
└── package.json              # Root runner scripts
```

---

## How to Run

### 1. Install & Start

Open the `Serveo-app` folder in VS Code (the folder containing this `package.json`). From its integrated terminal run:

```bash
npm install
npm start
```

For automatic restart while editing, run `npm run dev`. If VS Code opened the parent `serveo 29 oct` folder, use its `npm start` task or open the `Serveo-app` folder directly.

Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

*(The Node.js backend serves both the API endpoints at `/api/...` and the frontend web pages from `http://localhost:3000`.)*

To show official contact links in the Terms and Privacy Policy, set `SERVEO_SUPPORT_EMAIL` and `SERVEO_PRIVACY_EMAIL` in `.env`. Acceptance records use the configured PostgreSQL database or the app's persistent local JSON fallback.

For local account-flow testing without Twilio, set `DEV_OTP_ALLOW=true` in `.env` while `NODE_ENV=development`; the test OTP is `123456`. The app ignores this bypass in production. Before deployment, set `NODE_ENV=production`, configure Twilio, use a strong `JWT_SECRET`, and set `COOKIE_SECURE=true` behind HTTPS.

### 2. Run Tests

To verify all backend functionality (database, events, volunteer RSVPs, auth, reviews, and false-alarm banning):

```bash
npm test
```

---

## Core Capabilities

- **Real-Time Live Updates**: Powered by Server-Sent Events (SSE) at `GET /api/events/stream`. Whenever an event is posted, approved, or joined, every connected client updates in real time.
- **First-visit Terms Gate**: A bottom-sheet agreement requires readers to expand and scroll through the current Terms before accepting. Acceptance is versioned and saved server-side for accounts and guest browser IDs.
- **Geospatial Proximity & Directions**: 0–5 km nearby proximity notifications, turn-by-turn Google Maps routing, and Haversine distance calculations.
- **Required Event Location & Date**: Event submissions require a future or current date, State/UT and District selections, a city/town, a local address or landmark, and a map pin. District choices come from India's Local Government Directory mirror and are cached in the browser; the first district lookup needs an internet connection.
- **Urgent Blood Requests**: Signed-in users can post hospital blood needs; opted-in donors with the same blood group and a saved location within 25 km receive browser alerts while SERVEO is open. Donors can respond privately, and requesters can close fulfilled requests.
- **Organizer Verification & Authentication**: Sign up and sign in using email, username, or Indian mobile number (`+91...`) with Twilio Verify SMS OTP.
- **False-Alarm Protection**: Two distinct false-alarm reviews automatically restrict the organizer and remove their events from public listings.
- **Zero External Database Setup Required**: Runs out of the box using the embedded local persistent datastore (`backend/data/serveo-db.json`), and automatically connects to PostgreSQL when `DATABASE_URL` is provided.
