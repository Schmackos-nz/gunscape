/* ============================================================ *
 *  SHARED WORLD DATA  (single source of truth for client + server)
 *
 *  Loads in the browser as a global script (attaches to window) and
 *  in Node via require()/import. Contains only plain data + combat
 *  numbers — NO rendering. The client adds Three.js model builders on
 *  top of ENEMY_STATS; the dedicated server uses these to run the
 *  authoritative world simulation.
 *
 *  To add content: edit ENEMY_STATS / WEAPON_COMBAT / MAP here and
 *  both client and server pick it up.
 * ============================================================ */
(function (root, factory) {
  const D = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else Object.assign(root, D);            // browser: WEAPON_COMBAT, ENEMY_STATS, ... become globals
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // ---- map / world layout ----
  const MAP = {
    HALF: 300,                     // world spans -HALF..HALF
    TOWN: { x: 0, z: 0 },
    OUTPOST: { x: 150, z: -150 },
    TOWN2: { x: 120, z: -90 },     // Tinhollow — quest-giver village
    TOWN_SAFE: 42, OUTPOST_SAFE: 26, TOWN2_SAFE: 40,
    STARTER_R: 95,                 // within this radius of TOWN only low-level (cmb<=8) enemies spawn
    BIOME_EDGE: 55,                // |coord| beyond which quadrant biomes begin
    ENEMY_COUNT: 150,
    // all settlements (safe zones + town biome). r = safe radius.
    TOWNS: [
      { x: 0, z: 0, r: 42, name: 'Riverside' },
      { x: 150, z: -150, r: 30, name: 'Forest Outpost' },
      { x: 120, z: -90, r: 40, name: 'Tinhollow' },
      { x: -125, z: 55, r: 36, name: 'Greenreach' },
      { x: 60, z: 165, r: 36, name: 'Dustfall' },
      { x: -165, z: -120, r: 36, name: 'Ironcross' },
      { x: 195, z: 65, r: 36, name: 'Mistvale' },
      { x: -95, z: 210, r: 36, name: 'Saltmarsh' },
    ],
  };

  // which enemy types spawn in each biome
  const BIOME_SPAWNS = {
    grass:    ['rat', 'wolf', 'coyote'],
    forest:   ['thug', 'raider', 'wolf', 'bandit', 'drone'],
    desert:   ['scorpion', 'mercenary', 'gunslinger', 'marauder'],
    badlands: ['brute', 'sniper', 'warlord', 'ironclad', 'reaver', 'behemoth'],
  };
  // is (x,z) inside any town's safe radius?
  function townAt(x, z) { for (const t of MAP.TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r) return t; return null; }
  // pure biome lookup (mirrors the client's biomeAt, minus colours).
  function biomeKind(x, z) {
    if (townAt(x, z)) return 'town';
    if (z < -MAP.BIOME_EDGE) return 'grass';
    if (x > MAP.BIOME_EDGE) return 'forest';
    if (z > MAP.BIOME_EDGE) return 'desert';
    if (x < -MAP.BIOME_EDGE) return 'badlands';
    return 'grass';
  }

  // ---- weapon combat numbers (display fields live in the client) ----
  const WEAPON_COMBAT = {
    fists:   { dmgMin: 1,  dmgMax: 3,  fireRate: 1100, range: 3,  bloom: 30 },
    zip:     { dmgMin: 2,  dmgMax: 6,  fireRate: 900,  range: 16, bloom: 26 },
    revolver:{ dmgMin: 4,  dmgMax: 9,  fireRate: 850,  range: 20, bloom: 20 },
    smg:     { dmgMin: 3,  dmgMax: 8,  fireRate: 380,  range: 20, bloom: 22 },
    shotgun: { dmgMin: 8,  dmgMax: 18, fireRate: 1000, range: 13, bloom: 14 },
    rifle:   { dmgMin: 14, dmgMax: 26, fireRate: 1200, range: 38, bloom: 6  },
    ak:      { dmgMin: 12, dmgMax: 24, fireRate: 300,  range: 28, bloom: 10 },
  };

  // ---- enemy stats (no build()/model; client merges builders) ----
  const ENEMY_STATS = {
    rat:      { name: 'Sewer Rat',    cmb: 2,  hp: 6,   aim: 2,  dmg: [1, 2],  armour: 1,  fireRate: 1400, range: 9,  xp: 14,  speed: 9,  aggro: 13, tier: 0, coins: [2, 10],   quest: 'rat_tail',      gunChance: .03, armChance: .06 },
    wolf:     { name: 'Mutant Hound', cmb: 9,  hp: 24,  aim: 10, dmg: [3, 7],  armour: 3,  fireRate: 850,  range: 7,  xp: 48,  speed: 16, aggro: 18, tier: 1, coins: [6, 22],   quest: 'hound_fang',    gunChance: .05, armChance: .08 },
    thug:     { name: 'Street Thug',  cmb: 7,  hp: 18,  aim: 6,  dmg: [2, 5],  armour: 4,  fireRate: 1100, range: 16, xp: 34,  speed: 10, aggro: 16, tier: 1, coins: [8, 30],   quest: null,            gunChance: .08, armChance: .10 },
    raider:   { name: 'Raider',       cmb: 18, hp: 36,  aim: 14, dmg: [4, 9],  armour: 10, fireRate: 900,  range: 18, xp: 80,  speed: 10, aggro: 18, tier: 2, coins: [20, 70],  quest: null,            gunChance: .10, armChance: .12 },
    scorpion: { name: 'Dust Scorpion',cmb: 20, hp: 42,  aim: 16, dmg: [5, 11], armour: 14, fireRate: 1100, range: 7,  xp: 98,  speed: 12, aggro: 16, tier: 2, coins: [15, 55],  quest: 'scorpion_tail', gunChance: .08, armChance: .12 },
    mercenary:{ name: 'Mercenary',    cmb: 38, hp: 62,  aim: 28, dmg: [7, 15], armour: 20, fireRate: 700,  range: 20, xp: 165, speed: 11, aggro: 20, tier: 3, coins: [50, 150], quest: 'dog_tags',      gunChance: .14, armChance: .14 },
    sniper:   { name: 'Marksman',     cmb: 40, hp: 46,  aim: 42, dmg: [16, 30],armour: 12, fireRate: 1900, range: 42, xp: 185, speed: 9,  aggro: 48, tier: 4, coins: [60, 170], quest: 'dog_tags',      gunChance: .18, armChance: .12 },
    brute:    { name: 'Scrap Brute',  cmb: 60, hp: 120, aim: 22, dmg: [10, 20],armour: 30, fireRate: 800,  range: 12, xp: 360, speed: 9,  aggro: 18, tier: 4, coins: [100, 260],quest: null,            gunChance: .20, armChance: .20 },
    warlord:  { name: 'Warlord',      cmb: 85, hp: 170, aim: 50, dmg: [12, 26],armour: 40, fireRate: 550,  range: 24, xp: 620, speed: 10, aggro: 26, tier: 5, coins: [250, 600],quest: null,            gunChance: .45, armChance: .40 },
    coyote:   { name: 'Coyote',       cmb: 5,  hp: 14,  aim: 6,  dmg: [2, 5],  armour: 2,  fireRate: 1000, range: 7,  xp: 30,  speed: 15, aggro: 16, tier: 0, coins: [4, 16],   quest: null,            gunChance: .03, armChance: .05 },
    bandit:   { name: 'Bandit',       cmb: 14, hp: 30,  aim: 12, dmg: [3, 8],  armour: 8,  fireRate: 1000, range: 16, xp: 64,  speed: 11, aggro: 17, tier: 1, coins: [12, 44],  quest: null,            gunChance: .10, armChance: .10 },
    drone:    { name: 'Recon Drone',  cmb: 24, hp: 34,  aim: 20, dmg: [5, 10], armour: 8,  fireRate: 700,  range: 22, xp: 96,  speed: 14, aggro: 30, tier: 2, coins: [10, 40],  quest: null,            gunChance: .10, armChance: .06 },
    gunslinger:{ name: 'Gunslinger',  cmb: 30, hp: 48,  aim: 26, dmg: [6, 13], armour: 12, fireRate: 650,  range: 20, xp: 140, speed: 12, aggro: 22, tier: 3, coins: [40, 120], quest: null,            gunChance: .16, armChance: .12 },
    marauder: { name: 'Marauder',     cmb: 46, hp: 72,  aim: 30, dmg: [9, 18], armour: 22, fireRate: 800,  range: 14, xp: 200, speed: 11, aggro: 20, tier: 3, coins: [60, 180], quest: null,            gunChance: .16, armChance: .16 },
    ironclad: { name: 'Ironclad',     cmb: 55, hp: 130, aim: 26, dmg: [10, 20],armour: 38, fireRate: 850,  range: 13, xp: 330, speed: 8,  aggro: 18, tier: 4, coins: [90, 240], quest: null,            gunChance: .20, armChance: .24 },
    reaver:   { name: 'Reaver',       cmb: 70, hp: 150, aim: 40, dmg: [14, 26],armour: 30, fireRate: 650,  range: 20, xp: 430, speed: 11, aggro: 24, tier: 4, coins: [150, 360],quest: null,            gunChance: .30, armChance: .24 },
    behemoth: { name: 'Behemoth',     cmb: 96, hp: 240, aim: 46, dmg: [16, 30],armour: 46, fireRate: 600,  range: 18, xp: 760, speed: 9,  aggro: 26, tier: 5, coins: [300, 700],quest: null,            gunChance: .50, armChance: .45 },
  };

  // ---- loot tiers (index = enemy tier) ----
  const GUN_TIERS = [['zip'], ['zip', 'revolver'], ['revolver', 'smg'], ['smg', 'shotgun'], ['shotgun', 'rifle'], ['rifle', 'ak']];
  const ARMOUR_TIERS = [
    ['cloth_hood', 'cloth_shirt', 'cloth_pants'],
    ['cloth_shirt', 'card_helm', 'card_legs'],
    ['card_helm', 'card_vest', 'card_legs'],
    ['card_vest', 'metal_helm', 'metal_legs'],
    ['metal_helm', 'metal_plate', 'metal_legs'],
    ['metal_plate', 'kev_helm', 'kev_vest', 'kev_legs'],
  ];

  const COMBAT_RANGE = 4.0;          // front-to-front engagement distance

  // multi-combat zones: inside these, many attackers can pile on one target;
  // everywhere else is single-combat (one attacker per enemy at a time).
  const MULTI_ZONES = [
    { x: 180, z: 80, r: 60, name: 'Bandit Camp' },
    { x: -180, z: -150, r: 90, name: 'The Scarlands' },
    { x: 120, z: 150, r: 55, name: 'Crash Site' },
  ];
  function inMulti(x, z) { for (const m of MULTI_ZONES) if (Math.hypot(x - m.x, z - m.z) < m.r) return m; return null; }

  return { MAP, BIOME_SPAWNS, biomeKind, townAt, WEAPON_COMBAT, ENEMY_STATS, GUN_TIERS, ARMOUR_TIERS, COMBAT_RANGE, MULTI_ZONES, inMulti };
});
