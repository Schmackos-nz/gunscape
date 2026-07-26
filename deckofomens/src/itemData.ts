import { Item, ItemRarity } from './types';

const rarityColors = {
  common: '#999999',
  uncommon: '#66bb33',
  rare: '#6ba3ff',
  legendary: '#ff6b9d',
};

// Each name carries its own base stat(s) so two different items never come
// from the same formula - a "Mithril Armor" is intrinsically stronger than
// an "Iron Plate", not just randomly lucky. Attack/defense are percent
// points (3 = +3%), not flat numbers - see attackPercent/defensePercent.
const weaponTemplates = [
  { name: 'Iron Sword', basePercent: 3 },
  { name: 'Spear', basePercent: 4 },
  { name: 'Steel Blade', basePercent: 4 },
  { name: 'Curved Blade', basePercent: 5 },
  { name: 'Pike', basePercent: 5 },
  { name: 'Longsword', basePercent: 5 },
  { name: 'Cleaver', basePercent: 6 },
  { name: 'Battleaxe', basePercent: 6 },
  { name: 'War Hammer', basePercent: 7 },
  { name: 'Greatsword', basePercent: 8 },
  { name: 'Enchanted Sword', basePercent: 9 },
  { name: 'Rune Blade', basePercent: 10 },
  { name: 'Void Edge', basePercent: 11 },
  { name: 'Dragon Slayer', basePercent: 13 },
  { name: 'Celestial Lance', basePercent: 14 },
];

const armorTemplates = [
  { name: 'Leather Armor', basePercent: 2, baseHP: 8 },
  { name: 'Iron Plate', basePercent: 3, baseHP: 10 },
  { name: 'Steel Armor', basePercent: 4, baseHP: 12 },
  { name: 'Chain Mail', basePercent: 4, baseHP: 14 },
  { name: 'Plate Armor', basePercent: 5, baseHP: 16 },
  { name: 'Reinforced Vest', basePercent: 5, baseHP: 18 },
  { name: "Knight's Plate", basePercent: 6, baseHP: 20 },
  { name: 'Dragon Scale', basePercent: 8, baseHP: 24 },
  { name: 'Mithril Armor', basePercent: 9, baseHP: 28 },
  { name: 'Adamantite Plate', basePercent: 10, baseHP: 32 },
];

type AccessoryBonusType = 'maxHP' | 'attackPercent' | 'defensePercent' | 'energyBonus' | 'drawBonus';

// Energy and draw are much more powerful per unit than raw stats (even +1
// energy or +1 card every turn compounds a lot), so their base stays small
// regardless of name AND doesn't get the infinite per-level scaling below -
// the name still fixes WHICH stat the item grants, just not an unbounded
// amount for those two.
const accessoryTemplates: { name: string; bonusType: AccessoryBonusType; base: number }[] = [
  { name: 'Iron Ring', bonusType: 'defensePercent', base: 2 },
  { name: 'Bracelet', bonusType: 'defensePercent', base: 4 },
  { name: 'Pendant', bonusType: 'attackPercent', base: 3 },
  { name: 'Power Orb', bonusType: 'attackPercent', base: 5 },
  { name: 'Amulet', bonusType: 'maxHP', base: 15 },
  { name: 'Enchanted Gem', bonusType: 'maxHP', base: 20 },
  { name: 'Crown', bonusType: 'maxHP', base: 25 },
  { name: 'Soul Artifact', bonusType: 'maxHP', base: 35 },
  { name: 'Rune Stone', bonusType: 'energyBonus', base: 1 },
  { name: 'Mystic Charm', bonusType: 'drawBonus', base: 1 },
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

// Items never plateau: level (tied directly to the floor they dropped on)
// compounds at +10% per level instead of the old flat "+level*0.5", so gear
// found on floor 20 is meaningfully stronger than floor 2 gear of the same
// name/rarity rather than converging toward the same few extra points.
function getStatBonus(rarity: ItemRarity, level: number, baseAmount: number) {
  const rarityMultipliers = {
    common: 1,
    uncommon: 1.25,
    rare: 1.75,
    legendary: 2.5,
  };

  const multiplier = rarityMultipliers[rarity];
  const levelMultiplier = Math.pow(1.1, level);
  return Math.round(baseAmount * multiplier * levelMultiplier);
}

// Energy/draw stay flat by rarity instead of scaling with level/base - see
// the comment on accessoryTemplates for why.
function getUtilityBonus(rarity: ItemRarity): number {
  return rarity === 'legendary' ? 2 : 1;
}

export function generateWeapon(level: number, forcedRarity?: ItemRarity): Item {
  const rarity = forcedRarity ?? getRandomRarity(level);
  const template = weaponTemplates[Math.floor(Math.random() * weaponTemplates.length)];
  const attackPercent = getStatBonus(rarity, level, template.basePercent);

  return {
    id: `weapon-${Date.now()}-${Math.random()}`,
    name: template.name,
    type: 'weapon',
    rarity,
    bonus: { attackPercent },
    description: `+${attackPercent}% damage`,
    level,
  };
}

export function generateArmor(level: number, forcedRarity?: ItemRarity): Item {
  const rarity = forcedRarity ?? getRandomRarity(level);
  const template = armorTemplates[Math.floor(Math.random() * armorTemplates.length)];
  const defensePercent = getStatBonus(rarity, level, template.basePercent);
  const hpBonus = getStatBonus(rarity, level, template.baseHP);

  return {
    id: `armor-${Date.now()}-${Math.random()}`,
    name: template.name,
    type: 'armor',
    rarity,
    bonus: { defensePercent, maxHP: hpBonus },
    description: `+${defensePercent}% defense, +${hpBonus} max HP`,
    level,
  };
}

export function generateAccessory(level: number, forcedRarity?: ItemRarity): Item {
  const rarity = forcedRarity ?? getRandomRarity(level);
  const template = accessoryTemplates[Math.floor(Math.random() * accessoryTemplates.length)];

  if (template.bonusType === 'energyBonus') {
    const energyBonus = getUtilityBonus(rarity);
    return {
      id: `accessory-${Date.now()}-${Math.random()}`,
      name: template.name,
      type: 'accessory',
      rarity,
      bonus: { energyBonus },
      description: `+${energyBonus} energy per turn`,
      level,
    };
  }

  if (template.bonusType === 'drawBonus') {
    const drawBonus = getUtilityBonus(rarity);
    return {
      id: `accessory-${Date.now()}-${Math.random()}`,
      name: template.name,
      type: 'accessory',
      rarity,
      bonus: { drawBonus },
      description: `+${drawBonus} card${drawBonus > 1 ? 's' : ''} drawn per turn`,
      level,
    };
  }

  const amount = getStatBonus(rarity, level, template.base);
  if (template.bonusType === 'maxHP') {
    return {
      id: `accessory-${Date.now()}-${Math.random()}`,
      name: template.name,
      type: 'accessory',
      rarity,
      bonus: { maxHP: amount },
      description: `+${amount} max HP`,
      level,
    };
  }

  const label = template.bonusType === 'attackPercent' ? 'damage' : 'defense';
  return {
    id: `accessory-${Date.now()}-${Math.random()}`,
    name: template.name,
    type: 'accessory',
    rarity,
    bonus: { [template.bonusType]: amount },
    description: `+${amount}% ${label}`,
    level,
  };
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
