import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, Settings2, Check, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function CookieConsentBanner() {
  const { termsAccepted, cookieConsent, cookieBannerOpen, setCookieBannerOpen, saveCookieConsent } = useApp();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [functionalEnabled, setFunctionalEnabled] = useState(
    cookieConsent ? Boolean(cookieConsent.functional) : true
  );

  useEffect(() => {
    if (cookieConsent) {
      setFunctionalEnabled(Boolean(cookieConsent.functional));
    }
  }, [cookieConsent]);

  useEffect(() => {
    if (!cookieBannerOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && cookieConsent) {
        setCookieBannerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cookieBannerOpen, cookieConsent, setCookieBannerOpen]);

  // Wait until blocking Terms modal is accepted so overlays never collide
  if (!termsAccepted) return null;
  if (cookieConsent && !cookieBannerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie and storage consent"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 88,
        zIndex: 135,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 680,
          padding: 18,
          borderRadius: 22,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-strong)',
          pointerEvents: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'var(--accent-gold-soft)',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Cookie size={18} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '0.98rem', fontWeight: 700 }}>
                Cookies &amp; Local Storage Preferences
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                SERVEO uses an essential login cookie (<code>serveo_token</code>) and optional local storage for nearby location
                filtering &amp; saved events. No advertising trackers.{' '}
                <Link to="/cookies" style={{ textDecoration: 'underline', fontWeight: 600 }}>
                  Cookie Policy
                </Link>
              </p>
            </div>
          </div>

          {cookieConsent && (
            <button
              type="button"
              onClick={() => setCookieBannerOpen(false)}
              aria-label="Close cookie preferences"
              style={{
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '50%',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {customizeOpen && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              background: 'var(--bg-surface-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontSize: '0.8rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <strong>Strictly Necessary</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Session auth cookie, theme, and consent state (always active).
                </div>
              </div>
              <span className="badge-pill" style={{ background: '#D1FAE5', color: '#065F46' }}>Always On</span>
            </div>

            <label
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer'
              }}
            >
              <div>
                <strong>Functional Preferences (Location &amp; Saved Events)</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Saves nearby GPS radius coordinates and bookmarked drives in browser storage.
                </div>
              </div>
              <input
                type="checkbox"
                checked={functionalEnabled}
                onChange={(e) => setFunctionalEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent-coral)' }}
              />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setCustomizeOpen((v) => !v)}
            aria-expanded={customizeOpen}
            className="pill-btn"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          >
            <Settings2 size={14} /> {customizeOpen ? 'Hide Options' : 'Customize'}
          </button>
          <button
            type="button"
            onClick={() => saveCookieConsent({ essential: true, functional: false })}
            className="pill-btn"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          >
            Essential Only
          </button>
          {customizeOpen ? (
            <button
              type="button"
              onClick={() => saveCookieConsent({ essential: true, functional: functionalEnabled })}
              className="pill-btn pill-btn-dark"
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              <Check size={14} /> Save Preferences
            </button>
          ) : (
            <button
              type="button"
              onClick={() => saveCookieConsent({ essential: true, functional: true })}
              className="pill-btn pill-btn-gold"
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              <Check size={14} /> Accept All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
