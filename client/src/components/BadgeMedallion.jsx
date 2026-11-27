import React, { useId } from 'react';
import {
  Droplets,
  Stethoscope,
  Utensils,
  ShieldAlert,
  PawPrint,
  Sprout,
  BookOpen,
  Cpu,
  Mic,
  Sparkles,
  Zap,
  Award,
  Check
} from 'lucide-react';

const ICON_MAP = {
  blood: Droplets,
  'blood-lifesaver': Droplets,
  medical: Stethoscope,
  food: Utensils,
  'hunger-hero': Utensils,
  disaster: ShieldAlert,
  'disaster-shield': ShieldAlert,
  animal: PawPrint,
  environment: Sprout,
  'green-guardian': Sprout,
  education: BookOpen,
  tech: Cpu,
  seminar: Mic,
  'first-responder': Zap,
  'hours-champion-25': Award,
  other: Sparkles
};

/**
 * Collectible metallic rosette medallion with an enamel center crest
 * and optional verified corner seal.
 */
export default function BadgeMedallion({
  badgeKey = 'other',
  color = '#6366F1',
  pastelBg = '#E0E7FF',
  size = 64,
  locked = false,
  verified = true,
  animated = true
}) {
  const uid = useId().replace(/:/g, '');
  const rimId = `rim-${badgeKey}-${uid}`;
  const coreId = `core-${badgeKey}-${uid}`;
  const Icon = ICON_MAP[badgeKey] || Sparkles;
  const iconSize = Math.max(16, Math.round(size * 0.4));
  const tickSize = Math.max(16, Math.round(size * 0.3));

  return (
    <div
      className={`badge-crest ${animated && !locked ? 'badge-crest-animated' : ''}`}
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: locked ? 'grayscale(0.85) opacity(0.65)' : `drop-shadow(0 8px 16px ${color}38)`
      }}
    >
      {/* Rosette Scalloped Metallic Crest SVG */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <linearGradient id={rimId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="35%" stopColor={color} stopOpacity="0.9" />
            <stop offset="70%" stopColor="#111827" stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
          <radialGradient id={coreId} cx="32%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="48%" stopColor={pastelBg} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.32" />
          </radialGradient>
        </defs>

        {/* Outer metallic rosette star */}
        <path
          d="M50 3 L59 11 L71 8 L76 19 L88 21 L88 33 L97 42 L91 52 L96 63 L86 70 L86 82 L74 84 L68 94 L57 90 L50 98 L43 90 L32 94 L26 84 L14 82 L14 70 L4 63 L9 52 L3 42 L12 33 L12 21 L24 19 L29 8 L41 11 Z"
          fill={`url(#${rimId})`}
          stroke={color}
          strokeWidth="1.5"
        />

        {/* Inner glossy enamel medallion */}
        <circle cx="50" cy="50" r="35" fill={`url(#${coreId})`} stroke="#FFFFFF" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="30.5" fill="none" stroke={color} strokeOpacity="0.28" strokeWidth="1" strokeDasharray="3 2.5" />
      </svg>

      {/* Specular shine overlay */}
      {!locked && <span className="badge-crest-sheen" aria-hidden="true" />}

      {/* Center vector emblem */}
      <span
        style={{
          position: 'relative',
          zIndex: 2,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.75))'
        }}
      >
        <Icon size={iconSize} strokeWidth={2.3} />
      </span>

      {/* Corner verified tick seal */}
      {verified && !locked && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: tickSize,
            height: tickSize,
            borderRadius: '50%',
            background: '#10B981',
            color: '#FFFFFF',
            border: '2px solid var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.45)',
            zIndex: 3
          }}
        >
          <Check size={Math.max(10, Math.round(tickSize * 0.62))} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}
