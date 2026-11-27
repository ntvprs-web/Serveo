export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const MAPBOX_STYLE = 'mapbox://styles/mapbox/outdoors-v12';

export const CATEGORIES = {
  blood: {
    key: 'blood',
    label: 'Blood Drive',
    emoji: '🩸',
    color: '#EF4444',
    pastelBg: '#FEE2E2',
    image: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=900&q=75'
  },
  medical: {
    key: 'medical',
    label: 'Medical Camp',
    emoji: '🏥',
    color: '#06B6D4',
    pastelBg: '#CFFAFE',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=75'
  },
  food: {
    key: 'food',
    label: 'Food Distribution',
    emoji: '🍱',
    color: '#F59E0B',
    pastelBg: '#FEF3C7',
    image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=900&q=75'
  },
  disaster: {
    key: 'disaster',
    label: 'Disaster Relief',
    emoji: '🆘',
    color: '#F97316',
    pastelBg: '#FFEDD5',
    image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=900&q=75'
  },
  animal: {
    key: 'animal',
    label: 'Animal Rescue',
    emoji: '🐕',
    color: '#8B5CF6',
    pastelBg: '#EDE9FE',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=75'
  },
  environment: {
    key: 'environment',
    label: 'Environment',
    emoji: '🌱',
    color: '#10B981',
    pastelBg: '#D1FAE5',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=900&q=75'
  },
  education: {
    key: 'education',
    label: 'Education',
    emoji: '📚',
    color: '#3B82F6',
    pastelBg: '#DBEAFE',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=75'
  },
  tech: {
    key: 'tech',
    label: 'Civic Tech',
    emoji: '💻',
    color: '#6366F1',
    pastelBg: '#E0E7FF',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=900&q=75'
  },
  seminar: {
    key: 'seminar',
    label: 'Seminar',
    emoji: '🎤',
    color: '#EC4899',
    pastelBg: '#FCE7F3',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=75'
  },
  other: {
    key: 'other',
    label: 'Others',
    emoji: '✨',
    color: '#A78BFA',
    pastelBg: '#F3E8FF',
    image: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=75'
  }
};

export const DEMO_HOSTING_TEMPLATES = [
  {
    id: 'demo-blood',
    title: 'Neighborhood Blood & Health Camp',
    category: 'blood',
    city: 'New Delhi',
    address: 'Community Welfare Centre, Connaught Place',
    volunteersNeeded: 80,
    urgency: 'live',
    description: 'Demo hosting template: Organize a local blood donation and vitals screening camp with 0–5 km volunteer alerts.'
  },
  {
    id: 'demo-food',
    title: 'Zero-Hunger Evening Meal Drive',
    category: 'food',
    city: 'Mumbai',
    address: 'Dadar Civic Grounds, Mumbai',
    volunteersNeeded: 50,
    urgency: 'upcoming',
    description: 'Demo hosting template: Coordinate surplus food rescue and hot meal distribution for daily-wage families.'
  },
  {
    id: 'demo-other',
    title: 'Senior Citizen Digital & Civic Helpdesk',
    category: 'other',
    customCategory: 'Senior Assistance',
    city: 'Bengaluru',
    address: 'Indiranagar Public Library Hall',
    volunteersNeeded: 25,
    urgency: 'upcoming',
    description: 'Demo hosting template (Others): Host any unlisted community service such as senior citizen digital literacy or legal aid.'
  }
];

export function getCategoryInfo(category) {
  const key = String(category || 'other');
  if (key.startsWith('custom:')) {
    return {
      ...CATEGORIES.other,
      key,
      label: key.slice(7).trim() || CATEGORIES.other.label
    };
  }
  if (Object.prototype.hasOwnProperty.call(CATEGORIES, key)) {
    return CATEGORIES[key];
  }
  return {
    ...CATEGORIES.other,
    key,
    label: key.replace(/[-_]+/g, ' ').trim() || CATEGORIES.other.label
  };
}

export const HOSTING_PACKAGES = [
  {
    id: 'community-starter',
    name: 'Community Starter',
    tagline: 'For neighborhood drives, cleanups & student clubs',
    price: 'Free Forever',
    accent: '#D1FAE5',
    features: [
      'Live Map pin & 0–5 km citizen discovery',
      'Real-time SSE volunteer RSVP counter',
      'Turn-by-turn Google Maps venue routing',
      'Automated 2-strike community trust badge'
    ]
  },
  {
    id: 'verified-ngo',
    name: 'Verified NGO Host',
    tagline: 'For hospitals, foundations & multi-city welfare drives',
    price: 'Verified Tier',
    accent: '#FEF3C7',
    features: [
      'Priority 1 km proximity push & chime alerts',
      'QR / Organizer check-in & verified volunteer hours',
      'Official PDF Volunteer & Donor Certificates',
      'Direct UPI donation link & blood stock board'
    ]
  },
  {
    id: 'civic-enterprise',
    name: 'Destination & Civic Partner',
    tagline: 'For municipal bodies, campuses & disaster response wings',
    price: 'Custom Support',
    accent: '#DBEAFE',
    features: [
      'Multi-destination venue coordination & heatmaps',
      'Disaster Mode emergency broadcast banner',
      'Dedicated food-rescue & urgent blood wave routing',
      'Exportable impact analytics & attendance logs'
    ]
  }
];

export const BADGE_OVERVIEW_BENEFITS = [
  {
    id: 'priority-boost',
    title: 'Priority Discovery Ranking',
    detail: 'Events you host in your badged cause rank higher on Discover & Home with a Verified Specialist seal.'
  },
  {
    id: 'trust-seal',
    title: 'Verified Cause Seal Everywhere',
    detail: 'Displays live on your Event Cards, Event Detail pages, Organizer Portal, and Volunteer Rosters.'
  },
  {
    id: 'impact-bonus',
    title: '+25% Impact Standing & Priority Alerts',
    detail: 'Boosts your Volunteer Impact Standing on My Hours and prioritizes matching-cause emergency alerts.'
  },
  {
    id: 'cause-funding',
    title: '100% Cause Verification Support',
    detail: 'Funds SMS alerts, hospital blood-stock verification, and food-safety dispatch for that specific sector.'
  }
];

const BADGE_META = {
  blood: {
    sealName: 'Crimson Lifesaver Crest',
    tierLabel: 'Most Popular',
    tierTone: 'coral',
    boostLabel: '2× Urgent Reach',
    spotlightCopy: 'Verified Blood Drive Specialist seal + donor wave priority'
  },
  medical: {
    sealName: 'Careline Clinical Crest',
    tierLabel: 'Verified Host',
    tierTone: 'sky',
    boostLabel: '1.8× Local Reach',
    spotlightCopy: 'Hospital-grade trust seal for checkups & diagnostic camps'
  },
  food: {
    sealName: 'Zero-Hunger Patron Crest',
    tierLabel: 'Community Pick',
    tierTone: 'gold',
    boostLabel: '1.8× Dispatch Boost',
    spotlightCopy: 'Priority visibility for surplus meal & ration distribution'
  },
  disaster: {
    sealName: 'Rapid Relief Vanguard',
    tierLabel: 'High Impact',
    tierTone: 'coral',
    boostLabel: '2.5× Emergency Reach',
    spotlightCopy: 'Top emergency dispatch ranking & crisis coordinator seal'
  },
  animal: {
    sealName: 'Compassion Guardian Seal',
    tierLabel: 'Specialist',
    tierTone: 'lavender',
    boostLabel: '1.6× Rescue Reach',
    spotlightCopy: 'Verified shelter & vaccination drive credibility badge'
  },
  environment: {
    sealName: 'Green Canopy Crest',
    tierLabel: 'Eco Leader',
    tierTone: 'mint',
    boostLabel: '1.8× Clean-Up Reach',
    spotlightCopy: 'Verified climate, plantation & beach clean-up steward seal'
  },
  education: {
    sealName: 'Scholar Torch Crest',
    tierLabel: 'Mentor Tier',
    tierTone: 'sky',
    boostLabel: '1.7× Campus Reach',
    spotlightCopy: 'Youth literacy & mentorship host trust credential'
  },
  tech: {
    sealName: 'Civic Digital Pioneer',
    tierLabel: 'Pro Tier',
    tierTone: 'lavender',
    boostLabel: '1.7× Builder Reach',
    spotlightCopy: 'Standout verified host seal for civic hackathons & workshops'
  },
  seminar: {
    sealName: 'Keynote Steward Crest',
    tierLabel: 'Elite Prestige',
    tierTone: 'gold',
    boostLabel: '2× Featured Slot',
    spotlightCopy: 'Premium speaker & townhall organizer verification crest'
  },
  other: {
    sealName: 'Civic Catalyst Crest',
    tierLabel: 'Verified Host',
    tierTone: 'gold',
    boostLabel: '1.6× Local Reach',
    spotlightCopy: 'Official verified seal for custom neighborhood initiatives'
  }
};

export function getBadgeDetails(cat, index = 0) {
  const price = 49 + index * 10;
  const meta = BADGE_META[cat.key] || BADGE_META.other;
  return {
    price,
    ...meta,
    perks: [
      `${meta.boostLabel} on ${cat.label} listings`,
      `Live "${meta.sealName}" on Event Cards`,
      '+25% Civic Standing bonus & Roster priority'
    ]
  };
}

export const VOLUNTEER_FREE_BADGES = [
  {
    id: 'blood-lifesaver',
    emoji: '🩸',
    title: 'Life Saver',
    subtitle: 'Blood Donor Hero',
    description: 'Earned free by donating blood or responding to an Urgent Blood Request.',
    color: '#EF4444',
    bg: '#FEE2E2'
  },
  {
    id: 'first-responder',
    emoji: '⚡',
    title: 'First Responder',
    subtitle: '1+ Verified Drive',
    description: 'Earned free on your first verified community event or check-in.',
    color: '#F59E0B',
    bg: '#FEF3C7'
  },
  {
    id: 'hunger-hero',
    emoji: '🍱',
    title: 'Hunger Hero',
    subtitle: 'Food Rescue Support',
    description: 'Earned free by supporting Food Distribution or Surplus Food Rescue.',
    color: '#EA580C',
    bg: '#FFEDD5'
  },
  {
    id: 'disaster-shield',
    emoji: '🆘',
    title: 'Disaster Shield',
    subtitle: 'Emergency Aid',
    description: 'Earned free by joining Disaster Relief & critical response drives.',
    color: '#DC2626',
    bg: '#FEE2E2'
  },
  {
    id: 'green-guardian',
    emoji: '🌱',
    title: 'Green Guardian',
    subtitle: 'Environment & Care',
    description: 'Earned free by volunteering for Afforestation or Animal Rescue drives.',
    color: '#10B981',
    bg: '#D1FAE5'
  },
  {
    id: 'hours-champion-25',
    emoji: '🏅',
    title: '25+ Hours Champion',
    subtitle: 'Civic Milestone',
    description: 'Earned free when you reach 25+ verified community service hours.',
    color: '#8B5CF6',
    bg: '#EDE9FE'
  }
];

export const ORGANIZER_STAR_TIERS = [
  { minEvents: 500, id: 'diamond', emoji: '💎', label: 'Diamond Star', color: '#0EA5E9', bg: '#E0F2FE' },
  { minEvents: 250, id: 'gold', emoji: '🥇', label: 'Gold Star', color: '#D97706', bg: '#FEF3C7' },
  { minEvents: 100, id: 'silver', emoji: '🥈', label: 'Silver Star', color: '#475569', bg: '#F1F5F9' },
  { minEvents: 50, id: 'bronze', emoji: '🥉', label: 'Bronze Star', color: '#B45309', bg: '#FFEDD5' },
  { minEvents: 20, id: 'active', emoji: '⭐', label: 'Active Host', color: '#059669', bg: '#D1FAE5' },
  { minEvents: 5, id: 'rising', emoji: '🌟', label: 'Rising Community', color: '#6366F1', bg: '#E0E7FF' }
];

export function getOrganizerStarTier(eventCount) {
  const count = Number(eventCount) || 0;
  return ORGANIZER_STAR_TIERS.find((t) => count >= t.minEvents) || null;
}

export function getNextOrganizerStarTier(eventCount) {
  const count = Number(eventCount) || 0;
  const ascending = [...ORGANIZER_STAR_TIERS].reverse();
  return ascending.find((t) => count < t.minEvents) || null;
}
