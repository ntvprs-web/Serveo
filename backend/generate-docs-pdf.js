const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputPath = path.join(__dirname, '../SERVEO_Project_Guide_for_BTech_Students.pdf');

// Create document with A4 size and bufferPages enabled
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 36, bottom: 20, left: 36, right: 36 },
  bufferPages: true,
  autoFirstPage: false
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Color Palette
const COLORS = {
  primary: '#0D9488',      // Teal 600
  primaryDark: '#0F766E',  // Teal 700
  primaryLight: '#F0FDFA', // Teal 50
  primaryBorder: '#99F6E4',// Teal 200
  dark: '#0F172A',         // Slate 900
  body: '#334155',         // Slate 700
  muted: '#64748B',        // Slate 500
  lightBg: '#F8FAFC',      // Slate 50
  cardBorder: '#E2E8F0',   // Slate 200
  accent: '#EA580C',       // Orange 600
  accentLight: '#FFF7ED',  // Orange 50
  accentBorder: '#FFEDD5', // Orange 200
  blue: '#2563EB',         // Blue 600
  blueLight: '#EFF6FF',    // Blue 50
  blueBorder: '#BFDBFE',   // Blue 200
  green: '#16A34A',        // Green 600
  greenLight: '#F0FDF4',   // Green 50
  greenBorder: '#BBF7D0'   // Green 200
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 523.28

function drawSectionHeader(num, title, yPos) {
  const badgeSize = 18;
  doc.roundedRect(MARGIN, yPos, badgeSize, badgeSize, 3).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
     .text(String(num), MARGIN, yPos + 3.5, { width: badgeSize, align: 'center', lineBreak: false });
  
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.dark)
     .text(title, MARGIN + 26, yPos + 1.5, { lineBreak: false });
}

function drawBox(title, text, type = 'info', yPos, height) {
  let bg = COLORS.blueLight;
  let border = COLORS.blueBorder;
  let titleColor = COLORS.blue;
  let icon = 'ℹ️ Note:';

  if (type === 'analogy') {
    bg = COLORS.accentLight;
    border = COLORS.accentBorder;
    titleColor = COLORS.accent;
    icon = '💡 Intuitive Analogy:';
  } else if (type === 'success') {
    bg = COLORS.greenLight;
    border = COLORS.greenBorder;
    titleColor = COLORS.green;
    icon = '✅ Fast Run Guide:';
  }

  doc.roundedRect(MARGIN, yPos, CONTENT_WIDTH, height, 4).fillAndStroke(bg, border);

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(titleColor).text(`${icon} ${title}`, MARGIN + 8, yPos + 5, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.body).text(text, MARGIN + 8, yPos + 18, {
    width: CONTENT_WIDTH - 16,
    lineGap: 1.5
  });
}

function drawTechCard(title, role, whatItIs, whyWeUsedIt, yPos, height) {
  const cardW = CONTENT_WIDTH;

  doc.roundedRect(MARGIN, yPos, cardW, height, 4).fillAndStroke(COLORS.lightBg, COLORS.cardBorder);
  doc.rect(MARGIN, yPos, 4, height).fill(COLORS.primary); // Left accent bar

  // Title + Role
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.dark).text(title, MARGIN + 10, yPos + 4, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.primaryDark).text(`— ${role}`, MARGIN + 220, yPos + 4.5, { lineBreak: false });

  // Explanation
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.body).text(whatItIs, MARGIN + 10, yPos + 17, {
    width: cardW - 20,
    lineGap: 1.2
  });

  // Why
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.primaryDark).text('Why we chose it: ', MARGIN + 10, yPos + 32, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.body).text(whyWeUsedIt, MARGIN + 85, yPos + 32, {
    width: cardW - 95,
    lineGap: 1.2
  });
}

// ========================================================
// PAGE 1: TITLE, PROBLEM & 3-TIER ARCHITECTURE
// ========================================================
doc.addPage();

// Top decorative bar
doc.rect(MARGIN, 36, CONTENT_WIDTH, 4).fill(COLORS.primary);

doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.dark).text('SERVEO: Community Welfare Platform', MARGIN, 46, { lineBreak: false });
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.primary).text('A Complete Beginner-Friendly Technical & Architectural Guide for B.Tech 1st Year Students', MARGIN, 68, { lineBreak: false });
doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text('Dept. of Computer Science & Engineering (AI) · ABESIT Ghaziabad · Dr. A.P.J. AKTU Lucknow (2026-27)', MARGIN, 82, { lineBreak: false });

doc.strokeColor(COLORS.cardBorder).lineWidth(0.8).moveTo(MARGIN, 94).lineTo(MARGIN + CONTENT_WIDTH, 94).stroke();

// Section 1
drawSectionHeader('1', 'The Problem Statement: What is SERVEO & Why Did We Build It?', 102);

doc.font('Helvetica').fontSize(8).fillColor(COLORS.body).text(
  'Every single day across India, hundreds of critical community service events take place — emergency blood donation drives, free medical health checkup camps, food distribution for daily-wage workers, disaster relief shelters, and stray animal vaccinations. However, nearly 90% of citizens never discover these events in time. Organizers currently rely on closed WhatsApp groups, Instagram stories, or paper posters pasted on street poles, which only reach their existing personal network.\n\n' +
  'SERVEO solves this problem by creating a centralized, location-aware civic technology platform. Just as food delivery apps (like Zomato) let you instantly discover nearby restaurants on a live map, SERVEO lets citizens discover nearby community service initiatives within 0 to 5 km of where they are standing right now, without needing an app store download or mandatory login to browse.',
  MARGIN, 126, { width: CONTENT_WIDTH, lineGap: 2 }
);

drawBox(
  'The Real-Life College Scenario',
  'Imagine you are in your ABESIT college hostel and a nearby hospital in Ghaziabad suddenly faces an acute shortage of O-negative blood units for an emergency patient. Without SERVEO, the notice stays hidden on an obscure WhatsApp group. With SERVEO, students open the website on their phones, immediately see a red "Critical Need" pin on the live map 1.2 km away, click "Get Directions" on Google Maps, and click "Volunteer for this Event" to save a life!',
  'analogy', 198, 60
);

// Section 2
drawSectionHeader('2', 'How It Works: The 3-Tier Architecture Model', 266);

doc.font('Helvetica').fontSize(8).fillColor(COLORS.body).text(
  'In Computer Science, almost every web application is designed using the Client-Server model. SERVEO divides its software into three clean layers that communicate over standard internet protocols (HTTP & Server-Sent Events):',
  MARGIN, 290, { width: CONTENT_WIDTH, lineGap: 2 }
);

drawBox(
  'The Restaurant Analogy (How to Remember Client-Server Architecture Forever)',
  '1. Frontend (The Dining Room): What customers see and touch — the menu, tables, and buttons.\n' +
  '2. API / HTTP (The Waiter): Takes your order from the table to the kitchen and delivers the food back.\n' +
  '3. Backend (The Kitchen Chef): Checks the recipes, verifies permissions, cooks the data, and enforces rules.\n' +
  '4. Database (The Food Pantry): Where all ingredients (accounts, events, reviews) are safely stored permanently.',
  'analogy', 316, 60
);

// Architecture Diagram
const diagY = 384;
const boxW = 150;
const boxH = 50;
const gap = (CONTENT_WIDTH - (boxW * 3)) / 2;

// Box 1: Frontend
doc.roundedRect(MARGIN, diagY, boxW, boxH, 4).fillAndStroke(COLORS.blueLight, COLORS.blueBorder);
doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.blue).text('LAYER 1: FRONTEND', MARGIN, diagY + 6, { width: boxW, align: 'center', lineBreak: false });
doc.font('Helvetica').fontSize(7).fillColor(COLORS.body).text('Browser & Mobile UI (PWA)\nHTML5, CSS3, Vanilla JS\nMapbox GL JS & Geolocation', MARGIN, diagY + 18, { width: boxW, align: 'center', lineGap: 1.5 });

// Arrow 1 -> 2
doc.strokeColor(COLORS.primary).lineWidth(1.5).moveTo(MARGIN + boxW + 4, diagY + boxH/2).lineTo(MARGIN + boxW + gap - 4, diagY + boxH/2).stroke();
doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.primary).text('HTTP & SSE', MARGIN + boxW, diagY + boxH/2 - 8, { width: gap, align: 'center', lineBreak: false });

// Box 2: Backend
doc.roundedRect(MARGIN + boxW + gap, diagY, boxW, boxH, 4).fillAndStroke(COLORS.primaryLight, COLORS.primaryBorder);
doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.primaryDark).text('LAYER 2: BACKEND API', MARGIN + boxW + gap, diagY + 6, { width: boxW, align: 'center', lineBreak: false });
doc.font('Helvetica').fontSize(7).fillColor(COLORS.body).text('Node.js & Express.js\nTwilio Verify SMS OTP\nSSE Stream Engine (server.js)', MARGIN + boxW + gap, diagY + 18, { width: boxW, align: 'center', lineGap: 1.5 });

// Arrow 2 -> 3
doc.strokeColor(COLORS.primary).lineWidth(1.5).moveTo(MARGIN + (boxW*2) + gap + 4, diagY + boxH/2).lineTo(MARGIN + (boxW*2) + (gap*2) - 4, diagY + boxH/2).stroke();
doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.primary).text('SQL Query', MARGIN + (boxW*2) + gap, diagY + boxH/2 - 8, { width: gap, align: 'center', lineBreak: false });

// Box 3: Database
doc.roundedRect(MARGIN + (boxW*2) + (gap*2), diagY, boxW, boxH, 4).fillAndStroke(COLORS.accentLight, COLORS.accentBorder);
doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.accent).text('LAYER 3: DATABASE', MARGIN + (boxW*2) + (gap*2), diagY + 6, { width: boxW, align: 'center', lineBreak: false });
doc.font('Helvetica').fontSize(7).fillColor(COLORS.body).text('PostgreSQL 16 Relational DB\n(with zero-config local JSON engine)\nUsers, Events, Reviews', MARGIN + (boxW*2) + (gap*2), diagY + 18, { width: boxW, align: 'center', lineGap: 1.5 });

// Summary table
const tableY = 444;
doc.roundedRect(MARGIN, tableY, CONTENT_WIDTH, 116, 4).fillAndStroke(COLORS.lightBg, COLORS.cardBorder);
doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.dark).text('Summary of Architectural Responsibilities:', MARGIN + 8, tableY + 6, { lineBreak: false });

const tableRows = [
  ['Component', 'Technology', 'Role & Responsibility'],
  ['Client UI', 'HTML5, CSS3, Vanilla JS', 'Renders interactive map, category chips, event cards, and volunteer RSVP buttons.'],
  ['API Server', 'Node.js & Express.js', 'Processes HTTP requests, enforces security rules, hashes passwords, and serves SSE stream.'],
  ['Database', 'PostgreSQL / JSON Store', 'Stores accounts, events, contacts, volunteer applications, and reviews permanently.'],
  ['Location', 'Mapbox & Geolocation', 'Pins events onto coordinates and calculates 0–5 km proximity distances via Haversine.']
];

let rY = tableY + 20;
tableRows.forEach((r, idx) => {
  const isHead = idx === 0;
  doc.font(isHead ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHead ? 7.5 : 7)
     .fillColor(isHead ? COLORS.primaryDark : COLORS.body);
  doc.text(r[0], MARGIN + 8, rY, { width: 90, lineBreak: false });
  doc.text(r[1], MARGIN + 105, rY, { width: 130, lineBreak: false });
  doc.text(r[2], MARGIN + 240, rY, { width: CONTENT_WIDTH - 248, lineBreak: false });
  rY += 18;
});

// ========================================================
// PAGE 2: TECHNOLOGIES USED & WHY
// ========================================================
doc.addPage();

drawSectionHeader('3', 'Technology Stack: What Technologies Are Used & Why?', 40);

doc.font('Helvetica').fontSize(8).fillColor(COLORS.body).text(
  'Every single technology in SERVEO was intentionally chosen to solve a concrete engineering challenge while keeping the codebase fast, lightweight, and maintainable. Here is the full breakdown:',
  MARGIN, 64, { width: CONTENT_WIDTH, lineGap: 2 }
);

let cardY = 82;
const cardSpacing = 50;

drawTechCard(
  '1. HTML5, CSS3 & Vanilla JavaScript (ES6+)',
  'Frontend UI',
  'HTML provides the semantic skeleton. CSS provides modern dark-mode glassmorphism styling with backdrop blur. Vanilla JavaScript adds interactive controls without any heavy framework.',
  'Zero framework overhead (no 100MB React/Angular build step). Pages load in under 1 second even on weak 2G/3G mobile networks in semi-urban India.',
  cardY, 46
);
cardY += cardSpacing;

drawTechCard(
  '2. Node.js & Express.js',
  'Backend Server & REST API',
  'Node.js is an open-source JavaScript runtime environment that lets developers execute JavaScript on the server machine. Express.js is a minimal, fast web framework that creates API endpoints like GET /api/events and POST /api/events.',
  'Allows full-stack JavaScript (one language for both browser and server), handles asynchronous I/O natively with an event loop, and effortlessly serves thousands of simultaneous client requests.',
  cardY, 46
);
cardY += cardSpacing;

drawTechCard(
  '3. Mapbox GL JS & HTML5 Geolocation API',
  'Interactive Mapping & Coordinate Engine',
  'Mapbox renders vector street maps using GPU hardware acceleration. The browser navigator.geolocation API securely detects the user’s latitude and longitude upon user consent.',
  'Renders custom teardrop colored pins, handles pinch-to-zoom smoothly, and enables 1-click turn-by-turn navigation via Google Maps without expensive per-click fees.',
  cardY, 46
);
cardY += cardSpacing;

drawTechCard(
  '4. The Haversine Mathematical Formula',
  'Geospatial Proximity Calculations',
  'Earth is an oblate spheroid, not a flat 2D plane. You cannot calculate distance using simple Euclidean geometry (Pythagoras theorem). The Haversine formula applies spherical trigonometry to calculate the exact great-circle distance between two GPS coordinates.',
  'Calculates distance in milliseconds on the CPU, allowing the app to filter events within 1 km, 0–5 km, and sort events from nearest to farthest.',
  cardY, 46
);
cardY += cardSpacing;

drawTechCard(
  '5. Server-Sent Events (SSE)',
  'Real-Time Live Streaming Engine',
  'A persistent HTTP connection (GET /api/events/stream) where the server pushes new events and volunteer counts to the browser in real time without the browser needing to continuously poll or refresh the page.',
  'Much simpler and lighter than WebSockets because it operates over standard HTTP, reconnects automatically if network drops, and passes through strict college firewalls.',
  cardY, 46
);
cardY += cardSpacing;

drawTechCard(
  '6. PostgreSQL 16 & Persistent Datastore',
  'Data Storage Layer',
  'A powerful relational database management system (RDBMS) that stores users, events, volunteer applications, and reviews in structured tables with primary keys, foreign keys, and indexes.',
  'ACID guarantees prevent corrupted counts when multiple volunteers RSVP simultaneously. Also includes a persistent local JSON fallback so students can test the project without installing Docker.',
  cardY, 46
);
cardY += cardSpacing;

drawTechCard(
  '7. Twilio Verify SMS & Bcrypt Password Hashing',
  'Security, Authentication & Fraud Prevention',
  'Twilio sends authentic 6-digit one-time SMS verification codes to Indian mobile numbers (+91...). Bcrypt converts raw passwords into one-way cryptographic hashes with salt before saving to disk.',
  'Ensures organizers are real people with verified phone numbers, protects student accounts, and prevents raw passwords from ever being compromised.',
  cardY, 46
);
cardY += cardSpacing;

drawTechCard(
  '8. Progressive Web App (PWA) & Service Worker (sw.js)',
  'Offline Resilience & Emergency Access',
  'A background worker script that caches HTML, CSS, JavaScript, and icons into browser storage so the app works even during internet blackouts or disaster relief zones.',
  'No Google Play Store or Apple App Store download is required. Users simply open the link and can even tap "Add to Home Screen" to install it like a native app.',
  cardY, 46
);

// ========================================================
// PAGE 3: OVERALL WORKFLOW & STEP-BY-STEP FLOW
// ========================================================
doc.addPage();

drawSectionHeader('4', 'Overall System Workflow: Step-by-Step Execution', 40);

doc.font('Helvetica').fontSize(8).fillColor(COLORS.body).text(
  'To understand how the software works in practice, let us trace the life-cycle of four key real-world user flows through the frontend, API, and database:',
  MARGIN, 64, { width: CONTENT_WIDTH, lineGap: 2 }
);

const workflows = [
  {
    num: 'Flow 1',
    title: 'Citizen Event Discovery & Map Rendering',
    steps: [
      '1. User visits http://localhost:3000. Browser requests GPS permission.',
      '2. Geolocation API grabs user coordinates (e.g. 28.6327° N, 77.4475° E for Ghaziabad).',
      '3. Frontend sends HTTP GET request to /api/events?status=approved.',
      '4. Backend queries database, executes Haversine formula, and computes distanceKm for each event.',
      '5. Frontend receives JSON data, draws colored category pins on Mapbox, and highlights events within 5 km.'
    ]
  },
  {
    num: 'Flow 2',
    title: 'Volunteer RSVP & Instant Live Broadcast',
    steps: [
      '1. Student clicks "Volunteer for this Event" on the event details page.',
      '2. Browser sends POST /api/events/:id/join to the Node.js backend.',
      '3. Server increments volunteers_joined atomically in the database and creates an RSVP record.',
      '4. Server immediately broadcasts the VOLUNTEER_JOINED payload across the SSE stream (/api/events/stream).',
      '5. Every open browser tab across all devices instantly updates the volunteer progress bar without refreshing!'
    ]
  },
  {
    num: 'Flow 3',
    title: 'Organizer Event Submission & 1 km Proximity Alerts',
    steps: [
      '1. NGO representative visits "Post an Event" (post-event.html) and drops a pin on the interactive map.',
      '2. Submits event details (title, category, date, time, organizer, verified UPI donation link).',
      '3. Browser sends POST /api/events. Server validates input and saves the record in PostgreSQL.',
      '4. Server calculates distance to all opted-in users within 1 km and logs notification receipts in the database.',
      '5. Server broadcasts EVENT_CREATED over SSE. All users within 0–5 km receive an in-app audio chime & alert popup.'
    ]
  },
  {
    num: 'Flow 4',
    title: 'Community Trust Engine & 2-Strike False Alarm Protection',
    steps: [
      '1. If an organizer posts a fake, prank, or misleading event, attendees mark outcome = "false_alarm".',
      '2. Server records the review in the event_reviews table along with the user ID.',
      '3. The backend executes: COUNT(DISTINCT user_id) WHERE outcome = "false_alarm" for that organizer.',
      '4. If 2 distinct users flag the organizer as a false alarm, the backend sets organization_banned = TRUE.',
      '5. All events by this organizer are automatically suspended and hidden from public search and maps!'
    ]
  }
];

let wfY = 82;
workflows.forEach(w => {
  const cardH = 54;
  doc.roundedRect(MARGIN, wfY, CONTENT_WIDTH, cardH, 4).fillAndStroke(COLORS.lightBg, COLORS.cardBorder);

  // Badge & Title
  doc.roundedRect(MARGIN + 6, wfY + 5, 38, 13, 2).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF').text(w.num, MARGIN + 6, wfY + 7, { width: 38, align: 'center', lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.dark).text(w.title, MARGIN + 50, wfY + 5.5, { lineBreak: false });

  let stY = wfY + 20;
  doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.body);
  w.steps.forEach(st => {
    doc.text(st, MARGIN + 8, stY, { width: CONTENT_WIDTH - 16, lineBreak: false });
    stY += 8.5;
  });

  wfY += cardH + 6;
});

// Fast Authentication & Login Flow Box
drawBox(
  'Fast Login & Registration Feature (New in Release 2.0)',
  'To make testing and demonstration effortless, SERVEO includes 1-Click Fast Login and Register buttons on the /login page:\n' +
  '• ⚡ Quick Demo Organizer Login: Instantly signs in as Indian Red Cross Society (pre-verified NGO with 12 active events).\n' +
  '• ⚡ Quick Demo Volunteer Login: Instantly signs in as Aarav Sharma (verified student volunteer with active RSVPs).\n' +
  '• ⚡ 1-Click Fast Register: Generates a brand-new verified Indian community account in 1 second with pre-verified status.',
  'analogy', wfY + 4, 60
);

// ========================================================
// PAGE 4: CS CONCEPTS, RUN GUIDE & VIVA QUESTIONS
// ========================================================
doc.addPage();

drawSectionHeader('5', 'Core Computer Science Concepts Demonstrated', 40);

doc.font('Helvetica').fontSize(8).fillColor(COLORS.body).text(
  'As a 1st year engineering student, building or explaining SERVEO demonstrates mastery over foundational CS concepts:',
  MARGIN, 64, { width: CONTENT_WIDTH, lineGap: 2 }
);

const csConcepts = [
  ['RESTful API Design', 'HTTP methods (GET to read, POST to create, PATCH to update, DELETE to remove) with standard JSON payloads.'],
  ['Relational Data Modeling', 'Centralized PostgreSQL tables with PRIMARY KEY (unique IDs) and FOREIGN KEY relationships preventing duplicate data.'],
  ['Real-Time Event Streams', 'EventSource / Server-Sent Events allow the server to push updates reactively without wasteful client polling loops.'],
  ['Defensive Programming', 'Input validation, parameterized SQL queries preventing SQL Injection, and automated 2-strike anti-fraud rules.'],
  ['Same-Origin Web Hosting', 'Serving both static frontend assets and API endpoints from the same port (3000) eliminates CORS errors.']
];

let csY = 82;
csConcepts.forEach(c => {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.primaryDark).text(`• ${c[0]}: `, MARGIN + 4, csY, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.body).text(c[1], MARGIN + 120, csY, { width: CONTENT_WIDTH - 126, lineBreak: false });
  csY += 13;
});

drawSectionHeader('6', 'How to Run SERVEO Locally (In 1 Simple Command)', csY + 6);

drawBox(
  'Quick Start Command',
  '1. Open your terminal in the project directory: cd /Users/ayush/Documents/Serveo-app\n' +
  '2. Start the application: npm start\n' +
  '3. Open your web browser at: http://localhost:3000 (or http://localhost:3000/login)\n\n' +
  'To verify all 9 automated engineering test suites: npm test\n' +
  'This tests database connection, event creation, volunteer joins, user auth, and false-alarm banning automatically!',
  'success', csY + 28, 56
);

const vivaY = csY + 90;
drawSectionHeader('7', 'Top 5 Viva / Interview Questions & Model Answers', vivaY);

const viva = [
  ['Q1: Why did you use Server-Sent Events (SSE) instead of WebSockets?', 'SSE is unidirectional (server-to-client), operates over standard HTTP, supports automatic reconnection out of the box, and works through campus firewalls without complex WebSocket handshakes.'],
  ['Q2: How does the application calculate distance to an event?', 'Using the Haversine trigonometric formula, which accounts for Earth’s spherical curvature using latitude and longitude in radians to compute great-circle distance in kilometers.'],
  ['Q3: What prevents fake or prank events on SERVEO?', 'A dual-layer trust model: Organizers must verify their Indian mobile number via Twilio SMS OTP, and if two distinct users mark an event as "false_alarm", the organizer is automatically banned and their events are hidden.'],
  ['Q4: Why was Vanilla JS chosen over React for this project?', 'Vanilla JS has zero compilation build steps, zero bundle size overhead, and loads instantly on low-end mobile devices in rural areas where network bandwidth is limited.'],
  ['Q5: How does the database work if PostgreSQL is not installed on a computer?', 'The custom database manager (backend/db.js) includes a zero-config persistent local JSON fallback engine (data/serveo-db.json) that implements the exact same SQL queries and seeds 18 events automatically.']
];

let vY = vivaY + 22;
viva.forEach(v => {
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.dark).text(v[0], MARGIN + 4, vY, { lineBreak: false });
  vY += 9;
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.body).text(`Ans: ${v[1]}`, MARGIN + 4, vY, { width: CONTENT_WIDTH - 8, lineGap: 1 });
  vY += 17;
});

// ========================================================
// FOOTERS ON ALL PAGES
// ========================================================
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(i);
  const footerY = 841.89 - 22;
  doc.strokeColor(COLORS.cardBorder).lineWidth(0.5)
     .moveTo(MARGIN, footerY - 4).lineTo(MARGIN + CONTENT_WIDTH, footerY - 4).stroke();

  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted)
     .text('SERVEO — Community Public-Service Events Discovery Platform · B.Tech Technical Guide', MARGIN, footerY, { lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.primary)
     .text(`Page ${i + 1} of ${range.count}`, MARGIN + CONTENT_WIDTH - 70, footerY, { lineBreak: false });
}

doc.end();

writeStream.on('finish', () => {
  console.log(`✅ Perfectly proportioned ${range.count}-page PDF document created: ${outputPath}`);
});
