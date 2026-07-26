import { DeckPickupData, DeckType } from './types';

// Shared by World3D (rendering/bounds) and Game (generating the per-level
// pickup list) so they can never drift apart.
export const WORLD_HALF = 155;
export const LEVEL_COMPLETE_Z = -145;

const DECK_TYPES: DeckType[] = ['offensive', 'defensive', 'balanced'];
const DECK_PICKUP_COUNT = 4;

// Generated once when a level starts (see Game.tsx) rather than by World3D
// on every mount - otherwise a declined pickup would show up somewhere new
// each time the player left and came back to the 3D world.
export function generateDeckPickups(level: number): DeckPickupData[] {
  const pickups: DeckPickupData[] = [];
  for (let i = 0; i < DECK_PICKUP_COUNT; i++) {
    pickups.push({
      id: `deck-pickup-${level}-${i}`,
      deckType: DECK_TYPES[Math.floor(Math.random() * DECK_TYPES.length)],
      empoweredCount: 1 + Math.floor(Math.random() * 52),
      x: (Math.random() * 2 - 1) * (WORLD_HALF - 10),
      z: (Math.random() * 2 - 1) * (WORLD_HALF - 10),
    });
  }
  return pickups;
}
