const PLAYER_TAUNTS = [
  "Let's duel!",
  "You're going down!",
  "I'm all fired up!",
  "This ends now!",
  "Bring it on!",
  "I won't lose this one!",
  "Time to show my strength!",
  "You picked the wrong fight!",
  "En garde!",
  "Get ready for a beating!",
];

const VICTORY_LINES = [
  "Too easy!",
  "Ha! Is that all you've got?",
  "Better luck next time!",
  "I'm just getting started!",
  "Victory tastes so sweet!",
  "You never stood a chance!",
  "Who's next?",
  "That's how it's done!",
];

const DEFEAT_LINES = [
  "No... this can't be happening...",
  "I... I lost...",
  "This isn't over!",
  "I'll get you next time...",
  "How could I lose...",
  "Not like this...",
];

const ENEMY_TAUNTS = [
  "You'll regret this!",
  "Prepare to fall!",
  "I've beaten stronger foes than you!",
  "This will be quick.",
  "You cannot win!",
  "Feel my wrath!",
  "Big mistake, adventurer.",
  "You're outmatched!",
];

const BOSS_TAUNTS = [
  "You dare challenge ME?",
  "Your journey ends here!",
  "None have survived my wrath!",
  "I've crushed thousands like you!",
  "Kneel before your doom!",
  "You are nothing before me!",
];

export function getRandomTaunt(): string {
  return PLAYER_TAUNTS[Math.floor(Math.random() * PLAYER_TAUNTS.length)];
}

export function getRandomVictoryLine(): string {
  return VICTORY_LINES[Math.floor(Math.random() * VICTORY_LINES.length)];
}

export function getRandomDefeatLine(): string {
  return DEFEAT_LINES[Math.floor(Math.random() * DEFEAT_LINES.length)];
}

export function getRandomEnemyTaunt(isBoss?: boolean): string {
  const pool = isBoss ? BOSS_TAUNTS : ENEMY_TAUNTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Enemy voices sit at a lower volume than the player's own - SpeechSynthesis
// has no real spatial/distance audio, so volume is the only lever available
// to make the enemy read as "across the arena" instead of right on top of
// the player at the same presence as their own voice.
const ENEMY_VOICES: Record<string, { pitch: number; rate: number; volume: number }> = {
  'Goblin Scout': { pitch: 1.6, rate: 1.25, volume: 0.55 },
  'Orc Raider': { pitch: 0.55, rate: 0.85, volume: 0.6 },
  Bandit: { pitch: 0.95, rate: 1.1, volume: 0.55 },
  'Dark Knight': { pitch: 0.5, rate: 0.75, volume: 0.6 },
  'Shadow Beast': { pitch: 0.35, rate: 0.7, volume: 0.55 },
};

export function getEnemyVoice(name: string, isBoss?: boolean): { pitch: number; rate: number; volume: number } {
  if (isBoss) return { pitch: 0.3, rate: 0.65, volume: 0.7 }; // a boss should still carry more presence
  return ENEMY_VOICES[name] ?? { pitch: 0.85, rate: 1, volume: 0.55 };
}

export function speak(text: string, options?: { rate?: number; pitch?: number; volume?: number }) {
  try {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate ?? 1.05;
    utterance.pitch = options?.pitch ?? 1.1;
    utterance.volume = options?.volume ?? 0.8;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    // speech synthesis unavailable - the on-screen speech bubble still shows
  }
}
