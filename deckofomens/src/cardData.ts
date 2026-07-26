import { Card, DeckType } from './types';

const attackCards: Card[] = [
  { id: 'slash', name: 'Slash', type: 'attack', value: 8, description: 'Deal 8 damage' },
  { id: 'strike', name: 'Strike', type: 'attack', value: 6, description: 'Deal 6 damage' },
  { id: 'power-hit', name: 'Power Hit', type: 'attack', value: 12, description: 'Deal 12 damage' },
  { id: 'pierce', name: 'Pierce', type: 'attack', value: 10, description: 'Deal 10 damage' },
  { id: 'pummel', name: 'Pummel', type: 'attack', value: 7, description: 'Deal 7 damage. Draw 1 card' },
  { id: 'assault', name: 'Assault', type: 'attack', value: 5, description: 'Deal 5 damage twice' },
  { id: 'impale', name: 'Impale', type: 'attack', value: 15, description: 'Deal 15 damage' },
  { id: 'jab', name: 'Jab', type: 'attack', value: 4, description: 'Deal 4 damage. Costs 0 energy' },
  { id: 'cleave', name: 'Cleave', type: 'attack', value: 11, description: 'Deal 11 damage' },
  { id: 'smash', name: 'Smash', type: 'attack', value: 9, description: 'Deal 9 damage' },
];

const defenseCards: Card[] = [
  { id: 'defend', name: 'Defend', type: 'defense', value: 5, description: 'Gain 5 defense' },
  { id: 'brace', name: 'Brace', type: 'defense', value: 8, description: 'Gain 8 defense' },
  { id: 'barrier', name: 'Barrier', type: 'defense', value: 12, description: 'Gain 12 defense' },
  { id: 'shield', name: 'Shield', type: 'defense', value: 7, description: 'Gain 7 defense' },
  { id: 'fortify', name: 'Fortify', type: 'defense', value: 10, description: 'Gain 10 defense. Block next hit' },
  { id: 'dodge', name: 'Dodge', type: 'defense', value: 3, description: 'Gain 3 defense. Draw 1 card' },
  { id: 'stance', name: 'Stance', type: 'defense', value: 6, description: 'Gain 6 defense' },
  { id: 'reinforce', name: 'Reinforce', type: 'defense', value: 14, description: 'Gain 14 defense' },
  { id: 'ready', name: 'Ready', type: 'defense', value: 4, description: 'Gain 4 defense. Costs 0 energy' },
  { id: 'harden', name: 'Harden', type: 'defense', value: 9, description: 'Gain 9 defense' },
];

export function generateDeck(deckType: DeckType): Card[] {
  const deck: Card[] = [];

  if (deckType === 'offensive') {
    const attackCount = Math.floor(52 * 0.75);
    const defenseCount = 52 - attackCount;

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
  } else if (deckType === 'defensive') {
    const defenseCount = Math.floor(52 * 0.75);
    const attackCount = 52 - defenseCount;

    for (let i = 0; i < defenseCount; i++) {
      const card = { ...defenseCards[i % defenseCards.length] };
      card.id = `${card.id}-${i}`;
      deck.push(card);
    }

    for (let i = 0; i < attackCount; i++) {
      const card = { ...attackCards[i % attackCards.length] };
      card.id = `${card.id}-${i}`;
      deck.push(card);
    }
  } else {
    const attackCount = 26;
    const defenseCount = 26;

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
  }

  return shuffleDeck(deck);
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
