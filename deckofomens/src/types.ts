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
}

export interface Player {
  level: number;
  experience: number;
  maxHP: number;
  hp: number;
  attackPower: number;
  defense: number;
  inventory: Item[];
  equippedItems: {
    weapon?: Item;
    armor?: Item;
    accessory?: Item;
  };
  gold: number;
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
}

export interface GameState {
  screen: 'menu' | 'world' | 'combat' | 'loot' | 'inventory';
  player: Player;
  currentLevel: number;
  maxLevels: number;
  worldPosition: number;
  worldLength: number;
  deckType: DeckType;
  combat?: CombatState;
  lootReward?: {
    items: Item[];
    gold: number;
    experience: number;
  };
}
