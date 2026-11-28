import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, getGuestId, haversineKm } from '../utils/api';
import { SERVEO_TERMS_VERSION } from '../utils/legal';

const AppContext = createContext(null);

export function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // AudioContext blocked before user gesture
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [disasterMode, setDisasterMode] = useState({ active: false });
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [sseConnected, setSseConnected] = useState(false);

  const [theme, setTheme] = useState(() => localStorage.getItem('serveo_theme') || 'light');
  const [isPremium, setIsPremium] = useState(() => localStorage.getItem('serveo_premium_status') === 'active');
  const [userLocation, setUserLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('serveo_location');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [savedIds, setSavedIds] = useState(() => {
    try {
      const raw = localStorage.getItem('serveo_saved_events');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [badgeRecords, setBadgeRecords] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('serveo_category_badges_guest') || '[]');
      return Array.isArray(raw) ? raw.map(k => (typeof k === 'string' ? { badgeKey: k, equipped: true } : k)) : [];
    } catch {
      return [];
    }
  });

  const [termsAccepted, setTermsAccepted] = useState(() => {
    return localStorage.getItem('serveo_terms_version') === SERVEO_TERMS_VERSION;
  });

  const [cookieConsent, setCookieConsent] = useState(() => {
    try {
      const raw = localStorage.getItem('serveo_cookie_consent');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [cookieBannerOpen, setCookieBannerOpen] = useState(false);

  const toastTimerRef = useRef({});
  const knownNotifIdsRef = useRef(null);

  const alertRadiusKm = isPremium ? 25 : 5;

  const addToast = useCallback((message, duration = 4200) => {
    const id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    setToasts(prev => [...prev.slice(-3), { id, message }]);
    toastTimerRef.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete toastTimerRef.current[id];
    }, duration);
  }, []);

  const saveCookieConsent = useCallback((prefs) => {
    const next = {
      essential: true,
      functional: Boolean(prefs?.functional),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('serveo_cookie_consent', JSON.stringify(next));
    if (!next.functional) {
      localStorage.removeItem('serveo_location');
      localStorage.removeItem('serveo_saved_events');
    }
    setCookieConsent(next);
    setCookieBannerOpen(false);
    addToast(next.functional ? 'Cookie preferences saved (All enabled).' : 'Cookie preferences saved (Essential only).');
  }, [addToast]);

  const pushEmergencyAlert = useCallback((alertObj) => {
    const id = alertObj.alertId || 'em_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    playAlertSound();
    setEmergencyAlerts(prev => [{ ...alertObj, alertId: id }, ...prev].slice(0, 3));

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(alertObj.title || '🚨 SERVEO Emergency Alert', {
          body: alertObj.message || alertObj.description || 'Tap to view details and directions.',
          icon: '/images/icon-192.png',
          tag: `serveo-${id}`
        });
      } catch {
        // ignore
      }
    }
  }, []);

  const dismissEmergencyAlert = useCallback((alertId) => {
    setEmergencyAlerts(prev => prev.filter(a => a.alertId !== alertId));
  }, []);

  const activatePremium = useCallback(async (details) => {
    await apiFetch('/api/premium/activate', {
      method: 'POST',
      body: JSON.stringify({
        name: details.name,
        email: details.email,
        phone: details.phone,
        otpCode: details.otpCode,
        organizationName: details.organizationName || '',
        plan: details.plan || 'monthly',
        paymentReference: details.paymentReference || ''
      })
    });
    // Data minimization: remove any legacy client-side PII cache and store only active flag
    localStorage.removeItem('serveo_premium_customer');
    localStorage.setItem('serveo_premium_status', 'active');
    setIsPremium(true);
    addToast('SERVEO Premium activated & verified! 25 km–100 km alerts & verified perks unlocked.');
  }, [addToast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('serveo_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleSaved = useCallback((eventId) => {
    const strId = String(eventId);
    setSavedIds(prev => {
      const exists = prev.includes(strId);
      const next = exists ? prev.filter(id => id !== strId) : [...prev, strId];
      if (!cookieConsent || cookieConsent.functional) {
        localStorage.setItem('serveo_saved_events', JSON.stringify(next));
      }
      addToast(exists ? 'Removed from saved events' : 'Saved event to your list');
      return next;
    });
  }, [addToast, cookieConsent]);

  const refreshMe = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user || null);
      if (data.user) {
        apiFetch('/api/notifications').then(n => {
          const list = Array.isArray(n) ? n : (Array.isArray(n.notifications) ? n.notifications : []);
          setNotifications(list);
          knownNotifIdsRef.current = new Set(list.map(i => String(i.id)));
        }).catch(() => {});
        apiFetch('/api/badges/mine').then(b => {
          if (b && Array.isArray(b.badges)) {
            setBadgeRecords(b.badges);
            const userKey = String(data.user.id || data.user.username || 'guest');
            localStorage.setItem(`serveo_category_badges_${userKey}`, JSON.stringify(b.badges.map(x => x.badgeKey)));
          }
        }).catch(() => {});
      } else {
        setNotifications([]);
        try {
          const raw = JSON.parse(localStorage.getItem('serveo_category_badges_guest') || '[]');
          setBadgeRecords(Array.isArray(raw) ? raw.map(k => (typeof k === 'string' ? { badgeKey: k, equipped: true } : k)) : []);
        } catch {
          setBadgeRecords([]);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoaded(true);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const data = await apiFetch('/api/events?status=approved');
      const list = Array.isArray(data) ? data : (Array.isArray(data?.events) ? data.events : []);
      setEvents(list);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const checkTermsStatus = useCallback(async () => {
    try {
      const guestId = getGuestId();
      const data = await apiFetch(`/api/terms/status?guestId=${encodeURIComponent(guestId)}`);
      if (data && data.accepted) {
        localStorage.setItem('serveo_terms_version', SERVEO_TERMS_VERSION);
        setTermsAccepted(true);
      }
    } catch {
      // Fallback
    }
  }, []);

  const acceptTerms = useCallback(async () => {
    const guestId = getGuestId();
    try {
      await apiFetch('/api/terms/accept', {
        method: 'POST',
        body: JSON.stringify({ guestId, version: SERVEO_TERMS_VERSION })
      });
    } catch {
      // Proceed even if offline
    }
    localStorage.setItem('serveo_terms_version', SERVEO_TERMS_VERSION);
    setTermsAccepted(true);
    addToast('Terms accepted. Welcome to SERVEO!');
  }, [addToast]);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser.');
      return;
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = {
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          label: 'Near You'
        };
        setUserLocation(loc);
        if (!cookieConsent || cookieConsent.functional) {
          localStorage.setItem('serveo_location', JSON.stringify(loc));
        }
        addToast(`Location updated — showing nearby alerts within ${alertRadiusKm} km!`);
        if (user) {
          apiFetch('/api/auth/location', {
            method: 'PATCH',
            body: JSON.stringify({ lat: loc.lat, lng: loc.lng })
          }).catch(() => {});
        }
      },
      () => {
        addToast('Could not access GPS location. You can still browse all cities.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [addToast, alertRadiusKm, user]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setUser(null);
    setNotifications([]);
    addToast('Signed out successfully.');
  }, [addToast]);

  useEffect(() => {
    refreshMe();
    refreshEvents();
    checkTermsStatus();
    apiFetch('/api/disaster-mode').then(d => {
      setDisasterMode(d);
      if (d?.active) {
        pushEmergencyAlert({
          kind: 'disaster',
          title: `EMERGENCY: ${d.region || 'Disaster Mode Active'}`,
          message: d.reason || 'Emergency community response active.',
          organizer: 'SERVEO Emergency Network'
        });
      }
    }).catch(() => {});
  }, [refreshMe, refreshEvents, checkTermsStatus, pushEmergencyAlert]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(async () => {
      try {
        const n = await apiFetch('/api/notifications');
        const list = Array.isArray(n) ? n : (Array.isArray(n.notifications) ? n.notifications : []);
        setNotifications(list);
        if (!knownNotifIdsRef.current) {
          knownNotifIdsRef.current = new Set(list.map(i => String(i.id)));
          return;
        }
        for (const item of list) {
          const id = String(item.id);
          if (knownNotifIdsRef.current.has(id)) continue;
          knownNotifIdsRef.current.add(id);
          if (item.urgent_request_id || item.urgentRequestId) {
            pushEmergencyAlert({
              kind: 'blood',
              title: item.title || 'Urgent Blood Request Nearby',
              message: item.message,
              link: '/urgent-blood'
            });
          } else if (item.food_post_id || item.foodPostId) {
            pushEmergencyAlert({
              kind: 'food',
              title: item.title || 'Surplus Food Pickup Nearby',
              message: item.message,
              link: '/food-donation'
            });
          }
        }
      } catch {
        // ignore
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [user, pushEmergencyAlert]);

  useEffect(() => {
    const es = new EventSource('/api/events/stream');
    es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.type === 'CONNECTED') {
          setSseConnected(true);
        } else if (payload.type === 'EVENT_CREATED' && payload.event) {
          if (payload.event.status === 'approved') {
            setEvents(prev => [payload.event, ...prev.filter(e => String(e.id) !== String(payload.event.id))]);
            const dist = userLocation
              ? haversineKm(userLocation.lat, userLocation.lng, payload.event.lat, payload.event.lng)
              : null;
            if ((dist !== null && dist <= alertRadiusKm) || payload.event.urgency === 'critical') {
              pushEmergencyAlert({
                kind: 'event',
                event: payload.event,
                distanceKm: dist,
                title: payload.event.title,
                message: payload.event.description,
                organizer: payload.event.organizer,
                address: payload.event.address || payload.event.city,
                lat: payload.event.lat,
                lng: payload.event.lng,
                link: `/event/${payload.event.id}`
              });
            } else {
              addToast(`New event: ${payload.event.title}`);
            }
          }
        } else if (payload.type === 'VOLUNTEER_JOINED' && payload.event) {
          setEvents(prev =>
            prev.map(ev =>
              String(ev.id) === String(payload.event.id)
                ? { ...ev, volunteersJoined: payload.event.volunteersJoined }
                : ev
            )
          );
        } else if (payload.type === 'EVENT_UPDATED' || payload.type === 'EVENT_DELETED' || payload.type === 'ORGANIZER_BANNED') {
          refreshEvents();
        }
      } catch {
        // ignore
      }
    };
    es.onerror = () => setSseConnected(false);
    return () => es.close();
  }, [addToast, alertRadiusKm, pushEmergencyAlert, refreshEvents, userLocation]);

  const enrichedEvents = useMemo(() => {
    return events.map(ev => {
      const dist = userLocation
        ? haversineKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng)
        : ev.distanceKm ?? null;
      return {
        ...ev,
        distanceKm: dist !== null && dist !== undefined ? Number(dist.toFixed(1)) : null
      };
    });
  }, [events, userLocation]);

  const ownedBadges = useMemo(() => badgeRecords.map(b => b.badgeKey), [badgeRecords]);
  const equippedBadges = useMemo(() => badgeRecords.filter(b => b.equipped !== false).map(b => b.badgeKey), [badgeRecords]);

  const buyBadge = useCallback(async ({
    badgeKey,
    label,
    priceInr = 49,
    buyerName,
    buyerEmail,
    buyerPhone,
    organizationName,
    paymentMethod = 'upi',
    paymentReference,
    otpCode
  }) => {
    if (!user) {
      addToast('Please sign in first to purchase and verify an Organizer Badge.');
      return false;
    }
    if (ownedBadges.includes(badgeKey)) return false;
    const res = await apiFetch('/api/badges/purchase', {
      method: 'POST',
      body: JSON.stringify({
        badgeKey,
        priceInr,
        buyerName,
        buyerEmail,
        buyerPhone,
        organizationName,
        paymentMethod,
        paymentReference,
        otpCode
      })
    });
    if (res && Array.isArray(res.badges)) {
      setBadgeRecords(res.badges);
      const userKey = String(user.id || user.username || 'user');
      localStorage.setItem(`serveo_category_badges_${userKey}`, JSON.stringify(res.badges.map(x => x.badgeKey)));
      refreshEvents();
      addToast(`"${label}" Verified Badge unlocked & equipped! Priority listing & perks are active.`);
      return true;
    }
    return false;
  }, [user, ownedBadges, addToast, refreshEvents]);

  const toggleEquipBadge = useCallback(async (badgeKey) => {
    const existing = badgeRecords.find(b => b.badgeKey === badgeKey);
    if (!existing) return;
    const nextEquipped = !(existing.equipped !== false);
    if (user) {
      try {
        const res = await apiFetch(`/api/badges/${encodeURIComponent(badgeKey)}/equip`, {
          method: 'PATCH',
          body: JSON.stringify({ equipped: nextEquipped })
        });
        if (res && Array.isArray(res.badges)) {
          setBadgeRecords(res.badges);
          refreshEvents();
          addToast(nextEquipped ? 'Badge equipped on your event cards & profile!' : 'Badge hidden from showcase.');
          return;
        }
      } catch (err) {
        addToast(err.message || 'Could not update badge status');
        return;
      }
    }
    setBadgeRecords(prev => prev.map(b => (b.badgeKey === badgeKey ? { ...b, equipped: nextEquipped } : b)));
    addToast(nextEquipped ? 'Badge equipped on your cards & profile!' : 'Badge hidden from showcase.');
  }, [user, badgeRecords, addToast, refreshEvents]);

  const value = {
    user,
    authLoaded,
    setUser,
    refreshMe,
    logout,
    events: enrichedEvents,
    eventsLoading,
    refreshEvents,
    disasterMode,
    notifications,
    toasts,
    addToast,
    emergencyAlerts,
    pushEmergencyAlert,
    dismissEmergencyAlert,
    sseConnected,
    theme,
    toggleTheme,
    isPremium,
    activatePremium,
    alertRadiusKm,
    userLocation,
    detectLocation,
    savedIds,
    toggleSaved,
    ownedBadges,
    equippedBadges,
    badgeRecords,
    buyBadge,
    toggleEquipBadge,
    termsAccepted,
    acceptTerms,
    cookieConsent,
    cookieBannerOpen,
    setCookieBannerOpen,
    saveCookieConsent
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
