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
    // Attack/defense are percentage bonuses (0.15 = +15%) applied to a
    // card's own value, not flat numbers added to it - so a weapon makes
    // your cards hit harder proportionally instead of by a fixed amount.
    attackPercent?: number;
    defensePercent?: number;
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
  // Extra qualities for the periodic "special" boss (every few floors):
  // damage reduction against it, multiple attacks per turn, and (handled in
  // Game.tsx's loot generation) dropping loot a level higher than usual.
  isSpecialBoss?: boolean;
  armor?: number;
  attacksPerTurn?: number;
}

export interface Player {
  level: number;
  experience: number;
  maxHP: number;
  hp: number;
  attackPercent: number;
  defensePercent: number;
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
  blockNextHit?: boolean;
}

export interface DeckOffer {
  id: string;
  deckType: DeckType;
  empoweredCount: number;
}

export interface DeckPickupData extends DeckOffer {
  x: number;
  z: number;
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
  playerPosition: { x: number; z: number };
  // Both generated once per level so a pickup declined (or an enemy walked
  // past) stays exactly where it was across every remount of the 3D world -
  // only claiming/defeating it removes it, tracked via the id sets below.
  deckPickups: DeckPickupData[];
  defeatedEnemyIds: string[];
  collectedDeckIds: string[];
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
