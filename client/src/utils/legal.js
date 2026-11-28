/* Legal copy matching backend/terms-version.js */
export const SERVEO_TERMS_VERSION = '2026-11-25-v2';

export const SERVEO_BUSINESS_DETAILS = {
  brandName: 'SERVEO',
  entityName: 'SERVEO Community Initiative',
  operatorName: 'Nivesh Kumar Tyagi (Team Lead)',
  address: 'ABES Institute of Technology Campus, NH-24, Ghaziabad, Uttar Pradesh 201009, India',
  supportEmail: 'ntvprs@gmail.com',
  privacyEmail: 'ntvprs@gmail.com',
  grievanceOfficer: 'Nivesh Kumar Tyagi — Grievance & Data Protection Officer',
  jurisdiction: 'Ghaziabad, Uttar Pradesh, India'
};

export const SERVEO_THIRD_PARTY_SDKS = [
  {
    name: 'PostgreSQL / Supabase Pooler (Backend)',
    category: 'Primary Database',
    dataShared: 'Account profiles, events, attendance logs, verification documents, consent receipts.',
    purpose: 'Core platform persistence & relational integrity.',
    privacyNote: 'Server-side only (`pg` driver); credentials never exposed to browser.'
  },
  {
    name: 'Resend Email API (`resend`)',
    category: 'Transactional Email Delivery',
    dataShared: 'Recipient email address & 6-digit OTP verification message.',
    purpose: 'Delivering 6-digit email OTP verification codes.',
    privacyNote: 'Server-side only; includes RFC 8058 one-click unsubscribe link.'
  },
  {
    name: 'Mapbox GL JS (`mapbox-gl`)',
    category: 'Interactive Mapping',
    dataShared: 'Map viewport tiles & optional user-initiated search coordinates.',
    purpose: 'Rendering community initiative locations on the Live Map.',
    privacyNote: 'Loaded only for interactive map views; restricted via CSP.'
  },
  {
    name: 'Google Fonts (`Plus Jakarta Sans`, `Instrument Serif`)',
    category: 'Typography CDN',
    dataShared: 'Standard browser font request headers (IP/User-Agent).',
    purpose: 'Consistent typography across devices.',
    privacyNote: 'Licensed under SIL Open Font License 1.1.'
  },
  {
    name: 'Unsplash (`images.unsplash.com`)',
    category: 'Category Photography',
    dataShared: 'Standard HTTPS image fetch when rendering event cards.',
    purpose: 'Category thumbnails for blood, medical, food, relief & civic drives.',
    privacyNote: 'Free under the Unsplash License; lazy-loaded with descriptive alt text.'
  },
  {
    name: 'Firebase & Supabase Client Packages (`package.json`)',
    category: 'Legacy / Inactive Client Auth SDKs',
    dataShared: 'None — removed from LoginPage authentication flow.',
    purpose: 'Inactive in current Resend + backend OTP workflow.',
    privacyNote: 'Audited: no sign-in or telemetry calls are made by LoginPage.'
  }
];

export const SERVEO_COOKIE_INVENTORY = [
  {
    name: 'serveo_token',
    type: 'HttpOnly Cookie (First-Party)',
    category: 'Essential',
    duration: '30 days',
    purpose: 'Maintains your authenticated volunteer or organizer session securely.'
  },
  {
    name: 'serveo_terms_version',
    type: 'Local Storage',
    category: 'Essential',
    duration: 'Persistent',
    purpose: 'Remembers which version of the Terms of Use you accepted.'
  },
  {
    name: 'serveo_guest_id',
    type: 'Local Storage',
    category: 'Essential',
    duration: 'Persistent',
    purpose: 'Stores an anonymous random guest identifier for server-side Terms acceptance.'
  },
  {
    name: 'serveo_cookie_consent',
    type: 'Local Storage',
    category: 'Essential',
    duration: 'Persistent',
    purpose: 'Stores your cookie & local storage consent preferences.'
  },
  {
    name: 'serveo_theme',
    type: 'Local Storage',
    category: 'Essential Preference',
    duration: 'Persistent',
    purpose: 'Remembers Light or Dark theme selection.'
  },
  {
    name: 'serveo_location',
    type: 'Local Storage',
    category: 'Functional (Consent-Based)',
    duration: 'Until cleared or consent withdrawn',
    purpose: 'Caches your optional GPS coordinates to filter nearby events within 0–5 km.'
  },
  {
    name: 'serveo_saved_events',
    type: 'Local Storage',
    category: 'Functional (Consent-Based)',
    duration: 'Until cleared or consent withdrawn',
    purpose: 'Remembers community events you bookmarked.'
  }
];

export const SERVEO_ASSET_LICENSES = [
  {
    asset: 'Plus Jakarta Sans (UI Font)',
    creator: 'Tokotype',
    license: 'SIL Open Font License 1.1 (OFL-1.1)',
    source: 'https://fonts.google.com/specimen/Plus+Jakarta+Sans'
  },
  {
    asset: 'Instrument Serif (Display Accent Font)',
    creator: 'Rodrigo Fuenzalida & Jordan Egstad',
    license: 'SIL Open Font License 1.1 (OFL-1.1)',
    source: 'https://fonts.google.com/specimen/Instrument+Serif'
  },
  {
    asset: 'Lucide React UI Icons (`lucide-react`)',
    creator: 'Lucide Contributors',
    license: 'ISC License',
    source: 'https://lucide.dev/'
  },
  {
    asset: 'Category Card Photography (10 Sector Images)',
    creator: 'Unsplash Contributors',
    license: 'Unsplash License (Commercial & Non-Commercial)',
    source: 'https://unsplash.com/license'
  },
  {
    asset: 'SERVEO Emblem (`serveo-logo.png`) & SVG Rosette Badges (`BadgeMedallion.jsx`)',
    creator: 'SERVEO Team',
    license: 'Original Project Assets · Copyright SERVEO Community Initiative',
    source: 'Internal Asset'
  },
  {
    asset: 'Core Frameworks (`React`, `Vite`, `Express`, `bcryptjs`, `jsonwebtoken`, `pdfkit`, `helmet`)',
    creator: 'Open-Source Maintainers',
    license: 'MIT / ISC Licenses',
    source: 'package.json & backend/package.json'
  }
];

export const SERVEO_LEGAL_SECTIONS = {
  terms: [
    ['1. Platform Operator & Scope', `${SERVEO_BUSINESS_DETAILS.entityName}, operated by ${SERVEO_BUSINESS_DETAILS.operatorName} (${SERVEO_BUSINESS_DETAILS.address}), provides SERVEO as a discovery and coordination platform for public-welfare initiatives including blood donation drives, medical camps, food distribution, disaster relief, and community events. SERVEO is not an emergency-response service and does not itself provide medical care or relief supplies.`],
    ['2. Eligibility & Age Consent (DPDP Act, 2023)', 'You must be at least 18 years old to register independently. Users under 18 may only register or submit personal data with verifiable Parent or Legal Guardian consent provided during registration.'],
    ['3. Your Account & Conduct', 'Provide accurate, current information genuinely belonging to you. Do not impersonate any person or organisation, publish misleading events, misuse volunteer contact or location information, or engage in unlawful or fraudulent activity.'],
    ['4. Organiser Verification & Moderation', 'Organisers must submit authentic event and contact details with permission to publish them. Two distinct verified false-alarm community reports automatically restrict an organizer account.'],
    ['5. Location & Notifications', 'Location access is optional. If enabled, device coordinates compute proximity (0–5 km standard or 25 km+ Premium) and match urgent blood/food alerts.'],
    ['6. Paid Badges, Premium Plans & Refunds', 'Paid Organizer Verified Badges and SERVEO Premium range subscriptions are governed by our Refund & Cancellation Policy (/refund-policy). Direct voluntary donations made to third-party NGOs or organizers via external UPI links are independent of SERVEO.'],
    ['7. Medical & Emergency Disclaimer', 'SERVEO is not a healthcare provider, blood bank, ambulance, or medical adviser. Qualified clinicians determine medical/donor eligibility. Contact local emergency numbers (112) in immediate danger.'],
    ['8. Privacy, Data Minimization & Erasure', 'Personal data is processed strictly for stated welfare coordination purposes in accordance with the Digital Personal Data Protection (DPDP) Act, 2023. You may request account & data deletion at any time on /privacy.'],
    ['9. Intellectual Property & Licensing', 'Platform fonts, icons, photography, and original assets are used under their respective open-source and stock licenses listed on /licenses.'],
    ['10. Governing Law & Grievance Officer', `These Terms are governed by the laws of India with jurisdiction in ${SERVEO_BUSINESS_DETAILS.jurisdiction}. Contact ${SERVEO_BUSINESS_DETAILS.grievanceOfficer} at ${SERVEO_BUSINESS_DETAILS.supportEmail}.`]
  ],
  privacy: [
    ['1. Data Fiduciary & Contact', `${SERVEO_BUSINESS_DETAILS.entityName} (${SERVEO_BUSINESS_DETAILS.address}) acts as the Data Fiduciary. Data Protection & Grievance Contact: ${SERVEO_BUSINESS_DETAILS.grievanceOfficer} (${SERVEO_BUSINESS_DETAILS.privacyEmail}).`],
    ['2. Strict Data Minimization — What We Collect & Exclude', 'We collect only the minimum data needed: (a) Account registration: Name, Username, verified Email, verified +91 Phone, hashed Password, Age Consent status (and Parent/Guardian name only if under 18), plus optional Blood Group (volunteers) or Organization Type (organizers). We do NOT collect Aadhaar numbers, PAN, exact birthdates, or advertising device IDs.'],
    ['3. Why Information Is Used', 'To verify identity via 6-digit Email OTP (Resend) and Mobile OTP, coordinate event RSVPs and attendance hours, match compatible blood donors during emergencies, verify organizers, and maintain legal consent records.'],
    ['4. Children & Minors (DPDP Act Sec. 9)', 'We do not knowingly collect data from anyone under 18 without verifiable Parent or Legal Guardian consent captured at registration. Parents/guardians may request immediate erasure of a minor’s data anytime via the Data Deletion form below or by emailing ' + SERVEO_BUSINESS_DETAILS.privacyEmail + '.'],
    ['5. Location, Cookies & No Behavioral Tracking', 'GPS coordinates are optional and only stored when you click "Near You" / donor screening. SERVEO runs zero third-party ad networks, zero analytics trackers, and uses a single HttpOnly session cookie (serveo_token). Manage functional local storage anytime via Cookie Preferences.'],
    ['6. Third-Party Sub-Processors & SDKs', 'We share data strictly with essential infrastructure providers listed in the Third-Party SDK Audit below (PostgreSQL database, Resend for OTP email delivery, and Mapbox for map tiles). Never sold or rented to third parties.'],
    ['7. Retention, Unsubscribe & Right to Erasure', 'Account data is retained while your account is active. You may unsubscribe from non-essential emails via any email footer or /unsubscribe, and permanently delete your account and scrub personal data immediately using the Data Deletion tool on this page.']
  ],
  refund: [
    ['1. Scope of Paid Features on SERVEO', 'SERVEO offers two optional paid features for verified community hosts and power users: (a) Lifetime Organizer Verified Category Badges (₹49–₹139 one-time) and (b) SERVEO Premium Extended Range plans (₹199/month or ₹1,499/year). Core volunteer discovery, blood donation matching, and basic event hosting remain free.'],
    ['2. Digital Verification Badges & Subscriptions', 'Because Organizer Badges and Premium range perks activate immediately upon OTP verification, fees are generally non-refundable once activated and verified on your account.'],
    ['3. Eligible Refund Cases (100% Refund)', 'You are eligible for a full refund if: (a) your payment was debited multiple times due to a duplicate transaction, (b) a technical error prevented the badge or Premium perk from activating within 24 hours, or (c) you submit a cancellation request within 48 hours of purchase without having published or boosted a live event using the perk.'],
    ['4. Revocation for Policy Violations', 'If an organizer account is permanently suspended under SERVEO’s 2-strike false-alarm moderation rule for publishing fabricated or fraudulent events, badge fees are forfeited without refund.'],
    ['5. Direct Third-Party Donations', 'SERVEO does not hold, escrow, or process voluntary UPI/bank donations made directly by citizens to external NGOs, hospitals, or relief campaigns. For refunds on third-party charitable donations, contact the recipient organization directly.'],
    ['6. How to Request a Refund & Timeline', `Email ${SERVEO_BUSINESS_DETAILS.supportEmail} or submit an inquiry on /about with your registered email, transaction reference, and reason within 7 days of payment. Approved refunds are processed back to the original payment method within 5–7 business days.`]
  ],
  cookies: [
    ['1. What Cookies & Browser Storage SERVEO Uses', 'SERVEO practices strict storage minimization. We do not use advertising cookies, cross-site retargeting pixels, or behavioral analytics cookies.'],
    ['2. Strictly Necessary Cookies & Storage', 'We use one secure HttpOnly cookie (`serveo_token`) to keep you signed in, plus essential `localStorage` keys (`serveo_terms_version`, `serveo_guest_id`, `serveo_cookie_consent`, `serveo_theme`) required for security, accessibility, and legal compliance.'],
    ['3. Functional Consent-Based Storage', 'With your consent via the Cookie Banner, SERVEO caches your optional GPS coordinates (`serveo_location`) and saved event bookmarks (`serveo_saved_events`) locally in your browser so filters load faster. Declining functional storage still lets you browse SERVEO freely.'],
    ['4. Third-Party Requests', 'Loading interactive maps on /map connects to Mapbox (`api.mapbox.com`), category cards fetch photos from Unsplash (`images.unsplash.com`), and typography loads from Google Fonts. Each is restricted by our Content Security Policy (CSP).'],
    ['5. Managing Your Preferences', 'You can change or withdraw functional cookie/storage consent anytime using the "Cookie Preferences" button in the site footer or on this page.']
  ]
};
