import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Navigation, X, HeartHandshake } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getDirectionsUrl } from '../utils/api';

export default function EmergencyAlertPopup() {
  const { emergencyAlerts, dismissEmergencyAlert, alertRadiusKm } = useApp();

  if (!emergencyAlerts || emergencyAlerts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 92,
        zIndex: 110,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: 360,
        maxWidth: 'calc(100vw - 32px)'
      }}
      aria-live="assertive"
    >
      {emergencyAlerts.map((alert) => (
        <div
          key={alert.alertId}
          role="alert"
          className="card"
          style={{
            padding: 16,
            borderRadius: 20,
            borderLeft: '5px solid #EF4444',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideInToast 0.25s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.76rem', fontWeight: 800, color: '#EF4444' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#EF4444',
                  display: 'inline-block'
                }}
              />
              <AlertTriangle size={14} />
              <span>
                {alert.kind === 'blood'
                  ? 'URGENT BLOOD ALERT'
                  : alert.kind === 'food'
                  ? 'FOOD RESCUE ALERT'
                  : alert.kind === 'disaster'
                  ? 'DISASTER ALERT'
                  : `WELFARE ALERT (0–${alertRadiusKm} KM)`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => dismissEmergencyAlert(alert.alertId)}
              aria-label="Dismiss alert"
              style={{
                border: 'none',
                background: 'var(--bg-surface-muted)',
                color: 'var(--text-primary)',
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={14} />
            </button>
          </div>

          <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem', fontWeight: 700 }}>{alert.title}</h4>
          {alert.organizer && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              By <strong>{alert.organizer}</strong>
              {typeof alert.distanceKm === 'number' ? ` · ${alert.distanceKm.toFixed(1)} km away` : ''}
            </div>
          )}
          {alert.message && (
            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {alert.message.slice(0, 120)}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {alert.lat && alert.lng && (
              <a
                href={getDirectionsUrl(alert.lat, alert.lng, alert.address)}
                target="_blank"
                rel="noreferrer"
                className="pill-btn pill-btn-dark"
                style={{ flex: 1, padding: '8px 10px', fontSize: '0.78rem' }}
              >
                <Navigation size={13} /> Directions
              </a>
            )}
            <Link
              to={alert.link || '/events'}
              onClick={() => dismissEmergencyAlert(alert.alertId)}
              className="pill-btn pill-btn-gold"
              style={{ flex: 1, padding: '8px 10px', fontSize: '0.78rem' }}
            >
              <HeartHandshake size={13} /> Help Now
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
