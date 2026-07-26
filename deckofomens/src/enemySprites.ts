// Raw SVG markup mirroring Icons.tsx's EnemySprite exactly, so the 3D world
// shows the same portrait the player fights in combat. Kept separate from
// Icons.tsx because these need to be plain strings (data URIs for a
// THREE.Texture), not JSX.
const ENEMY_SVG_BODIES: Record<string, string> = {
  'Goblin Scout': `
    <circle cx="50" cy="30" r="20" fill="#6b9d1a" />
    <circle cx="42" cy="25" r="4" fill="#2a2a2a" />
    <circle cx="58" cy="25" r="4" fill="#2a2a2a" />
    <path d="M 42 35 Q 50 40 58 35" stroke="#2a2a2a" stroke-width="2" fill="none" />
    <rect x="40" y="50" width="20" height="30" fill="#5a8d0a" />
    <rect x="25" y="55" width="15" height="8" fill="#6b9d1a" />
    <rect x="60" y="55" width="15" height="8" fill="#6b9d1a" />
    <rect x="42" y="80" width="6" height="15" fill="#4a7d0a" />
    <rect x="52" y="80" width="6" height="15" fill="#4a7d0a" />
  `,
  'Orc Raider': `
    <circle cx="50" cy="28" r="22" fill="#8b6d47" />
    <circle cx="40" cy="22" r="5" fill="#ff6b6b" />
    <circle cx="60" cy="22" r="5" fill="#ff6b6b" />
    <circle cx="40" cy="22" r="2.5" fill="#2a2a2a" />
    <circle cx="60" cy="22" r="2.5" fill="#2a2a2a" />
    <path d="M 42 38 L 40 45" stroke="#d4a373" stroke-width="3" />
    <path d="M 58 38 L 60 45" stroke="#d4a373" stroke-width="3" />
    <rect x="38" y="50" width="24" height="32" fill="#7a5c37" />
    <rect x="40" y="52" width="20" height="18" fill="#a0826d" opacity="0.6" />
    <rect x="20" y="58" width="18" height="10" fill="#8b6d47" />
    <rect x="62" y="58" width="18" height="10" fill="#8b6d47" />
    <rect x="42" y="82" width="7" height="16" fill="#6a4c27" />
    <rect x="51" y="82" width="7" height="16" fill="#6a4c27" />
  `,
  Bandit: `
    <circle cx="50" cy="28" r="19" fill="#c9a876" />
    <rect x="32" y="20" width="36" height="10" fill="#2a2a2a" />
    <circle cx="42" cy="25" r="2.5" fill="#e0e0e0" />
    <circle cx="58" cy="25" r="2.5" fill="#e0e0e0" />
    <path d="M 31 18 L 69 18 L 65 12 L 35 12 Z" fill="#8b3a3a" />
    <rect x="38" y="47" width="24" height="30" fill="#5a4a3a" />
    <rect x="38" y="65" width="24" height="5" fill="#3a2a1a" />
    <rect x="22" y="52" width="16" height="9" fill="#4a3a2a" />
    <rect x="62" y="52" width="16" height="9" fill="#4a3a2a" />
    <rect x="76" y="48" width="3" height="14" fill="#c0c0c0" />
    <rect x="41" y="77" width="7" height="16" fill="#3a2a1a" />
    <rect x="52" y="77" width="7" height="16" fill="#3a2a1a" />
  `,
  'Dark Knight': `
    <path d="M 32 30 Q 32 8 50 8 Q 68 8 68 30 L 64 38 L 36 38 Z" fill="#2a2a3a" />
    <rect x="38" y="20" width="24" height="4" fill="#ff3333" opacity="0.9" />
    <rect x="34" y="40" width="32" height="34" fill="#3a3a4a" />
    <rect x="40" y="43" width="20" height="20" fill="#5a5a6a" opacity="0.7" />
    <path d="M 30 42 L 24 32 L 34 40 Z" fill="#1a1a2a" />
    <path d="M 70 42 L 76 32 L 66 40 Z" fill="#1a1a2a" />
    <rect x="18" y="46" width="16" height="10" fill="#2a2a3a" />
    <rect x="66" y="46" width="16" height="10" fill="#2a2a3a" />
    <rect x="80" y="30" width="4" height="34" fill="#c0c0c0" />
    <rect x="76" y="28" width="12" height="4" fill="#8b6d47" />
    <rect x="38" y="74" width="9" height="18" fill="#1a1a2a" />
    <rect x="53" y="74" width="9" height="18" fill="#1a1a2a" />
  `,
  'Shadow Beast': `
    <ellipse cx="50" cy="55" rx="28" ry="30" fill="#3a1a4a" opacity="0.85" />
    <ellipse cx="50" cy="55" rx="20" ry="22" fill="#1a0a2a" opacity="0.9" />
    <circle cx="40" cy="45" r="4" fill="#bb44ff" />
    <circle cx="60" cy="45" r="4" fill="#bb44ff" />
    <circle cx="40" cy="45" r="1.5" fill="#ffffff" />
    <circle cx="60" cy="45" r="1.5" fill="#ffffff" />
    <path d="M 25 60 Q 10 65 8 78" stroke="#3a1a4a" stroke-width="5" fill="none" opacity="0.7" />
    <path d="M 75 60 Q 90 65 92 78" stroke="#3a1a4a" stroke-width="5" fill="none" opacity="0.7" />
    <path d="M 40 80 Q 35 92 30 95" stroke="#3a1a4a" stroke-width="5" fill="none" opacity="0.6" />
    <path d="M 60 80 Q 65 92 70 95" stroke="#3a1a4a" stroke-width="5" fill="none" opacity="0.6" />
    <path d="M 32 70 L 26 78" stroke="#bb44ff" stroke-width="2" />
    <path d="M 68 70 L 74 78" stroke="#bb44ff" stroke-width="2" />
  `,
};

const FALLBACK_BODY = `
  <circle cx="50" cy="50" r="30" fill="#ff4444" />
`;

// Boss names are flavorful ("The Ashen Dark Knight") rather than exact
// archetype names, so resolution has to be substring-based - this MUST stay
// in sync with Icons.tsx's EnemySprite, which uses the same substrings, so
// combat portraits and the world sprite never disagree on what an enemy
// looks like.
const ARCHETYPES = ['Goblin', 'Orc', 'Bandit', 'Dark Knight', 'Shadow Beast'] as const;

function resolveArchetype(name: string): string | null {
  return ARCHETYPES.find((key) => name.includes(key)) ?? null;
}

const HEIGHTS: Record<string, number> = {
  Goblin: 3.2,
  Orc: 4.4,
  Bandit: 3.8,
  'Dark Knight': 5,
  'Shadow Beast': 4.6,
};

function bodyFor(archetype: string | null): string {
  if (!archetype) return FALLBACK_BODY;
  if (archetype === 'Goblin') return ENEMY_SVG_BODIES['Goblin Scout'];
  if (archetype === 'Orc') return ENEMY_SVG_BODIES['Orc Raider'];
  return ENEMY_SVG_BODIES[archetype] ?? FALLBACK_BODY;
}

export function getEnemySpriteUrl(name: string): string {
  const body = bodyFor(resolveArchetype(name));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 100 100">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getEnemySpriteHeight(name: string): number {
  const archetype = resolveArchetype(name);
  if (!archetype) return 4;
  return HEIGHTS[archetype] ?? 4;
}
