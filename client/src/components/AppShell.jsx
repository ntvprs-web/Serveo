import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  MapPin,
  CalendarDays,
  PlusCircle,
  Droplets,
  Utensils,
  Clock,
  ShieldCheck,
  BarChart3,
  Moon,
  Sun,
  LogOut,
  LogIn,
  Bell,
  Menu,
  X,
  Home,
  Info,
  Award,
  Sparkles,
  AlertTriangle,
  Crown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getGreeting } from '../utils/api';
import TermsGateModal from './TermsGateModal';
import EmergencyAlertPopup from './EmergencyAlertPopup';

const NAV_ITEMS = [
  { to: '/', label: 'Explore', icon: Compass },
  { to: '/map', label: 'Nearby Map', icon: MapPin },
  { to: '/events', label: 'All Events', icon: CalendarDays },
  { to: '/post-event', label: 'Host Event', icon: PlusCircle, highlight: true },
  { to: '/blood-donation', label: 'Blood Center', icon: Droplets },
  { to: '/urgent-blood', label: 'Urgent Blood', icon: AlertTriangle },
  { to: '/food-donation', label: 'Food Rescue', icon: Utensils },
  { to: '/my-hours', label: 'My Hours', icon: Clock },
  { to: '/badges', label: 'Badges Shop', icon: Award },
  { to: '/premium', label: 'Premium 25km+', icon: Crown },
  { to: '/organizer', label: 'Organizer Portal', icon: ShieldCheck },
  { to: '/impact', label: 'Social Impact', icon: BarChart3 },
  { to: '/about', label: 'About & Services', icon: Info }
];

export default function AppShell({ children }) {
  const {
    user,
    logout,
    theme,
    toggleTheme,
    isPremium,
    alertRadiusKm,
    userLocation,
    detectLocation,
    notifications,
    pushEmergencyAlert,
    events,
    disasterMode,
    toasts,
    termsAccepted
  } = useApp();

  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const displayName = user?.name || 'Guest Volunteer';
  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const triggerTestEmergency = () => {
    const sample = events.find(e => e.urgency === 'critical' || e.urgency === 'live') || events[0];
    pushEmergencyAlert({
      kind: 'event',
      title: sample ? sample.title : 'Emergency Blood & Relief Drive',
      message: sample ? sample.description : 'Critical community volunteers needed nearby.',
      organizer: sample ? sample.organizer : 'Indian Red Cross Society',
      address: sample ? sample.address : 'New Delhi',
      distanceKm: sample?.distanceKm ?? 1.4,
      lat: sample?.lat ?? 28.627,
      lng: sample?.lng ?? 77.214,
      link: sample ? `/event/${sample.id}` : '/urgent-blood'
    });
    setNotifOpen(false);
  };

  return (
    <div
      className="app-shell"
      style={{ '--active-sidebar-width': sidebarExpanded ? '256px' : '76px' }}
    >
      {/* Desktop Collapsible Icon-Rail / Hamburger Sidebar */}
      <aside
        className="desktop-sidebar"
        style={{
          width: sidebarExpanded ? 256 : 76,
          padding: sidebarExpanded ? '18px 14px' : '18px 10px',
          transition: 'width 0.22s ease, padding 0.22s ease',
          alignItems: sidebarExpanded ? 'stretch' : 'center'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarExpanded ? 'space-between' : 'center',
            gap: 10,
            marginBottom: 14,
            padding: sidebarExpanded ? '0 4px' : 0
          }}
        >
          {sidebarExpanded && (
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <img
                src="/images/serveo-logo.jpg"
                alt="SERVEO Logo"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  objectFit: 'cover',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.16)'
                }}
              />
              <span style={{ fontWeight: 800, fontSize: '1.02rem', letterSpacing: '-0.02em' }}>SERVEO</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSidebarExpanded((v) => !v)}
            aria-label={sidebarExpanded ? 'Collapse menu' : 'Expand menu'}
            title={sidebarExpanded ? 'Collapse menu' : 'Expand menu'}
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-muted)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Menu size={19} />
          </button>
        </div>

        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            flex: 1,
            width: '100%',
            alignItems: sidebarExpanded ? 'stretch' : 'center'
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                  gap: 11,
                  width: sidebarExpanded ? '100%' : 44,
                  height: 44,
                  padding: sidebarExpanded ? '0 13px' : 0,
                  borderRadius: sidebarExpanded ? 14 : '50%',
                  fontSize: '0.86rem',
                  fontWeight: active ? 700 : 500,
                  background: active
                    ? 'var(--accent-charcoal)'
                    : item.highlight
                    ? 'var(--accent-coral-soft)'
                    : 'transparent',
                  color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.85} />
                {sidebarExpanded && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
            width: '100%',
            alignItems: sidebarExpanded ? 'stretch' : 'center'
          }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Night Mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'space-between' : 'center',
              width: sidebarExpanded ? '100%' : 44,
              height: 42,
              padding: sidebarExpanded ? '0 12px' : 0,
              borderRadius: sidebarExpanded ? 14 : '50%',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-muted)',
              color: 'var(--text-primary)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              {sidebarExpanded && <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Night Mode</span>}
            </span>
          </button>

          {user ? (
            <button
              type="button"
              onClick={logout}
              title={`Sign Out (${displayName})`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                gap: 8,
                width: sidebarExpanded ? '100%' : 44,
                height: 42,
                padding: sidebarExpanded ? '0 12px' : 0,
                borderRadius: sidebarExpanded ? 14 : '50%',
                border: 'none',
                background: 'var(--accent-gold)',
                color: '#111827',
                fontWeight: 700,
                fontSize: '0.84rem'
              }}
            >
              <LogOut size={17} />
              {sidebarExpanded && <span>Sign Out</span>}
            </button>
          ) : (
            <Link
              to="/login"
              title="Sign In / Register"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                gap: 8,
                width: sidebarExpanded ? '100%' : 44,
                height: 42,
                padding: sidebarExpanded ? '0 12px' : 0,
                borderRadius: sidebarExpanded ? 14 : '50%',
                background: 'var(--accent-charcoal)',
                color: 'var(--text-inverse)',
                fontWeight: 700,
                fontSize: '0.84rem'
              }}
            >
              <LogIn size={17} />
              {sidebarExpanded && <span>Sign In</span>}
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile & Tablet Hamburger Drawer */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 80,
            display: 'flex'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 286,
              maxWidth: '85vw',
              height: '100%',
              background: 'var(--bg-surface)',
              padding: '18px 14px',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent-gold)', color: '#111827', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{displayName}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {isPremium ? 'Premium (25km+)' : 'Standard (5km)'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close menu"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--accent-blush)',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={17} />
              </button>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileDrawerOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      borderRadius: 13,
                      fontSize: '0.86rem',
                      fontWeight: active ? 700 : 500,
                      background: active ? 'var(--accent-gold)' : 'transparent',
                      color: active ? '#111827' : 'var(--text-primary)'
                    }}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" onClick={toggleTheme} className="pill-btn" style={{ width: '100%', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  <span>Night Mode</span>
                </span>
                <span>{theme === 'dark' ? 'ON' : 'OFF'}</span>
              </button>
              {user ? (
                <button type="button" onClick={() => { logout(); setMobileDrawerOpen(false); }} className="pill-btn pill-btn-dark" style={{ width: '100%' }}>
                  <LogOut size={15} /> Sign Out
                </button>
              ) : (
                <Link to="/login" onClick={() => setMobileDrawerOpen(false)} className="pill-btn pill-btn-dark" style={{ width: '100%' }}>
                  <LogIn size={15} /> Sign In / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="app-main">
        {disasterMode?.active && (
          <div
            style={{
              background: 'linear-gradient(90deg, #DC2626, #EA580C)',
              color: '#FFFFFF',
              padding: '10px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              textAlign: 'center'
            }}
          >
            <AlertTriangle size={18} />
            <span>
              EMERGENCY DISASTER MODE ({disasterMode.region || 'Active'}): {disasterMode.reason}
            </span>
          </div>
        )}

        <header className="app-header">
          <div className="app-container app-header-inner">
            <div className="app-header-left">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open navigation menu"
                className="mobile-menu-trigger"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Menu size={18} />
              </button>

              <Link to="/" aria-label="SERVEO Home" style={{ flexShrink: 0 }}>
                <img
                  src="/images/serveo-logo.jpg"
                  alt="SERVEO"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    objectFit: 'cover',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                />
              </Link>

              <div className="app-header-brand">
                <div className="app-header-greeting">
                  {getGreeting()} · Alert Range: 0–{alertRadiusKm} km {isPremium ? '✨' : ''}
                </div>
                <div className="app-header-title">
                  {user ? (
                    <>
                      {user.name.split(' ')[0]}{' '}
                      <span className="serif-italic" style={{ fontSize: '1.15em', fontWeight: 400 }}>
                        {user.name.split(' ').slice(1).join(' ') || 'Welcome'}
                      </span>
                    </>
                  ) : (
                    <>
                      SERVEO{' '}
                      <span className="serif-italic" style={{ fontSize: '1.15em', fontWeight: 400 }}>
                        Community
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="app-header-actions">
              <button
                type="button"
                onClick={detectLocation}
                className="pill-btn header-location-btn"
              >
                <MapPin size={14} color="#F97352" style={{ flexShrink: 0 }} />
                <span className="header-location-label">{userLocation ? userLocation.label : 'Detect City'}</span>
              </button>

              {!isPremium && (
                <Link to="/premium" className="pill-btn pill-btn-gold header-premium-btn">
                  <Crown size={14} /> 25 km+
                </Link>
              )}

              <button
                type="button"
                onClick={() => setNotifOpen(v => !v)}
                aria-label="Emergency & Proximity Notifications"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  flexShrink: 0
                }}
              >
                <Bell size={17} />
                <span
                  style={{
                    position: 'absolute',
                    top: 7,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--accent-coral)'
                  }}
                />
              </button>

              {notifOpen && (
                <div
                  className="card"
                  style={{
                    position: 'absolute',
                    top: 46,
                    right: 0,
                    width: 320,
                    maxWidth: 'calc(100vw - 28px)',
                    padding: 14,
                    zIndex: 60
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <strong style={{ fontSize: '0.9rem' }}>Emergency & Nearby Alerts</strong>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem' }}
                    >
                      Close
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={triggerTestEmergency}
                    className="pill-btn pill-btn-coral"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.8rem', marginBottom: 10 }}
                  >
                    <Sparkles size={14} /> Preview Emergency Alert Popup
                  </button>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      Active range: 0–{alertRadiusKm} km. Live SSE & urgent blood/food alerts appear automatically.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                      {notifications.slice(0, 8).map((n, idx) => (
                        <div key={n.id || idx} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-surface-muted)', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 600 }}>{n.title || 'SERVEO Alert'}</div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="app-container" style={{ flex: 1 }}>
          {children}
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button type="button" onClick={() => navigate('/')} className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}>
          <Home size={20} />
          <span>Home</span>
        </button>
        <button type="button" onClick={() => navigate('/map')} className={`mobile-nav-item ${isActive('/map') ? 'active' : ''}`}>
          <MapPin size={20} />
          <span>Map</span>
        </button>
        <button type="button" onClick={() => navigate('/post-event')} className="mobile-nav-center-fab" aria-label="Host an Event">
          <PlusCircle size={24} />
        </button>
        <button type="button" onClick={() => navigate('/events')} className={`mobile-nav-item ${isActive('/events') ? 'active' : ''}`}>
          <CalendarDays size={20} />
          <span>Events</span>
        </button>
        <button type="button" onClick={() => setMobileDrawerOpen(true)} className="mobile-nav-item">
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>

      <EmergencyAlertPopup />

      <div className="toast-stack" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="toast-item">{t.message}</div>
        ))}
      </div>

      {!termsAccepted && <TermsGateModal />}

      <style>{`
        @media (min-width: 1024px) {
          .mobile-menu-trigger {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
