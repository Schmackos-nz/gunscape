import { Card, DeckType } from './types';

// Cost scales with a card's raw value, so a weak card is cheap and a strong
// one demands more energy - no more flat 1-cost-for-everything.
function costForValue(value: number): number {
  if (value <= 5) return 0;
  if (value <= 9) return 1;
  if (value <= 12) return 2;
  return 3;
}

const attackCards: Card[] = [
  { id: 'slash', name: 'Slash', type: 'attack', value: 8, cost: costForValue(8), description: 'Deal 8 damage' },
  { id: 'strike', name: 'Strike', type: 'attack', value: 6, cost: costForValue(6), description: 'Deal 6 damage' },
  { id: 'power-hit', name: 'Power Hit', type: 'attack', value: 12, cost: costForValue(12), description: 'Deal 12 damage' },
  { id: 'pierce', name: 'Pierce', type: 'attack', value: 10, cost: costForValue(10), description: 'Deal 10 damage' },
  { id: 'pummel', name: 'Pummel', type: 'attack', value: 7, cost: costForValue(7), description: 'Deal 7 damage. Draw 1 card' },
  { id: 'assault', name: 'Assault', type: 'attack', value: 5, cost: costForValue(5), description: 'Deal 5 damage twice' },
  { id: 'impale', name: 'Impale', type: 'attack', value: 15, cost: costForValue(15), description: 'Deal 15 damage' },
  { id: 'jab', name: 'Jab', type: 'attack', value: 4, cost: costForValue(4), description: 'Deal 4 damage' },
  { id: 'cleave', name: 'Cleave', type: 'attack', value: 11, cost: costForValue(11), description: 'Deal 11 damage' },
  { id: 'smash', name: 'Smash', type: 'attack', value: 9, cost: costForValue(9), description: 'Deal 9 damage' },
];

const defenseCards: Card[] = [
  { id: 'defend', name: 'Defend', type: 'defense', value: 5, cost: costForValue(5), description: 'Gain 5 defense' },
  { id: 'brace', name: 'Brace', type: 'defense', value: 8, cost: costForValue(8), description: 'Gain 8 defense' },
  { id: 'barrier', name: 'Barrier', type: 'defense', value: 12, cost: costForValue(12), description: 'Gain 12 defense' },
  { id: 'shield', name: 'Shield', type: 'defense', value: 7, cost: costForValue(7), description: 'Gain 7 defense' },
  { id: 'fortify', name: 'Fortify', type: 'defense', value: 10, cost: costForValue(10), description: 'Gain 10 defense. Block next hit' },
  { id: 'dodge', name: 'Dodge', type: 'defense', value: 3, cost: costForValue(3), description: 'Gain 3 defense. Draw 1 card' },
  { id: 'stance', name: 'Stance', type: 'defense', value: 6, cost: costForValue(6), description: 'Gain 6 defense' },
  { id: 'reinforce', name: 'Reinforce', type: 'defense', value: 14, cost: costForValue(14), description: 'Gain 14 defense' },
  { id: 'ready', name: 'Ready', type: 'defense', value: 4, cost: costForValue(4), description: 'Gain 4 defense' },
  { id: 'harden', name: 'Harden', type: 'defense', value: 9, cost: costForValue(9), description: 'Gain 9 defense' },
];

// Utility cards: every deck gets all 5 of these, regardless of deck type.
const utilityCards: Card[] = [
  { id: 'quick-draw', name: 'Quick Draw', type: 'utility', value: 2, cost: 1, effect: 'draw', description: 'Draw 2 cards' },
  { id: 'focus', name: 'Focus', type: 'utility', value: 1, cost: 0, effect: 'energy', description: 'Gain 1 energy. Costs 0 energy' },
  { id: 'insight', name: 'Insight', type: 'utility', value: 1, cost: 1, effect: 'drawEnergy', description: 'Draw 1 card. Gain 1 energy' },
  { id: 'adrenaline-rush', name: 'Adrenaline Rush', type: 'utility', value: 3, cost: 2, effect: 'draw', description: 'Draw 3 cards' },
  { id: 'second-wind', name: 'Second Wind', type: 'utility', value: 2, cost: 1, effect: 'energy', description: 'Gain 2 energy' },
];

const DECK_SIZE = 52;
const UTILITY_COUNT = utilityCards.length; // 5

// Unshuffled 52-card set for a deck type - shared by generateDeck and
// generateEmpoweredDeck so both build from the exact same composition rules.
function buildDeckCards(deckType: DeckType): Card[] {
  const deck: Card[] = [];
  const combatCardCount = DECK_SIZE - UTILITY_COUNT; // 47 attack+defense cards

  let attackCount: number;
  let defenseCount: number;

  if (deckType === 'offensive') {
    attackCount = Math.round(combatCardCount * 0.75);
    defenseCount = combatCardCount - attackCount;
  } else if (deckType === 'defensive') {
    defenseCount = Math.round(combatCardCount * 0.75);
    attackCount = combatCardCount - defenseCount;
  } else {
    attackCount = Math.floor(combatCardCount / 2);
    defenseCount = combatCardCount - attackCount;
  }

  for (let i = 0; i < attackCount; i++) {
    const card = { ...attackCards[i % attackCards.length] };
    card.id = `${card.id}-${i}`;
    deck.push(card);
  }

  for (let i = 0; i < defenseCount; i++) {
    const card = { ...defenseCards[i % defenseCards.length] };
    card.id = `${card.id}-${i}`;
    deck.push(card);
  }

  for (let i = 0; i < utilityCards.length; i++) {
    const card = { ...utilityCards[i] };
    card.id = `${card.id}-${i}`;
    deck.push(card);
  }

  return deck;
}

export function generateDeck(deckType: DeckType): Card[] {
  return shuffleDeck(buildDeckCards(deckType));
}

function empowerCard(card: Card): Card {
  return {
    ...card,
    id: `empowered-${card.id}`,
    name: `Empowered ${card.name}`,
    value: Math.round(card.value * 1.5),
    isEmpowered: true,
  };
}

function shuffleIndices(indices: number[]): number[] {
  const arr = [...indices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Builds a starter deck where up to `requestedCount` of its attack/defense
// cards (utility cards are excluded - "offensive/defensive stats" doesn't
// apply to them) are empowered: 50% stronger value, marked isEmpowered so
// the UI can star them. Returns the actual empowered count applied, which
// may be lower than requested if it exceeds the eligible card pool.
export function generateEmpoweredDeck(
  deckType: DeckType,
  requestedCount: number
): { cards: Card[]; empoweredCount: number } {
  const cards = buildDeckCards(deckType);
  const eligibleIndices = cards.reduce<number[]>((acc, c, i) => {
    if (c.type !== 'utility') acc.push(i);
    return acc;
  }, []);

  const empoweredCount = Math.min(requestedCount, eligibleIndices.length);
  const toEmpower = new Set(shuffleIndices(eligibleIndices).slice(0, empoweredCount));

  const finalCards = cards.map((card, i) => (toEmpower.has(i) ? empowerCard(card) : card));
  return { cards: shuffleDeck(finalCards), empoweredCount };
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawCards(deck: Card[], discard: Card[], count: number, hand: Card[]): { hand: Card[]; deck: Card[]; discard: Card[] } {
  let newDeck = [...deck];
  let newHand = [...hand];
  let newDiscard = [...discard];

  for (let i = 0; i < count; i++) {
    if (newDeck.length === 0) {
      if (newDiscard.length === 0) break;
      newDeck = shuffleDeck(newDiscard);
      newDiscard = [];
    }

    if (newDeck.length > 0) {
      newHand.push(newDeck.pop()!);
    }
  }

  return { hand: newHand, deck: newDeck, discard: newDiscard };
}
