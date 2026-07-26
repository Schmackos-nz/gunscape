import { DeckPickupData, DeckType } from './types';

// Shared by World3D (rendering/bounds) and Game (generating the per-level
// pickup list) so they can never drift apart.
export const WORLD_HALF = 155;
export const LEVEL_COMPLETE_Z = -145;

const DECK_TYPES: DeckType[] = ['offensive', 'defensive', 'balanced'];
const DECK_PICKUP_COUNT = 4;
const MYTHICAL_PICKUP_COUNT = 1;

// Generated once when a level starts (see Game.tsx) rather than by World3D
// on every mount - otherwise a declined pickup would show up somewhere new
// each time the player left and came back to the 3D world. Mythical pickups
// share the same list/id-tracking (deckPickups/collectedDeckIds) as regular
// empowered decks, just flagged isMythical so World3D can render them
// distinctly and Game.tsx can route the offer to generateMythicalDeck.
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

  for (let i = 0; i < MYTHICAL_PICKUP_COUNT; i++) {
    pickups.push({
      id: `mythical-pickup-${level}-${i}`,
      deckType: 'balanced',
      empoweredCount: 0,
      isMythical: true,
      x: (Math.random() * 2 - 1) * (WORLD_HALF - 10),
      z: (Math.random() * 2 - 1) * (WORLD_HALF - 10),
    });
  }

  return pickups;
}
