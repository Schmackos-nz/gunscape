import { GameState } from './types';

// Bump this whenever GameState/Player gains required fields - an old save
// missing them would otherwise load with undefined stats (NaN energy, etc).
// A version bump just makes loadGame() miss and start fresh instead.
const SAVE_KEY = 'deckOfOmens.save.v2';

export function saveGame(state: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage unavailable (private mode, quota, etc) - just skip saving
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // ignore
  }
}
