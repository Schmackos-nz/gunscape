/* ============================================================ *
 *  AUTHORITATIVE WORLD SIMULATION (server-side)
 *
 *  Owns enemies, loot, and combat resolution for the shared world.
 *  Uses shared/world-data.js (same stats/tiers/weapons as the client)
 *  so the simulation matches what players see. Clients send movement
 *  + attack/pickup intents; the server decides outcomes and ships
 *  snapshots. This is the foundation of the server-authoritative
 *  rewrite — the client renderer consumes `snapshot()`.
 * ============================================================ */
import '../shared/world-data.js';   // UMD: under ESM `module` is undefined → assigns to globalThis
const { MAP, BIOME_SPAWNS, biomeKind, WEAPON_COMBAT, ENEMY_STATS, GUN_TIERS, ARMOUR_TIERS, COMBAT_RANGE } = globalThis;

const rnd = (a, b) => a + Math.random() * (b - a);
const randint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class World {
  constructor() {
    this.enemies = [];
    this.loot = [];
    this.players = new Map();    // pid -> {x,z,ry,hp,maxhp,armour,aim,weapon,attacking,lastShot,dead,respawnAt}
    this.nid = 1;
    this.spawn();
  }

  spawn() {
    let placed = 0, guard = 0;
    while (placed < MAP.ENEMY_COUNT && guard < 9000) {
      guard++;
      const x = (Math.random() * 2 - 1) * (MAP.HALF - 12);
      const z = (Math.random() * 2 - 1) * (MAP.HALF - 12);
      const kind = biomeKind(x, z);
      const list = BIOME_SPAWNS[kind];
      if (!list) continue;
      if (Math.hypot(x - MAP.TOWN.x, z - MAP.TOWN.z) < MAP.TOWN_SAFE) continue;
      if (Math.hypot(x - MAP.OUTPOST.x, z - MAP.OUTPOST.z) < MAP.OUTPOST_SAFE) continue;
      let type = pick(list);
      if (type === 'warlord' && Math.random() > 0.4) type = 'brute';
      if (type === 'warlord' && Math.hypot(x - MAP.TOWN.x, z - MAP.TOWN.z) < 200) type = 'brute';
      const s = ENEMY_STATS[type];
      this.enemies.push({ id: this.nid++, type, x, z, ry: 0, hx: x, hz: z,
        hp: s.hp, maxhp: s.hp, dead: false, respawnAt: 0, lastShot: 0,
        target: null, aggro: false, wanderT: 0, wx: x, wz: z });
      placed++;
    }
  }

  addPlayer(pid, profile) {
    const p = profile || {};
    this.players.set(pid, { x: p.x ?? 0, z: p.z ?? 40, ry: 0,
      hp: p.hp ?? p.maxhp ?? 100, maxhp: p.maxhp ?? 100, armour: p.armour ?? 1, aim: p.aim ?? 1,
      weapon: p.weapon || 'zip', attacking: null, lastShot: 0, lastHit: 0, dead: false, respawnAt: 0 });
  }
  removePlayer(pid) { this.players.delete(pid); for (const e of this.enemies) if (e.target === pid) e.target = null; }

  input(pid, msg) {
    const p = this.players.get(pid); if (!p || p.dead) return;
    if (typeof msg.x === 'number') p.x = clamp(msg.x);
    if (typeof msg.z === 'number') p.z = clamp(msg.z);
    if (typeof msg.ry === 'number') p.ry = msg.ry;
    if (typeof msg.armour === 'number') p.armour = msg.armour;
    if (typeof msg.aim === 'number') p.aim = msg.aim;
    if (typeof msg.maxhp === 'number') { p.maxhp = msg.maxhp; if (p.hp > p.maxhp) p.hp = p.maxhp; }
    if (msg.weapon) p.weapon = msg.weapon;
  }
  attackIntent(pid, enemyId) { const p = this.players.get(pid); if (p) p.attacking = enemyId; }
  heal(pid, amt) { const p = this.players.get(pid); if (p && !p.dead) p.hp = Math.min(p.maxhp, p.hp + Math.max(0, amt || 0)); }
  dropLoot(pid, items, x, z) {                       // spawn a dead player's gear as ground loot
    const now = Date.now();
    const add = (k, n) => this.loot.push({ id: this.nid++, k, n, x: x + rnd(-2, 2), z: z + rnd(-2, 2), owner: pid, publicAt: now + 60000, despawnAt: now + 120000 });
    add('bones', 1);
    for (const it of (items || [])) if (it && it.k) add(it.k, it.n || 1);
  }

  // returns { events (per-owner: xp/hurt/death), fx (broadcast: damage numbers) }
  tick(dt, now) {
    const events = [];
    const fx = [];   // combat damage numbers visible to everyone
    const alive = [...this.players.entries()].filter(([, p]) => !p.dead);

    // ---- player → enemy attacks + out-of-combat regen ----
    for (const [pid, p] of this.players) {
      if (p.dead) { if (now >= p.respawnAt) { p.dead = false; p.hp = p.maxhp; p.x = 0; p.z = 40; } continue; }
      if (now - p.lastHit > 3000 && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + dt * 1.2); // slow regen
      if (!p.attacking) continue;
      const e = this.enemies.find(e => e.id === p.attacking && !e.dead);
      if (!e) { p.attacking = null; continue; }
      const wc = WEAPON_COMBAT[p.weapon] || WEAPON_COMBAT.zip;
      if (dist(p, e) > COMBAT_RANGE + 0.5) continue;          // client walks into range
      if (now - p.lastShot < wc.fireRate) continue;
      p.lastShot = now;
      const stats = ENEMY_STATS[e.type];
      const acc = 100 / (1 + wc.bloom * 0.06) * (1 + p.aim / 99);
      if (Math.random() < acc / (acc + stats.armour)) {
        const dmg = randint(wc.dmgMin, wc.dmgMax); e.hp -= dmg;
        fx.push({ k: 'ehit', x: e.x, z: e.z, dmg });
        if (e.hp <= 0) { this.killEnemy(e, pid, now); events.push({ pid, t: 'xp', xp: stats.xp, name: stats.name }); }
      }
    }

    // ---- enemy AI + attacks ----
    for (const e of this.enemies) {
      if (e.dead) { if (now >= e.respawnAt) { e.dead = false; e.hp = e.maxhp; e.x = e.hx; e.z = e.hz; e.target = null; e.aggro = false; } continue; }
      const stats = ENEMY_STATS[e.type];
      // acquire nearest player
      let near = null, nd = 1e9;
      for (const [pid, p] of alive) { const d = dist(e, p); if (d < nd) { nd = d; near = pid; } }
      const tgt = near != null ? this.players.get(near) : null;
      const peaceful = stats.tier <= 1 && Math.hypot(e.x - MAP.TOWN.x, e.z - MAP.TOWN.z) < 100;
      if (tgt && !peaceful && nd < stats.aggro) e.aggro = true;
      if (e.aggro && (!tgt || nd > stats.aggro + 12)) e.aggro = false;

      if (e.aggro && tgt) {
        if (nd <= COMBAT_RANGE + 0.4) {
          e.ry = Math.atan2(tgt.x - e.x, tgt.z - e.z);
          if (now - e.lastShot >= stats.fireRate) {
            e.lastShot = now;
            const acc = stats.aim + 8;
            if (Math.random() < acc / (acc + tgt.armour)) {
              let dmg = randint(stats.dmg[0], stats.dmg[1]); dmg = Math.max(1, dmg - Math.floor(tgt.armour * 0.12));
              tgt.hp -= dmg; tgt.lastHit = now;
              events.push({ pid: near, t: 'hurt', dmg });
              fx.push({ k: 'phit', x: tgt.x, z: tgt.z, dmg });
              if (tgt.hp <= 0) { tgt.hp = 0; tgt.dead = true; tgt.respawnAt = now + 4000; events.push({ pid: near, t: 'death' }); }
            }
          }
        } else { // chase
          const dx = tgt.x - e.x, dz = tgt.z - e.z, l = Math.hypot(dx, dz) || 1, s = stats.speed * dt;
          e.x += dx / l * s; e.z += dz / l * s; e.ry = Math.atan2(dx, dz);
        }
      } else { // wander near home
        if (now >= e.wanderT) { e.wanderT = now + rnd(2500, 6000); e.wx = e.hx + rnd(-10, 10); e.wz = e.hz + rnd(-10, 10); }
        const dx = e.wx - e.x, dz = e.wz - e.z, l = Math.hypot(dx, dz);
        if (l > 0.5) { const s = stats.speed * 0.4 * dt; e.x += dx / l * s; e.z += dz / l * s; e.ry = Math.atan2(dx, dz); }
      }
    }

    // ---- loot despawn (120s) ----
    for (let i = this.loot.length - 1; i >= 0; i--) if (now >= this.loot[i].despawnAt) this.loot.splice(i, 1);
    return { events, fx };
  }

  killEnemy(e, killerPid, now) {
    e.dead = true; e.respawnAt = now + 9000; e.target = null;
    const s = ENEMY_STATS[e.type];
    const at = () => ({ x: e.x + rnd(-1.5, 1.5), z: e.z + rnd(-1.5, 1.5) });
    const drop = (k, n) => { const a = at(); this.loot.push({ id: this.nid++, k, n, x: a.x, z: a.z, owner: killerPid, publicAt: now + 60000, despawnAt: now + 120000 }); };
    drop('bones', 1);
    drop('coins', randint(s.coins[0], s.coins[1]));
    const common = []; if (s.quest) common.push(s.quest, s.quest);
    if (e.type === 'rat' || e.type === 'wolf') common.push('raw_meat', 'raw_meat');
    common.push('scrap', 'scrap', 'bandage'); if (s.tier >= 3) common.push('medkit');
    drop(pick(common), 1);
    if (Math.random() < s.gunChance) { const pool = GUN_TIERS[s.tier]; drop(Math.random() < 0.5 ? pool[pool.length - 1] : pick(pool), 1); }
    if (Math.random() < s.armChance) drop(pick(ARMOUR_TIERS[s.tier]), 1);
  }

  pickup(pid, lootId) {
    const i = this.loot.findIndex(l => l.id === lootId);
    if (i < 0) return null;
    const l = this.loot[i];
    if (l.owner !== pid && Date.now() < l.publicAt) return null; // still private to owner
    this.loot.splice(i, 1);
    return { k: l.k, n: l.n };
  }

  snapshot() {
    return {
      enemies: this.enemies.filter(e => !e.dead).map(e => ({ id: e.id, type: e.type, x: +e.x.toFixed(2), z: +e.z.toFixed(2), ry: +e.ry.toFixed(2), hp: e.hp, maxhp: e.maxhp })),
      loot: this.loot.map(l => ({ id: l.id, k: l.k, n: l.n, x: l.x, z: l.z, owner: l.owner, publicAt: l.publicAt })),
    };
  }
}
function clamp(v) { return Math.max(-(MAP.HALF - 4), Math.min(MAP.HALF - 4, v)); }
