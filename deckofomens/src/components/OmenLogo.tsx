import React from 'react';

interface OmenLogoProps {
  compact?: boolean;
}

// Stylized "Deck of Omens" wordmark: an arcane omen-eye emblem set in a
// diamond (the card + divination motif) above a gold-to-violet serif wordmark.
export const OmenLogo: React.FC<OmenLogoProps> = ({ compact = false }) => (
  <div className={`omen-logo${compact ? ' omen-logo-compact' : ''}`}>
    <svg className="omen-emblem" viewBox="0 0 120 120" role="img" aria-label="Deck of Omens emblem">
      <defs>
        <linearGradient id="omenGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe6a8" />
          <stop offset="0.5" stopColor="#ffcf5c" />
          <stop offset="1" stopColor="#a98bff" />
        </linearGradient>
      </defs>
      {/* outer + inner diamond frame */}
      <path
        d="M60 6 L114 60 L60 114 L6 60 Z"
        fill="none"
        stroke="url(#omenGrad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M60 20 L100 60 L60 100 L20 60 Z"
        fill="none"
        stroke="url(#omenGrad)"
        strokeWidth="1"
        opacity="0.5"
        strokeLinejoin="round"
      />
      {/* cardinal ticks */}
      <path
        d="M60 6 L60 0 M114 60 L120 60 M60 114 L60 120 M6 60 L0 60"
        stroke="url(#omenGrad)"
        strokeWidth="2"
      />
      {/* the omen eye */}
      <path
        d="M32 60 Q60 40 88 60 Q60 80 32 60 Z"
        fill="rgba(18,16,40,0.65)"
        stroke="url(#omenGrad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="60" r="9" fill="url(#omenGrad)" />
      <circle cx="60" cy="60" r="4" fill="#14122a" />
      {/* radiating omen rays */}
      <path
        d="M60 40 L60 33 M44 46 L39 41 M76 46 L81 41 M44 74 L39 79 M76 74 L81 79 M60 80 L60 87"
        stroke="url(#omenGrad)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
    <div className="omen-wordmark">
      <span className="omen-word-top">Deck of</span>
      <span className="omen-word-main">OMENS</span>
    </div>
  </div>
);
