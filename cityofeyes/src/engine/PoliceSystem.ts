import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { Player } from "./Player";
import { CrowdSystem } from "./CrowdSystem";
import { Pedestrian } from "./Pedestrian";
import { Humanoid } from "./Humanoid";
import { Sfx } from "./Sfx";
import { clearLineOfSight } from "./los";

// An officer pursues the nearest threat: the wanted player (whom it shoots) or
// a brawling civilian (whom it chases down and breaks up). Takes bullet damage
// and collapses.
class Officer {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  heading = 0;
  health = CONFIG.police.health;
  dead = false;
  private deadTimer = 0;
  private body: Humanoid;
  private shootCd = 1 + Math.random();
  private eye = new THREE.Vector3();
  private to = new THREE.Vector3();

  constructor(spawn: THREE.Vector3) {
    this.body = new Humanoid({
      skin: 0xddb38c, hair: 0x20242c, shirt: 0x1f3a6b, pants: 0x161a24, shoes: 0x0c0e12,
    });
    this.group.add(this.body.group);
    this.pos.copy(spawn);
    this.group.position.copy(this.pos);
  }

  takeDamage(dmg: number): boolean {
    if (this.dead) return false;
    this.health -= dmg;
    if (this.health <= 0) { this.dead = true; return true; }
    return false;
  }

  /** Returns true once the death animation is done and it can be culled. */
  tickDead(dt: number): boolean {
    this.deadTimer += dt;
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, Math.PI / 2, 0.12);
    this.body.update(dt, 0);
    return this.deadTimer > 6;
  }

  idle(dt: number) {
    this.body.setAiming(false);
    this.body.update(dt, 0);
  }

  step(
    dt: number,
    targetPos: THREE.Vector3,
    isPlayer: boolean,
    targetDead: boolean,
    world: World,
    sfx: Sfx,
    onShootPlayer: (dmg: number, dir: THREE.Vector3) => void,
    onArrest: () => void
  ) {
    this.to.copy(targetPos).sub(this.pos).setY(0);
    const dist = this.to.length();
    if (dist > 1e-3) { this.to.divideScalar(dist); this.heading = Math.atan2(this.to.x, this.to.z); }

    this.eye.set(this.pos.x, 1.6, this.pos.z);
    const aimAt = new THREE.Vector3(targetPos.x, 1.0, targetPos.z);
    const sees = clearLineOfSight(this.eye, aimAt, world.occluders);

    let moving = 0;
    if (isPlayer) {
      const inRange = dist < CONFIG.police.shootRange && sees;
      if (!inRange || dist > CONFIG.police.shootRange * 0.7) { this.advance(dt, world); moving = CONFIG.police.speed; }
      this.body.setAiming(inRange);
      this.shootCd -= dt;
      if (inRange && this.shootCd <= 0 && !targetDead) {
        this.shootCd = CONFIG.police.shootCooldown;
        sfx.gun();
        onShootPlayer(CONFIG.police.damage, this.to.clone());
      }
    } else {
      // chase a brawler and break it up on contact
      this.body.setAiming(false);
      if (dist > CONFIG.police.arrestRange) { this.advance(dt, world); moving = CONFIG.police.speed; }
      else onArrest();
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.body.update(dt, moving);
  }

  private advance(dt: number, world: World) {
    const step = CONFIG.police.speed * dt;
    const nx = this.pos.x + this.to.x * step;
    const nz = this.pos.z + this.to.z * step;
    if (!world.isInsideBuilding(nx, this.pos.z, 0.4)) this.pos.x = nx;
    if (!world.isInsideBuilding(this.pos.x, nz, 0.4)) this.pos.z = nz;
  }
}

export class PoliceSystem {
  private officers: Officer[] = [];

  constructor(private scene: THREE.Scene, private world: World) {}

  get count() { return this.officers.length; }

  officerAt(prev: THREE.Vector3, now: THREE.Vector3, radius: number): Officer | null {
    for (const o of this.officers) {
      if (o.dead) continue;
      const p = new THREE.Vector3(o.pos.x, 1.0, o.pos.z);
      if (distToSegmentSq(p, prev, now) < radius * radius) return o;
    }
    return null;
  }

  setTargetCount(target: number, player: Player) {
    const alive = this.officers.filter((o) => !o.dead).length;
    for (let i = alive; i < target; i++) this.spawn(player);
  }

  private spawn(player: Player) {
    const a = Math.random() * Math.PI * 2;
    const half = CONFIG.world.half - 4;
    this.officers.push(new Officer(new THREE.Vector3(
      THREE.MathUtils.clamp(player.pos.x + Math.cos(a) * CONFIG.police.spawnDist, -half, half),
      0,
      THREE.MathUtils.clamp(player.pos.z + Math.sin(a) * CONFIG.police.spawnDist, -half, half)
    )));
    this.scene.add(this.officers[this.officers.length - 1].group);
  }

  clear() {
    for (const o of this.officers) this.scene.remove(o.group);
    this.officers.length = 0;
  }

  update(
    dt: number,
    player: Player,
    crowd: CrowdSystem,
    sfx: Sfx,
    playerWanted: boolean,
    onShootPlayer: (dmg: number, dir: THREE.Vector3) => void
  ) {
    const fugitives = crowd.peds.filter((p) => !p.dead && p.fightTarget);

    for (let i = this.officers.length - 1; i >= 0; i--) {
      const o = this.officers[i];
      if (o.dead) {
        if (o.tickDead(dt)) { this.scene.remove(o.group); this.officers.splice(i, 1); }
        continue;
      }

      // nearest threat: player (if wanted) or a brawler
      let targetPos: THREE.Vector3 | null = null;
      let isPlayer = false;
      let targetPed: Pedestrian | null = null;
      let bestD = Infinity;
      if (playerWanted) { targetPos = player.pos; isPlayer = true; bestD = o.pos.distanceToSquared(player.pos); }
      for (const f of fugitives) {
        const d = o.pos.distanceToSquared(f.pos);
        if (d < bestD) { bestD = d; targetPos = f.pos; isPlayer = false; targetPed = f; }
      }

      if (!targetPos) { o.idle(dt); continue; }
      o.step(dt, targetPos, isPlayer, player.dead, this.world, sfx, onShootPlayer, () => {
        if (targetPed) {
          const other = targetPed.fightTarget;
          targetPed.fightTarget = null;
          targetPed.aggro = 0;
          if (other) { other.fightTarget = null; other.aggro = 0; }
        }
      });
    }
  }
}

function distToSegmentSq(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const len = abx * abx + aby * aby + abz * abz;
  let t = len > 0 ? (apx * abx + apy * aby + apz * abz) / len : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}
