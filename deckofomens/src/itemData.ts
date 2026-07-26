import { Item, ItemRarity } from './types';

const rarityColors = {
  common: '#999999',
  uncommon: '#66bb33',
  rare: '#6ba3ff',
  legendary: '#ff6b9d',
};

const weaponNames = [
  'Iron Sword', 'Steel Blade', 'Longsword', 'Battleaxe', 'War Hammer',
  'Greatsword', 'Curved Blade', 'Cleaver', 'Spear', 'Pike',
  'Enchanted Sword', 'Dragon Slayer', 'Rune Blade', 'Void Edge', 'Celestial Lance',
];

const armorNames = [
  'Leather Armor', 'Iron Plate', 'Steel Armor', 'Chain Mail', 'Plate Armor',
  'Reinforced Vest', 'Knight\'s Plate', 'Dragon Scale', 'Mithril Armor', 'Adamantite Plate',
];

const accessoryNames = [
  'Iron Ring', 'Amulet', 'Pendant', 'Bracelet', 'Crown',
  'Enchanted Gem', 'Rune Stone', 'Power Orb', 'Mystic Charm', 'Soul Artifact',
];

function getRandomRarity(level: number): ItemRarity {
  const roll = Math.random();
  const legendaryChance = 0.05 + level * 0.02;
  const rareChance = 0.15 + level * 0.05;
  const uncommonChance = 0.35 + level * 0.1;

  if (roll < legendaryChance) return 'legendary';
  if (roll < legendaryChance + rareChance) return 'rare';
  if (roll < legendaryChance + rareChance + uncommonChance) return 'uncommon';
  return 'common';
}

function getStatBonus(rarity: ItemRarity, level: number, baseAmount: number) {
  const rarityMultipliers = {
    common: 1,
    uncommon: 1.25,
    rare: 1.75,
    legendary: 2.5,
  };

  const multiplier = rarityMultipliers[rarity];
  const levelBonus = level * 0.5;
  return Math.round((baseAmount + levelBonus) * multiplier);
}

export function generateWeapon(level: number, forcedRarity?: ItemRarity): Item {
  const rarity = forcedRarity ?? getRandomRarity(level);
  const name = weaponNames[Math.floor(Math.random() * weaponNames.length)];
  const attackBonus = getStatBonus(rarity, level, 5);

  return {
    id: `weapon-${Date.now()}-${Math.random()}`,
    name,
    type: 'weapon',
    rarity,
    bonus: { attackPower: attackBonus },
    description: `Deals ${attackBonus} additional damage`,
    level,
  };
}

export function generateArmor(level: number, forcedRarity?: ItemRarity): Item {
  const rarity = forcedRarity ?? getRandomRarity(level);
  const name = armorNames[Math.floor(Math.random() * armorNames.length)];
  const defenseBonus = getStatBonus(rarity, level, 4);
  const hpBonus = getStatBonus(rarity, level, 10);

  return {
    id: `armor-${Date.now()}-${Math.random()}`,
    name,
    type: 'armor',
    rarity,
    bonus: { defense: defenseBonus, maxHP: hpBonus },
    description: `+${defenseBonus} defense, +${hpBonus} max HP`,
    level,
  };
}

export function generateAccessory(level: number, forcedRarity?: ItemRarity): Item {
  const rarity = forcedRarity ?? getRandomRarity(level);
  const name = accessoryNames[Math.floor(Math.random() * accessoryNames.length)];
  const roll = Math.random();

  if (roll < 0.33) {
    const hpBonus = getStatBonus(rarity, level, 20);
    return {
      id: `accessory-${Date.now()}-${Math.random()}`,
      name,
      type: 'accessory',
      rarity,
      bonus: { maxHP: hpBonus },
      description: `+${hpBonus} max HP`,
      level,
    };
  } else if (roll < 0.66) {
    const attackBonus = getStatBonus(rarity, level, 3);
    return {
      id: `accessory-${Date.now()}-${Math.random()}`,
      name,
      type: 'accessory',
      rarity,
      bonus: { attackPower: attackBonus },
      description: `+${attackBonus} attack power`,
      level,
    };
  } else {
    const defenseBonus = getStatBonus(rarity, level, 2);
    return {
      id: `accessory-${Date.now()}-${Math.random()}`,
      name,
      type: 'accessory',
      rarity,
      bonus: { defense: defenseBonus },
      description: `+${defenseBonus} defense`,
      level,
    };
  }
}

export function generateLoot(level: number): Item[] {
  const generators = [generateWeapon, generateArmor, generateAccessory];
  const item = generators[Math.floor(Math.random() * generators.length)](level);
  return [item];
}

export function generateBossLoot(level: number): Item[] {
  const generators = [generateWeapon, generateArmor, generateAccessory];
  const item = generators[Math.floor(Math.random() * generators.length)](level, 'legendary');
  return [item];
}

export function getRarityColor(rarity: ItemRarity): string {
  return rarityColors[rarity];
}
