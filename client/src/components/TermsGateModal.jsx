import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SERVEO_LEGAL_SECTIONS, SERVEO_TERMS_VERSION } from '../utils/legal';

export default function TermsGateModal() {
  const { acceptTerms } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setScrolledEnd(true);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 620,
          padding: 24,
          borderRadius: 28,
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'var(--accent-gold-soft)',
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Welcome to SERVEO
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Terms of Use · Version {SERVEO_TERMS_VERSION}
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '8px 0 14px' }}>
          SERVEO connects volunteers, donors, and verified community organizers across India. Please review and accept
          our Terms of Use before exploring or hosting events.
        </p>

        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="pill-btn"
            style={{ width: '100%', marginBottom: 12 }}
          >
            Read Terms of Use to Continue
          </button>
        ) : (
          <div
            onScroll={handleScroll}
            style={{
              maxHeight: 230,
              overflowY: 'auto',
              padding: 14,
              borderRadius: 14,
              background: 'var(--bg-surface-muted)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 14,
              fontSize: '0.82rem',
              lineHeight: 1.55
            }}
          >
            {SERVEO_LEGAL_SECTIONS.terms.map(([title, body]) => (
              <div key={title} style={{ marginBottom: 10 }}>
                <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{title}</strong>
                <span style={{ color: 'var(--text-secondary)' }}>{body}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={!expanded || !scrolledEnd}
            onClick={acceptTerms}
            className="pill-btn pill-btn-dark"
            style={{
              opacity: !expanded || !scrolledEnd ? 0.45 : 1,
              cursor: !expanded || !scrolledEnd ? 'not-allowed' : 'pointer',
              width: '100%'
            }}
          >
            {!expanded
              ? 'Expand Terms Above First'
              : !scrolledEnd
              ? 'Scroll to Bottom to Accept'
              : 'I Agree & Continue to SERVEO'}
          </button>
        </div>
      </div>
    </div>
  );
}
