import { Item, ItemRarity } from './types';

const rarityColors = {
  common: '#999999',
  uncommon: '#66bb33',
  rare: '#6ba3ff',
  legendary: '#ff6b9d',
};

// Each name carries its own base stat(s) so two different items never come
// from the same formula - a "Mithril Armor" is intrinsically stronger than
// an "Iron Plate", not just randomly lucky.
const weaponTemplates = [
  { name: 'Iron Sword', baseAttack: 3 },
  { name: 'Spear', baseAttack: 4 },
  { name: 'Steel Blade', baseAttack: 4 },
  { name: 'Curved Blade', baseAttack: 5 },
  { name: 'Pike', baseAttack: 5 },
  { name: 'Longsword', baseAttack: 5 },
  { name: 'Cleaver', baseAttack: 6 },
  { name: 'Battleaxe', baseAttack: 6 },
  { name: 'War Hammer', baseAttack: 7 },
  { name: 'Greatsword', baseAttack: 8 },
  { name: 'Enchanted Sword', baseAttack: 9 },
  { name: 'Rune Blade', baseAttack: 10 },
  { name: 'Void Edge', baseAttack: 11 },
  { name: 'Dragon Slayer', baseAttack: 13 },
  { name: 'Celestial Lance', baseAttack: 14 },
];

const armorTemplates = [
  { name: 'Leather Armor', baseDefense: 2, baseHP: 8 },
  { name: 'Iron Plate', baseDefense: 3, baseHP: 10 },
  { name: 'Steel Armor', baseDefense: 4, baseHP: 12 },
  { name: 'Chain Mail', baseDefense: 4, baseHP: 14 },
  { name: 'Plate Armor', baseDefense: 5, baseHP: 16 },
  { name: 'Reinforced Vest', baseDefense: 5, baseHP: 18 },
  { name: "Knight's Plate", baseDefense: 6, baseHP: 20 },
  { name: 'Dragon Scale', baseDefense: 8, baseHP: 24 },
  { name: 'Mithril Armor', baseDefense: 9, baseHP: 28 },
  { name: 'Adamantite Plate', baseDefense: 10, baseHP: 32 },
];

type AccessoryBonusType = 'maxHP' | 'attackPower' | 'defense' | 'energyBonus' | 'drawBonus';

// Energy and draw are much more powerful per unit than raw stats (even +1
// energy or +1 card every turn compounds a lot), so their base stays small
// regardless of name - the name still fixes WHICH stat the item grants,
// just not an unbounded base amount for those two.
const accessoryTemplates: { name: string; bonusType: AccessoryBonusType; base: number }[] = [
  { name: 'Iron Ring', bonusType: 'defense', base: 2 },
  { name: 'Bracelet', bonusType: 'defense', base: 4 },
  { name: 'Pendant', bonusType: 'attackPower', base: 3 },
  { name: 'Power Orb', bonusType: 'attackPower', base: 5 },
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

// Energy/draw stay flat by rarity instead of scaling with level/base - see
// the comment on accessoryTemplates for why.
function getUtilityBonus(rarity: ItemRarity): number {
  return rarity === 'legendary' ? 2 : 1;
}

export function generateWeapon(level: number, forcedRarity?: ItemRarity): Item {
  const rarity = forcedRarity ?? getRandomRarity(level);
  const template = weaponTemplates[Math.floor(Math.random() * weaponTemplates.length)];
  const attackBonus = getStatBonus(rarity, level, template.baseAttack);

  return {
    id: `weapon-${Date.now()}-${Math.random()}`,
    name: template.name,
    type: 'weapon',
    rarity,
    bonus: { attackPower: attackBonus },
    description: `Deals ${attackBonus} additional damage`,
    level,
  };
}

export function generateArmor(level: number, forcedRarity?: ItemRarity): Item {
  const rarity = forcedRarity ?? getRandomRarity(level);
  const template = armorTemplates[Math.floor(Math.random() * armorTemplates.length)];
  const defenseBonus = getStatBonus(rarity, level, template.baseDefense);
  const hpBonus = getStatBonus(rarity, level, template.baseHP);

  return {
    id: `armor-${Date.now()}-${Math.random()}`,
    name: template.name,
    type: 'armor',
    rarity,
    bonus: { defense: defenseBonus, maxHP: hpBonus },
    description: `+${defenseBonus} defense, +${hpBonus} max HP`,
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
  const labels: Record<'maxHP' | 'attackPower' | 'defense', string> = {
    maxHP: 'max HP',
    attackPower: 'attack power',
    defense: 'defense',
  };
  return {
    id: `accessory-${Date.now()}-${Math.random()}`,
    name: template.name,
    type: 'accessory',
    rarity,
    bonus: { [template.bonusType]: amount },
    description: `+${amount} ${labels[template.bonusType as 'maxHP' | 'attackPower' | 'defense']}`,
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
