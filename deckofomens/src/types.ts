export type DeckType = 'offensive' | 'defensive' | 'balanced';

export type CardType = 'attack' | 'defense' | 'utility';

export type UtilityEffect = 'draw' | 'energy' | 'drawEnergy';

export type ItemType = 'weapon' | 'armor' | 'accessory';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  value: number;
  cost: number;
  description: string;
  effect?: UtilityEffect;
  isEmpowered?: boolean;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  bonus: {
    maxHP?: number;
    attackPower?: number;
    defense?: number;
    energyBonus?: number;
    drawBonus?: number;
  };
  description: string;
  level: number;
}

export interface Enemy {
  id: string;
  name: string;
  maxHP: number;
  hp: number;
  nextIntentDamage: number;
  defeatReward: number;
  level: number;
  isBoss?: boolean;
}

export interface Player {
  level: number;
  experience: number;
  maxHP: number;
  hp: number;
  attackPower: number;
  defense: number;
  bonusEnergy: number;
  bonusDraw: number;
  inventory: Item[];
  equippedItems: {
    weapon?: Item;
    armor?: Item;
    accessory?: Item;
  };
  gold: number;
  coins: number;
}

export interface CombatState {
  playerHP: number;
  playerMaxHP: number;
  playerEnergy: number;
  playerMaxEnergy: number;
  defense: number;
  turn: number;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  enemy: Enemy;
  gameOver: boolean;
  playerWon: boolean;
  message: string;
  playerTaunt: string;
  enemyTaunt: string;
  resultLine?: string;
}

export interface DeckOffer {
  deckType: DeckType;
  empoweredCount: number;
}

export interface GameState {
  screen: 'menu' | 'world' | 'combat' | 'loot' | 'inventory' | 'deckOffer' | 'deckReveal';
  player: Player;
  currentLevel: number;
  maxLevels: number;
  worldPosition: number;
  worldLength: number;
  deckType: DeckType;
  deckCards: Card[];
  bossTier: number;
  combat?: CombatState;
  lootReward?: {
    items: Item[];
    gold: number;
    experience: number;
    coinOffered: boolean;
  };
  deckOffer?: DeckOffer;
  deckReveal?: {
    deckType: DeckType;
    empoweredCards: Card[];
  };
}
