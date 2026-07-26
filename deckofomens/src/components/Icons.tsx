import React from 'react';

export const SwordIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="0.75"
    strokeLinejoin="round"
  >
    {/* blade with a central fuller line */}
    <path d="M12 1.5l1.6 4.2v9.3h-3.2V5.7L12 1.5z" />
    <path d="M12 3.5v10.5" stroke="rgba(0,0,0,0.28)" strokeWidth="0.9" fill="none" />
    {/* crossguard */}
    <rect x="6.5" y="15" width="11" height="2.2" rx="1.1" />
    {/* grip */}
    <rect x="10.9" y="17.2" width="2.2" height="4" />
    {/* pommel */}
    <circle cx="12" cy="22" r="1.7" />
  </svg>
);

export const ShieldIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L3 7v6c0 7 9 11 9 11s9-4 9-11V7l-9-5z" />
  </svg>
);

export const HeartIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const BoltIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

export const SparkleIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />
    <path d="M19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" opacity="0.7" />
  </svg>
);

export const ArmorIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1l8 4v6c0 6-8 9-8 9s-8-3-8-9V5l8-4z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EnemySprite: React.FC<{ name: string; size?: number }> = ({ name, size = 120 }) => {
  if (name.includes('Goblin')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Head */}
        <circle cx="50" cy="30" r="20" fill="#6b9d1a" />
        {/* Eyes */}
        <circle cx="42" cy="25" r="4" fill="#2a2a2a" />
        <circle cx="58" cy="25" r="4" fill="#2a2a2a" />
        {/* Mouth */}
        <path d="M 42 35 Q 50 40 58 35" stroke="#2a2a2a" strokeWidth="2" fill="none" />
        {/* Body */}
        <rect x="40" y="50" width="20" height="30" fill="#5a8d0a" />
        {/* Arms */}
        <rect x="25" y="55" width="15" height="8" fill="#6b9d1a" />
        <rect x="60" y="55" width="15" height="8" fill="#6b9d1a" />
        {/* Legs */}
        <rect x="42" y="80" width="6" height="15" fill="#4a7d0a" />
        <rect x="52" y="80" width="6" height="15" fill="#4a7d0a" />
      </svg>
    );
  }

  if (name.includes('Orc')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Head */}
        <circle cx="50" cy="28" r="22" fill="#8b6d47" />
        {/* Eyes */}
        <circle cx="40" cy="22" r="5" fill="#ff6b6b" />
        <circle cx="60" cy="22" r="5" fill="#ff6b6b" />
        <circle cx="40" cy="22" r="2.5" fill="#2a2a2a" />
        <circle cx="60" cy="22" r="2.5" fill="#2a2a2a" />
        {/* Tusks */}
        <path d="M 42 38 L 40 45" stroke="#d4a373" strokeWidth="3" />
        <path d="M 58 38 L 60 45" stroke="#d4a373" strokeWidth="3" />
        {/* Body */}
        <rect x="38" y="50" width="24" height="32" fill="#7a5c37" />
        {/* Chest plate */}
        <rect x="40" y="52" width="20" height="18" fill="#a0826d" opacity="0.6" />
        {/* Arms */}
        <rect x="20" y="58" width="18" height="10" fill="#8b6d47" />
        <rect x="62" y="58" width="18" height="10" fill="#8b6d47" />
        {/* Legs */}
        <rect x="42" y="82" width="7" height="16" fill="#6a4c27" />
        <rect x="51" y="82" width="7" height="16" fill="#6a4c27" />
      </svg>
    );
  }

  if (name.includes('Dragon')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Head */}
        <ellipse cx="35" cy="30" rx="18" ry="22" fill="#d4a540" />
        {/* Eyes */}
        <circle cx="28" cy="22" r="4" fill="#2a2a2a" />
        <circle cx="42" cy="22" r="4" fill="#2a2a2a" />
        <circle cx="28" cy="22" r="2" fill="#ff6b6b" />
        <circle cx="42" cy="22" r="2" fill="#ff6b6b" />
        {/* Snout */}
        <path d="M 35 38 L 32 45 L 35 48 L 38 45 Z" fill="#c49435" />
        {/* Horns */}
        <path d="M 28 12 L 24 2" stroke="#a0826d" strokeWidth="3" />
        <path d="M 42 12 L 46 2" stroke="#a0826d" strokeWidth="3" />
        {/* Body */}
        <ellipse cx="50" cy="55" rx="20" ry="22" fill="#cc9535" />
        {/* Wing */}
        <path d="M 65 45 L 75 35 L 78 50 Q 75 60 65 65" fill="#b88428" opacity="0.8" />
        {/* Tail */}
        <path d="M 65 60 Q 75 70 78 85" stroke="#b88428" strokeWidth="8" fill="none" />
        {/* Claws */}
        <circle cx="45" cy="75" r="3" fill="#a0826d" />
        <circle cx="55" cy="75" r="3" fill="#a0826d" />
      </svg>
    );
  }

  if (name.includes('Bandit')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Head */}
        <circle cx="50" cy="28" r="19" fill="#c9a876" />
        {/* Mask */}
        <rect x="32" y="20" width="36" height="10" fill="#2a2a2a" />
        <circle cx="42" cy="25" r="2.5" fill="#e0e0e0" />
        <circle cx="58" cy="25" r="2.5" fill="#e0e0e0" />
        {/* Bandana */}
        <path d="M 31 18 L 69 18 L 65 12 L 35 12 Z" fill="#8b3a3a" />
        {/* Body */}
        <rect x="38" y="47" width="24" height="30" fill="#5a4a3a" />
        {/* Belt */}
        <rect x="38" y="65" width="24" height="5" fill="#3a2a1a" />
        {/* Arms */}
        <rect x="22" y="52" width="16" height="9" fill="#4a3a2a" />
        <rect x="62" y="52" width="16" height="9" fill="#4a3a2a" />
        {/* Dagger */}
        <rect x="76" y="48" width="3" height="14" fill="#c0c0c0" />
        {/* Legs */}
        <rect x="41" y="77" width="7" height="16" fill="#3a2a1a" />
        <rect x="52" y="77" width="7" height="16" fill="#3a2a1a" />
      </svg>
    );
  }

  if (name.includes('Dark Knight')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Helmet */}
        <path d="M 32 30 Q 32 8 50 8 Q 68 8 68 30 L 64 38 L 36 38 Z" fill="#2a2a3a" />
        {/* Visor slit */}
        <rect x="38" y="20" width="24" height="4" fill="#ff3333" opacity="0.9" />
        {/* Body armor */}
        <rect x="34" y="40" width="32" height="34" fill="#3a3a4a" />
        <rect x="40" y="43" width="20" height="20" fill="#5a5a6a" opacity="0.7" />
        {/* Spikes on shoulders */}
        <path d="M 30 42 L 24 32 L 34 40 Z" fill="#1a1a2a" />
        <path d="M 70 42 L 76 32 L 66 40 Z" fill="#1a1a2a" />
        {/* Arms */}
        <rect x="18" y="46" width="16" height="10" fill="#2a2a3a" />
        <rect x="66" y="46" width="16" height="10" fill="#2a2a3a" />
        {/* Sword */}
        <rect x="80" y="30" width="4" height="34" fill="#c0c0c0" />
        <rect x="76" y="28" width="12" height="4" fill="#8b6d47" />
        {/* Legs */}
        <rect x="38" y="74" width="9" height="18" fill="#1a1a2a" />
        <rect x="53" y="74" width="9" height="18" fill="#1a1a2a" />
      </svg>
    );
  }

  if (name.includes('Shadow Beast')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Wispy shadow body */}
        <ellipse cx="50" cy="55" rx="28" ry="30" fill="#3a1a4a" opacity="0.85" />
        <ellipse cx="50" cy="55" rx="20" ry="22" fill="#1a0a2a" opacity="0.9" />
        {/* Glowing eyes */}
        <circle cx="40" cy="45" r="4" fill="#bb44ff" />
        <circle cx="60" cy="45" r="4" fill="#bb44ff" />
        <circle cx="40" cy="45" r="1.5" fill="#ffffff" />
        <circle cx="60" cy="45" r="1.5" fill="#ffffff" />
        {/* Wisps trailing off */}
        <path d="M 25 60 Q 10 65 8 78" stroke="#3a1a4a" strokeWidth="5" fill="none" opacity="0.7" />
        <path d="M 75 60 Q 90 65 92 78" stroke="#3a1a4a" strokeWidth="5" fill="none" opacity="0.7" />
        <path d="M 40 80 Q 35 92 30 95" stroke="#3a1a4a" strokeWidth="5" fill="none" opacity="0.6" />
        <path d="M 60 80 Q 65 92 70 95" stroke="#3a1a4a" strokeWidth="5" fill="none" opacity="0.6" />
        {/* Claws */}
        <path d="M 32 70 L 26 78" stroke="#bb44ff" strokeWidth="2" />
        <path d="M 68 70 L 74 78" stroke="#bb44ff" strokeWidth="2" />
      </svg>
    );
  }

  return null;
};

export const PlayerSprite: React.FC<{ size?: number }> = ({ size = 100 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    {/* Head */}
    <circle cx="50" cy="25" r="18" fill="#d4a574" />
    {/* Eyes */}
    <circle cx="42" cy="20" r="3" fill="#2a2a2a" />
    <circle cx="58" cy="20" r="3" fill="#2a2a2a" />
    {/* Mouth */}
    <path d="M 45 30 Q 50 32 55 30" stroke="#2a2a2a" strokeWidth="1.5" fill="none" />
    {/* Body */}
    <rect x="40" y="43" width="20" height="28" fill="#2d5a8c" />
    {/* Chest armor */}
    <rect x="42" y="45" width="16" height="15" fill="#6ba3ff" opacity="0.6" />
    {/* Arms */}
    <rect x="25" y="50" width="15" height="10" fill="#d4a574" />
    <rect x="60" y="50" width="15" height="10" fill="#d4a574" />
    {/* Sword */}
    <rect x="72" y="48" width="4" height="20" fill="#c0c0c0" />
    <path d="M 72 48 L 68 44 L 76 44 Z" fill="#d4a574" />
    {/* Legs */}
    <rect x="42" y="71" width="6" height="18" fill="#1a3a5c" />
    <rect x="52" y="71" width="6" height="18" fill="#1a3a5c" />
    {/* Boots */}
    <rect x="41" y="89" width="8" height="8" fill="#3a3a3a" />
    <rect x="51" y="89" width="8" height="8" fill="#3a3a3a" />
  </svg>
);
