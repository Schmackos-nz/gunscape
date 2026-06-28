import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { Pedestrian } from "./Pedestrian";
import { CCTV } from "./FallbackLenses";
import { Player } from "./Player";
import { Sfx } from "./Sfx";
import { Voice } from "./Voice";
import { clearLineOfSight } from "./los";

// Owns the citizens and the fixed cameras. After everyone has moved, a
// separation pass resolves body overlaps (ped-ped and ped-player), which is
// what makes the crowd jostle. Sustained jostling builds aggression that can
// spark a fistfight between two pedestrians.
export class CrowdSystem {
  readonly peds: Pedestrian[] = [];
  readonly cctv: CCTV[] = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor(private world: World) {
    for (let i = 0; i < CONFIG.crowd.count; i++) {
      const p = new Pedestrian(i, world, world.roads);
      this.peds.push(p);
      world.scene.add(p.group);
    }
    world.cctvMounts.forEach((m, i) => this.cctv.push(new CCTV(i, m.pos, m.forward)));
  }

  update(dt: number, player: Player, seesPlayer: (p: Pedestrian) => boolean, sfx: Sfx, voice: Voice) {
    // armed civilians assess whether the player is drawing on them (before they
    // pick their behaviour for the frame)
    for (const p of this.peds) if (p.armed && !p.dead) this.assessThreat(dt, p, player, sfx, voice);

    for (const p of this.peds) {
      p.update(dt, player.pos, seesPlayer(p));
      if (p.enteredPanic && p.pos.distanceToSquared(player.pos) < 32 * 32 && Math.random() < 0.5) {
        voice.empathy();
      }
    }
    this.resolveCollisions(dt, player, sfx, voice);
  }

  // An armed civilian draws on (and shoots back at) a player who points a gun
  // at them. Pure self-defence — it doesn't raise the wanted level.
  private assessThreat(dt: number, p: Pedestrian, player: Player, sfx: Sfx, voice: Voice) {
    p.shootCd -= dt;
    let threatened = false;
    if (player.armed && !player.dead) {
      const dx = p.pos.x - player.pos.x;
      const dz = p.pos.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5 && dist < CONFIG.combat.civShootRange) {
        const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
        const dot = (fx * dx + fz * dz) / dist; // is the player pointing at them?
        if (dot > Math.cos(THREE.MathUtils.degToRad(CONFIG.combat.civAimDeg))) {
          const eye = this.tmpA.set(p.pos.x, 1.0, p.pos.z);
          const chest = player.chestPoint(this.tmpB);
          if (clearLineOfSight(eye, chest, this.world.occluders)) threatened = true;
        }
      }
    }
    p.defensive = threatened;
    if (threatened && p.shootCd <= 0) {
      p.shootCd = CONFIG.combat.civShootCooldown;
      sfx.gun();
      player.takeHit(CONFIG.combat.civDamage, this.tmpA.set(player.pos.x - p.pos.x, 0, player.pos.z - p.pos.z));
      if (Math.random() < 0.4) voice.abuse();
    }
  }

  private resolveCollisions(dt: number, player: Player, sfx: Sfx, voice: Voice) {
    const peds = this.peds;
    const r = CONFIG.crowd.bodyRadius;
    const minD = r * 2;
    const minD2 = minD * minD;

    for (let i = 0; i < peds.length; i++) {
      const a = peds[i];
      if (a.dead) continue;

      for (let j = i + 1; j < peds.length; j++) {
        const b = peds[j];
        if (b.dead) continue;
        let dx = b.pos.x - a.pos.x;
        let dz = b.pos.z - a.pos.z;
        let d2 = dx * dx + dz * dz;
        if (d2 >= minD2) continue;

        if (d2 < 1e-6) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d2 = dx * dx + dz * dz; }
        const d = Math.sqrt(d2);
        const push = (minD - d) * 0.5;
        const nx = dx / d, nz = dz / d;
        a.pos.x -= nx * push; a.pos.z -= nz * push;
        b.pos.x += nx * push; b.pos.z += nz * push;

        a.contactThisFrame = b.contactThisFrame = true;
        a.aggro += dt; b.aggro += dt;
        this.maybeStartFight(a, b);
      }

      // player collision: shove the ped most, nudge the player a little
      let dx = a.pos.x - player.pos.x;
      let dz = a.pos.z - player.pos.z;
      const pr = CONFIG.player.radius + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < pr * pr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const overlap = pr - d;
        const nx = dx / d, nz = dz / d;
        a.pos.x += nx * overlap * 0.7;
        a.pos.z += nz * overlap * 0.7;
        a.contactThisFrame = true;
        const px = player.pos.x - nx * overlap * 0.3;
        const pz = player.pos.z - nz * overlap * 0.3;
        if (!this.world.isInsideBuilding(px, player.pos.z, CONFIG.player.radius)) player.pos.x = px;
        if (!this.world.isInsideBuilding(player.pos.x, pz, CONFIG.player.radius)) player.pos.z = pz;
        if (Math.random() < 0.04) voice.abuse(); // shoved by the player — rude!
      }
    }

    // brawl punch sounds
    for (const a of peds) {
      if (a.fightTarget && !a.dead && a.punchCd <= 0) {
        sfx.punch();
        a.punchCd = 0.32 + Math.random() * 0.25;
      }
    }
    player.group.position.copy(player.pos);
  }

  private maybeStartFight(a: Pedestrian, b: Pedestrian) {
    if (a.fightTarget || b.fightTarget) return;
    const t = CONFIG.crowd.aggroToFight;
    if (a.aggro > t && b.aggro > t) {
      if (Math.random() < CONFIG.crowd.fightChance) {
        const secs = 2.5 + Math.random() * 2.5;
        a.startFight(b, secs);
        b.startFight(a, secs);
      } else {
        a.aggro = b.aggro = 0; // just a grumble — move along
      }
    }
  }
}
