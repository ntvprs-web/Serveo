import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_SEO = {
  '/': {
    title: 'SERVEO | Find Community Service Events & Volunteer Drives Near You',
    description: 'Discover nearby blood drives, medical camps, food distribution, disaster relief, and volunteer events across India.',
    noIndex: false
  },
  '/events': {
    title: 'Discover Community Service Events Across India | SERVEO',
    description: 'Browse verified blood drives, medical camps, food rescue drives, disaster relief, and civic volunteering events near you.',
    noIndex: false
  },
  '/map': {
    title: 'Live Map of Nearby Community Events | SERVEO',
    description: 'Explore live verified community service events, blood camps, and relief drives on the interactive SERVEO India map.',
    noIndex: false
  },
  '/blood-donation': {
    title: 'Blood Donation Center & 90-Day Eligibility | SERVEO',
    description: 'Track your 90-day blood donation eligibility, complete donor screening, view regional blood bank stock, and download donation certificates.',
    noIndex: false
  },
  '/urgent-blood': {
    title: 'Urgent Blood Requests & Emergency Donors | SERVEO',
    description: 'Respond to urgent hospital blood needs across India and join nearby blood donation drives on SERVEO.',
    noIndex: false
  },
  '/food-donation': {
    title: 'Surplus Food Rescue & Meal Distribution Drives | SERVEO',
    description: 'Connect freshly cooked surplus meals from verified kitchens with nearby NGOs, shelters, and food distribution drives.',
    noIndex: false
  },
  '/impact': {
    title: 'Community Impact Dashboard & Trends | SERVEO',
    description: 'Track real-time volunteer hours, blood donations, rescued meals, and civic impact across Indian cities on SERVEO.',
    noIndex: false
  },
  '/about': {
    title: 'About SERVEO & Hosting Services | Community Action Across India',
    description: 'Learn about SERVEO, our CSE (AI) team at ABES Institute of Technology, UN SDG alignment, and community event hosting services.',
    noIndex: false
  },
  '/badges': {
    title: 'Organizer Verified Badges & Community Star Tiers | SERVEO',
    description: 'Explore SERVEO organizer cause specialist badges and free milestone star tiers for community hosts.',
    noIndex: false
  },
  '/terms': {
    title: 'Terms of Use | SERVEO',
    description: 'Review the SERVEO Terms of Use for volunteers, blood donors, and community event organizers.',
    noIndex: false
  },
  '/privacy': {
    title: 'Privacy Policy | SERVEO',
    description: 'Read how SERVEO protects your personal, location, donor, and account data with strict access controls.',
    noIndex: false
  },
  '/login': {
    title: 'Sign In or Register | SERVEO',
    description: 'Sign in or register a dual-verified SERVEO Volunteer or Organization account.',
    noIndex: true
  },
  '/organizer': {
    title: 'Organizer Command Portal | SERVEO',
    description: 'Manage your hosted SERVEO drives, volunteer rosters, verification documents, and community star tiers.',
    noIndex: true
  },
  '/post-event': {
    title: 'Host a Community Service Event | SERVEO',
    description: 'Publish a verified public-service drive on the SERVEO map and notify nearby volunteers.',
    noIndex: true
  },
  '/my-hours': {
    title: 'My Volunteer Hours & Free Achievement Badges | SERVEO',
    description: 'View your verified community service hours, free volunteer achievement badges, and downloadable service transcript.',
    noIndex: true
  },
  '/premium': {
    title: 'SERVEO Premium (25 km–100 km Extended Range) | SERVEO',
    description: 'Unlock 25 km to 100 km event discovery and extended emergency proximity alerts on SERVEO.',
    noIndex: true
  }
};

function upsertMeta(selector, attrName, attrValue, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function applyPageSeo({ title, description, canonicalPath, noIndex = false }) {
  if (title) document.title = title;
  if (description) upsertMeta('meta[name="description"]', 'name', 'description', description);
  upsertMeta('meta[name="robots"]', 'name', 'robots', noIndex ? 'noindex,follow' : 'index,follow');

  const path = canonicalPath || window.location.pathname || '/';
  const fullUrl = `${window.location.origin}${path}`;
  upsertCanonical(fullUrl);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', title || document.title);
  if (description) upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', fullUrl);
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title || document.title);
  if (description) upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
}

export default function SeoHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Dynamic event detail routes are handled directly inside EventDetailPage once loaded
    if (/^\/event(?:-detail|s-detail)?\//.test(pathname)) return;
    const meta = ROUTE_SEO[pathname] || ROUTE_SEO['/'];
    applyPageSeo({ ...meta, canonicalPath: pathname });
  }, [pathname]);

  return null;
}
