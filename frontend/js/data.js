/* ============================================
   CATEGORIES
   ============================================ */
const CATEGORIES = {
  blood: { label: 'Blood Drive', icon: '🩸', color: '#EF4444' },
  medical: { label: 'Medical Camp', icon: '🏥', color: '#06B6D4' },
  food: { label: 'Food Distribution', icon: '🍱', color: '#F59E0B' },
  disaster: { label: 'Disaster Relief', icon: '🆘', color: '#F97316' },
  animal: { label: 'Animal Rescue', icon: '🐕', color: '#8B5CF6' },
  environment: { label: 'Environment', icon: '🌱', color: '#10B981' },
  education: { label: 'Education', icon: '📚', color: '#3B82F6' },
  tech: { label: 'Tech Event', icon: '💻', color: '#6366F1' },
  seminar: { label: 'Seminar', icon: '🎤', color: '#EC4899' },
  other: { label: 'Other', icon: '✨', color: '#A78BFA' },
};

function getCategoryInfo(category) {
  const key = String(category || 'other');
  if (key.startsWith('custom:')) {
    return { ...CATEGORIES.other, label: key.slice(7).trim() || CATEGORIES.other.label };
  }
  if (Object.prototype.hasOwnProperty.call(CATEGORIES, key)) return CATEGORIES[key];
  return { ...CATEGORIES.other, label: key.replace(/[-_]+/g, ' ').trim() || CATEGORIES.other.label };
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function isOtherCategory(category) {
  const key = String(category || '');
  return key === 'other' || key.startsWith('custom:') || !Object.prototype.hasOwnProperty.call(CATEGORIES, key);
}

/* Dynamic "now" based on current date for real-time urgency rendering, dynamically shifting sample events forward so they are always current */
const DEMO_NOW = new Date();
const baseDate = new Date('2026-08-21'); // original seed date
const dayOffset = Math.floor((DEMO_NOW - baseDate) / 86400000);

function shiftDate(dateStr) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split('T')[0];
}

/* ============================================
   EVENTS DATASET
   ============================================ */
const EVENTS_DATA = [
  {
    id: 1, title: 'Emergency Blood Donation Camp', category: 'blood',
    organizer: 'Indian Red Cross Society', verified: true, sampleOrganizerHostedCount: 12,
    city: 'New Delhi', address: 'Red Cross Bhawan, Parliament Street, New Delhi',
    lat: 28.6270, lng: 77.2140, date: shiftDate(''), startTime: '09:00', endTime: '17:00',
    volunteersNeeded: 200, volunteersJoined: 87, urgency: 'live',
    description: 'Delhi is facing a critical shortage of O-negative and B-negative blood units. Walk-ins welcome; every donation is screened and can save up to three lives.',
    donationLink: 'upi://pay?pa=indianredcross@sbi', tags: ['blood', 'emergency', 'urgent'],
  },
  {
    id: 2, title: 'Free Medical Health Screening', category: 'medical',
    organizer: 'Indian Red Cross Society', verified: true, sampleOrganizerHostedCount: 12,
    city: 'New Delhi', address: 'Community Health Centre, Karol Bagh, New Delhi',
    lat: 28.6519, lng: 77.1909, date: shiftDate(''), startTime: '10:00', endTime: '16:00',
    volunteersNeeded: 50, volunteersJoined: 32, urgency: 'upcoming',
    description: 'Free general health screening including BP, sugar, and basic diagnostics for underserved families. Doctors and lab technicians on-site.',
    donationLink: null, tags: ['medical', 'free', 'screening'],
  },
  {
    id: 3, title: 'Community Food Distribution Drive', category: 'food',
    organizer: 'Akshaya Patra Foundation', verified: true, sampleOrganizerHostedCount: 5,
    city: 'Mumbai', address: 'Dharavi Community Hall, Mumbai',
    lat: 19.0410, lng: 72.8570, date: shiftDate(''), startTime: '12:00', endTime: '15:00',
    volunteersNeeded: 150, volunteersJoined: 120, urgency: 'live',
    description: 'Hot, nutritious meals for daily-wage families and children. Volunteers help pack, serve, and coordinate queue management.',
    donationLink: 'upi://pay?pa=akshayapatra@icici', tags: ['food', 'meals', 'children'],
  },
  {
    id: 4, title: 'Flood Relief Camp', category: 'disaster',
    organizer: 'NDRF Community Wing', verified: true, sampleOrganizerHostedCount: 25,
    city: 'Patna', address: 'Gandhi Maidan Relief Center, Patna',
    lat: 25.6127, lng: 85.1447, date: shiftDate(''), startTime: '08:00', endTime: '20:00',
    volunteersNeeded: 100, volunteersJoined: 45, urgency: 'critical',
    description: 'Displaced families need dry rations, clean drinking water, and temporary shelter kits following heavy monsoon flooding.',
    donationLink: 'upi://pay?pa=ndrfrelief@sbi', tags: ['disaster', 'flood', 'urgent'],
  },
  {
    id: 5, title: 'Stray Animal Vaccination Drive', category: 'animal',
    organizer: 'Blue Cross of India', verified: true,
    city: 'Chennai', address: 'Blue Cross Shelter, Velachery, Chennai',
    lat: 12.9791, lng: 80.2213, date: shiftDate(''), startTime: '09:00', endTime: '14:00',
    volunteersNeeded: 80, volunteersJoined: 60, urgency: 'live',
    description: 'Free rabies vaccination and sterilization camp for stray dogs. Volunteers assist with handling, records, and post-care.',
    donationLink: 'upi://pay?pa=bluecrossindia@hdfc', tags: ['animal', 'vaccination'],
  },
  {
    id: 6, title: 'Tree Plantation Marathon', category: 'environment',
    organizer: 'Uttarakhand Green Circle', verified: true,
    city: 'Dehradun', address: 'Rajaji National Park Buffer Zone, Dehradun',
    lat: 30.3398, lng: 78.0510, date: shiftDate(''), startTime: '07:00', endTime: '11:00',
    volunteersNeeded: 300, volunteersJoined: 200, urgency: 'upcoming',
    description: 'A large-scale native-species plantation drive to restore the buffer forest. Saplings, tools, and refreshments provided.',
    donationLink: null, tags: ['environment', 'trees', 'plantation'],
  },
  {
    id: 7, title: 'Free Eye Checkup Camp', category: 'medical',
    organizer: 'Aravind Eye Care Trust', verified: true,
    city: 'Madurai', address: 'Aravind Eye Hospital Outreach Wing, Madurai',
    lat: 9.9195, lng: 78.1194, date: shiftDate(''), startTime: '08:30', endTime: '13:30',
    volunteersNeeded: 60, volunteersJoined: 42, urgency: 'live',
    description: 'Free vision screening, cataract detection, and spectacles distribution for elderly and low-income patients.',
    donationLink: 'upi://pay?pa=aravindeye@sbi', tags: ['medical', 'eyecare'],
  },
  {
    id: 8, title: 'Community Blood Donation Mega Camp', category: 'blood',
    organizer: 'Rotary Club Bengaluru', verified: true,
    city: 'Bengaluru', address: 'Rotary Bhavan, Indiranagar, Bengaluru',
    lat: 12.9719, lng: 77.6412, date: shiftDate(''), startTime: '09:00', endTime: '18:00',
    volunteersNeeded: 250, volunteersJoined: 90, urgency: 'upcoming',
    description: 'One of the city\'s largest quarterly blood camps, in partnership with three regional blood banks.',
    donationLink: null, tags: ['blood', 'mega camp'],
  },
  {
    id: 9, title: 'Earthquake Preparedness Workshop', category: 'education',
    organizer: 'NDMA Civil Defence Cell', verified: true,
    city: 'New Delhi', address: 'Community Centre, Dwarka Sector 12, New Delhi',
    lat: 28.5921, lng: 77.0460, date: shiftDate(''), startTime: '11:00', endTime: '13:00',
    volunteersNeeded: 30, volunteersJoined: 12, urgency: 'upcoming',
    description: 'Hands-on training on earthquake drills, first aid, and household emergency kits, led by certified civil defence trainers.',
    donationLink: null, tags: ['education', 'safety', 'workshop'],
  },
  {
    id: 10, title: 'Free Dental Camp', category: 'medical',
    organizer: 'Smile Foundation', verified: true,
    city: 'Jaipur', address: 'Smile Foundation Clinic, Malviya Nagar, Jaipur',
    lat: 26.8535, lng: 75.8039, date: shiftDate(''), startTime: '10:00', endTime: '15:00',
    volunteersNeeded: 40, volunteersJoined: 38, urgency: 'ending',
    description: 'Free dental checkups, cleaning, and extractions for underserved communities. Only a few volunteer slots remain today.',
    donationLink: 'upi://pay?pa=smilefoundation@icici', tags: ['medical', 'dental'],
  },
  {
    id: 11, title: 'Meals for Migrant Workers', category: 'food',
    organizer: 'Robin Hood Army Kolkata', verified: true,
    city: 'Kolkata', address: 'Howrah Railway Station Relief Point, Kolkata',
    lat: 22.5839, lng: 88.3428, date: shiftDate(''), startTime: '19:00', endTime: '22:00',
    volunteersNeeded: 500, volunteersJoined: 300, urgency: 'critical',
    description: 'Surplus-food rescue and distribution to migrant workers and homeless families near the station. Urgent need for evening volunteers.',
    donationLink: 'upi://pay?pa=robinhoodarmy@ybl', tags: ['food', 'urgent', 'night shift'],
  },
  {
    id: 12, title: 'River Cleanup & Plastic Drive', category: 'environment',
    organizer: 'Cochin Nature Society', verified: true,
    city: 'Kochi', address: 'Marine Drive Waterfront, Kochi',
    lat: 9.9658, lng: 76.2803, date: shiftDate(''), startTime: '06:30', endTime: '09:30',
    volunteersNeeded: 150, volunteersJoined: 70, urgency: 'upcoming',
    description: 'Backwater clean-up and single-use plastic collection drive, followed by a segregation and recycling workshop.',
    donationLink: null, tags: ['environment', 'cleanup', 'plastic'],
  },
  {
    id: 13, title: 'Vaccination Camp for Street Dogs', category: 'animal',
    organizer: 'People for Animals Chennai', verified: true,
    city: 'Chennai', address: 'PFA Shelter, Perungudi, Chennai',
    lat: 12.9635, lng: 80.2422, date: shiftDate(''), startTime: '09:00', endTime: '13:00',
    volunteersNeeded: 45, volunteersJoined: 33, urgency: 'live',
    description: 'Rabies vaccination and basic health checks for community dogs, with volunteer-led awareness outreach in the neighbourhood.',
    donationLink: null, tags: ['animal', 'vaccination'],
  },
  {
    id: 14, title: 'Clothes & Blanket Collection', category: 'disaster',
    organizer: 'HelpAge India', verified: true,
    city: 'New Delhi', address: 'Community Centre, Lajpat Nagar, New Delhi',
    lat: 28.5677, lng: 77.2434, date: shiftDate(''), startTime: '10:00', endTime: '18:00',
    volunteersNeeded: 40, volunteersJoined: 28, urgency: 'live',
    description: 'Winter clothing and blanket collection for elderly and homeless residents ahead of the cold season. Sorting volunteers needed.',
    donationLink: 'upi://pay?pa=helpageindia@sbi', tags: ['disaster', 'winter relief'],
  },
  {
    id: 15, title: 'Adult Literacy & Digital Skills Camp', category: 'education',
    organizer: 'Pratham Education Foundation', verified: true,
    city: 'Lucknow', address: 'Pratham Learning Centre, Aliganj, Lucknow',
    lat: 26.8845, lng: 80.9342, date: shiftDate(''), startTime: '15:00', endTime: '18:00',
    volunteersNeeded: 60, volunteersJoined: 25, urgency: 'upcoming',
    description: 'Free literacy and basic smartphone/digital-payment training sessions for adult learners in the community.',
    donationLink: null, tags: ['education', 'literacy', 'digital'],
  },
  {
    id: 16, title: 'Disaster Relief Supply Drive', category: 'disaster',
    organizer: 'SEEDS India', verified: true, sampleOrganizerHostedCount: 50,
    city: 'Bhopal', address: 'SEEDS Regional Office, Arera Colony, Bhopal',
    lat: 23.2276, lng: 77.4413, date: shiftDate(''), startTime: '09:00', endTime: '17:00',
    volunteersNeeded: 120, volunteersJoined: 55, urgency: 'critical',
    description: 'Packing and dispatch of emergency relief kits — food, water purification tablets, and first-aid — for cyclone-affected coastal districts.',
    donationLink: 'upi://pay?pa=seedsindia@icici', tags: ['disaster', 'relief kits'],
  },
  {
    id: 17, title: 'Animal Shelter Adoption & Vaccination Fair', category: 'animal',
    organizer: 'RAWW — Resqink Association', verified: true,
    city: 'Pune', address: 'RAWW Shelter Grounds, Baner, Pune',
    lat: 18.5590, lng: 73.7868, date: shiftDate(''), startTime: '10:00', endTime: '17:00',
    volunteersNeeded: 100, volunteersJoined: 80, urgency: 'upcoming',
    description: 'Adoption drive, free vaccination, and microchipping for rescued animals. Volunteers needed for handling and adopter counselling.',
    donationLink: null, tags: ['animal', 'adoption'],
  },
  {
    id: 18, title: 'Corporate Blood Donation Drive', category: 'blood',
    organizer: 'Lions Club Hyderabad', verified: true,
    city: 'Hyderabad', address: 'HITEC City Convention Centre, Hyderabad',
    lat: 17.4435, lng: 78.3772, date: shiftDate(''), startTime: '09:30', endTime: '16:30',
    volunteersNeeded: 150, volunteersJoined: 140, urgency: 'ending',
    description: 'IT-corridor blood donation drive in partnership with local tech companies. Almost at capacity — a few slots left.',
    donationLink: null, tags: ['blood', 'corporate'],
  },
  {
    id: 19, title: 'Tech for Good Community Workshop', category: 'tech',
    organizer: 'Spark Youth Collective', verified: false, sampleOrganizerHostedCount: 1,
    city: 'Ghaziabad', address: 'Community Innovation Hub, Indirapuram, Ghaziabad',
    lat: 28.6418, lng: 77.3712, date: shiftDate(''), startTime: '10:00', endTime: '14:00',
    volunteersNeeded: 24, volunteersJoined: 8, urgency: 'upcoming',
    description: 'A hands-on workshop introducing local students to accessible technology and digital skills.',
    donationLink: null, tags: ['tech', 'education', 'community'],
  },
  {
    id: 20, title: 'Community First Aid Seminar', category: 'seminar',
    organizer: 'Northside Community Volunteers', verified: false, sampleOrganizerHostedCount: 2,
    city: 'New Delhi', address: 'Neighbourhood Resource Centre, Rohini, New Delhi',
    lat: 28.7041, lng: 77.1025, date: shiftDate(''), startTime: '16:00', endTime: '18:00',
    volunteersNeeded: 16, volunteersJoined: 5, urgency: 'upcoming',
    description: 'A community-led introduction to first aid, emergency readiness, and when to contact trained responders.',
    donationLink: null, tags: ['seminar', 'first aid', 'safety'],
  },
  {
    id: 21, title: 'Neighbourhood Skills Share', category: 'other',
    organizer: 'Together Ghaziabad', verified: false, sampleOrganizerHostedCount: 1,
    city: 'Ghaziabad', address: 'Indirapuram Community Hall, Ghaziabad',
    lat: 28.6434, lng: 77.3697, date: shiftDate(''), startTime: '11:00', endTime: '15:00',
    volunteersNeeded: 20, volunteersJoined: 6, urgency: 'upcoming',
    description: 'A volunteer-led exchange where neighbours share practical skills and help residents find local support.',
    donationLink: null, tags: ['community', 'skills', 'other'],
  },
];

/* ============================================
   GEOLOCATION
   ============================================ */
let userLocation = null;

function getUserLocation() {
  return new Promise((resolve) => {
    if (userLocation) return resolve(userLocation);
    const fallback = { lat: 28.6139, lng: 77.2090, isFallback: true }; // New Delhi

    if (!navigator.geolocation) {
      userLocation = fallback;
      return resolve(userLocation);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(userLocation);
      },
      () => {
        userLocation = fallback;
        resolve(userLocation);
      },
      { timeout: 6000, maximumAge: 300000 }
    );
  });
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDirectionsURL(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/* ============================================
   FORMATTING
   ============================================ */
function formatEventDate(dateStr) {
  if (!dateStr || Number.isNaN(new Date(dateStr + 'T00:00:00').getTime())) {
    return DEMO_NOW.toLocaleDateString('en-GB');
  }
  const date = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((date - new Date(DEMO_NOW.toDateString())) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime12(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatEventTime(event) {
  return `${formatTime12(event.startTime)} – ${formatTime12(event.endTime)}`;
}

/* ============================================
   RENDER HELPERS
   ============================================ */
const URGENCY_META = {
  critical: { cls: 'badge-critical', label: 'Critical Need' },
  live: { cls: 'badge-live', label: 'Happening Now' },
  ending: { cls: 'badge-ending', label: 'Ending Soon' },
  upcoming: { cls: 'badge-upcoming', label: 'Upcoming' },
};

function urgencyBadgeHTML(event) {
  const meta = URGENCY_META[event.urgency] || URGENCY_META.upcoming;
  return `<span class="badge ${meta.cls}"><span class="badge-dot"></span>${meta.label}</span>`;
}

function verifiedBadgeHTML(event) {
  return event.verified === true ? `<span class="badge badge-verified verified-badge-interactive" role="button" tabindex="0" aria-label="Verified organizer. Show verification details" title="Select for verification details">✓ Verified</span>` : '';
}

function ownsCategoryBadge(category) {
  try {
    const user = JSON.parse(localStorage.getItem('serveo_user') || 'null');
    const ownerKey = String(user?.id || user?.username || 'guest');
    const badges = JSON.parse(localStorage.getItem(`serveo_category_badges_${ownerKey}`) || '[]');
    const categoryKey = String(category || 'other');
    return Array.isArray(badges) && badges.includes(categoryKey.startsWith('custom:') ? 'other' : categoryKey);
  } catch { return false; }
}

function categoryBadgeHTML(category) {
  if (!ownsCategoryBadge(category)) return '';
  const cat = getCategoryInfo(category);
  return `<span class="event-specialty-badge category-badge-owned" title="Purchased demo category badge: ${escapeHTML(cat.label)}" style="--specialty-color:${cat.color}"><span aria-hidden="true">${cat.icon}</span><span>${escapeHTML(cat.label)} · Organizer badge</span></span>`;
}

function categoryLabelHTML(category) {
  const cat = getCategoryInfo(category);
  return `<span class="event-category-label" title="Event category: ${escapeHTML(cat.label)}">${escapeHTML(cat.label)}</span>`;
}

function organizerMilestoneInfo(eventCount) {
  const count = Math.max(0, Number(eventCount) || 0);
  const levels = [
    { threshold: 0, title: 'Rising Organizer', className: 'rank-rising', next: 5 },
    { threshold: 5, title: 'Bronze Partner', className: 'rank-bronze', next: 10 },
    { threshold: 10, title: 'Silver Partner', className: 'rank-silver', next: 25 },
    { threshold: 25, title: 'Gold Partner', className: 'rank-gold', next: 50 },
    { threshold: 50, title: 'Platinum Partner', className: 'rank-platinum', next: null },
  ];
  const level = [...levels].reverse().find(item => count >= item.threshold);
  const progress = level.next
    ? Math.min(100, Math.round(((count - level.threshold) / (level.next - level.threshold)) * 100))
    : 100;
  return { ...level, count, progress, remaining: level.next ? level.next - count : 0 };
}

function organizerEventCountForEvent(event, eventUniverse = EVENTS_DATA) {
  const sampleCount = Number(event?.sampleOrganizerHostedCount);
  if (Number.isFinite(sampleCount) && sampleCount > 0) return sampleCount;
  const organizer = String(event?.organizer || '').trim().toLowerCase();
  const matchingEvents = (Array.isArray(eventUniverse) ? eventUniverse : []).filter(item =>
    String(item?.organizer || '').trim().toLowerCase() === organizer
  ).length;
  return Math.max(1, matchingEvents);
}

function organizerRankForEvent(event, eventUniverse = EVENTS_DATA) {
  return organizerMilestoneInfo(organizerEventCountForEvent(event, eventUniverse));
}

function organizerRankBadgeHTML(event, eventUniverse = EVENTS_DATA) {
  const rank = organizerRankForEvent(event, eventUniverse);
  const sampleNote = Number(event?.sampleOrganizerHostedCount) > 0 ? ' · sample profile' : '';
  const rankBadge = `<span class="badge organizer-rank-badge ${rank.className}" title="${rank.title} · ${rank.count} hosted events${sampleNote}">${rank.title}</span>`;
  return `${rankBadge}${verifiedBadgeHTML(event)}`;
}

function organizerAchievementHTML(eventCount, categories = []) {
  const milestone = organizerMilestoneInfo(eventCount);
  const specialtyBadges = [...new Set(categories)].map(categoryBadgeHTML).filter(Boolean).join('');
  const nextStep = milestone.next
    ? `${milestone.remaining} more ${milestone.remaining === 1 ? 'event' : 'events'} to ${organizerMilestoneInfo(milestone.next).title}`
    : 'Top organizer milestone reached';
  return `
    <div class="organizer-achievement-panel ${milestone.className}">
      <div class="organizer-rank-ribbon ${milestone.className}">
        <span class="rank-ribbon-medal" aria-hidden="true">✦</span>
        <span class="rank-ribbon-copy"><small>ORGANIZER RANK</small><strong>${milestone.title}</strong></span>
        <span class="rank-ribbon-count">${milestone.count} hosted</span>
      </div>
      <div class="organizer-milestone-copy"><strong>${milestone.count} ${milestone.count === 1 ? 'event' : 'events'} hosted</strong><span>${nextStep}</span></div>
      <div class="organizer-milestone-track" role="progressbar" aria-label="Progress to next organizer rank" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${milestone.progress}"><span style="width:${milestone.progress}%"></span></div>
      ${specialtyBadges ? `<div class="organizer-specialties" aria-label="Purchased event category badges">${specialtyBadges}</div>` : '<p class="organizer-specialty-empty">Purchase a category badge to feature it on your organizer profile.</p>'}
    </div>`;
}

function volunteerProgressHTML(event) {
  const cat = getCategoryInfo(event.category);
  const pct = Math.min(100, Math.round((event.volunteersJoined / event.volunteersNeeded) * 100));
  return `
    <div class="volunteer-progress">
      <div class="volunteer-progress-track">
        <div class="volunteer-progress-fill" style="width:${pct}%; background:${cat.color}"></div>
      </div>
      <span class="volunteer-progress-label">${event.volunteersJoined} / ${event.volunteersNeeded} volunteers</span>
    </div>`;
}

function eventCardHTML(event, distanceKm, eventUniverse = EVENTS_DATA) {
  const cat = getCategoryInfo(event.category);
  const distanceLabel = typeof distanceKm === 'number' ? `${distanceKm.toFixed(1)} km away` : '';
  const renderText = value => event._htmlEscaped ? String(value ?? '') : escapeHTML(value);
  const eventHref = `/event/${encodeURIComponent(String(event.id ?? ''))}`;
  const locationLabel = [event.city, event.district, event.state].filter(Boolean).map(renderText).join(', ');
  return `
    <a href="${escapeHTML(eventHref)}" class="event-card glass-card">
      <div class="event-card-top" style="background: linear-gradient(135deg, ${cat.color}33, ${cat.color}0d)">
        <span class="event-card-icon" style="background:${cat.color}">${cat.icon}</span>
        <div class="event-card-badges">
          ${categoryBadgeHTML(event.category) || categoryLabelHTML(event.category)}
          ${urgencyBadgeHTML(event)}
          ${organizerRankBadgeHTML(event, eventUniverse)}
        </div>
      </div>
      <div class="event-card-body">
        <span class="event-card-cat">${escapeHTML(cat.label)}</span>
        <h3>${renderText(event.title)}</h3>
        <p class="event-card-org">${renderText(event.organizer)}</p>
        <div class="event-card-meta">
          <span>📅 ${formatEventDate(event.date)}</span>
          <span>📍 ${locationLabel}${distanceLabel ? ' · ' + distanceLabel : ''}</span>
        </div>
        ${volunteerProgressHTML(event)}
      </div>
    </a>`;
}
