import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { Input } from "./Input";
import { Humanoid } from "./Humanoid";

// The player avatar. Crucially it owns NO camera. Movement is tank-style and
// relative to the character itself (W/S drive along its facing, A/D turn it),
// which stays consistent no matter which stranger's eyes the lens is currently
// borrowing. Holstering a gun and firing are owned here too.
export class Player {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3(0, 0, 0);
  facing = 0; // yaw, radians
  sprinting = false;
  armed = false; // gun drawn (held outward) vs holstered

  health = 100;
  maxHealth = 100;
  energy: number = CONFIG.player.energyMax;
  maxEnergy: number = CONFIG.player.energyMax;
  private energyBuff = 0; // seconds of reduced sprint drain (energy drink)
  exhausted = false; // hit empty — must recover before sprinting again
  dead = false;
  // when set, the player is clamped to this box instead of the world (shop interior)
  confine: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
  private invuln = 0;
  private knock = new THREE.Vector3();

  private body: Humanoid;
  private weapon: THREE.Mesh;
  private muzzle: THREE.Mesh;
  private muzzleTimer = 0;
  private tmp = new THREE.Vector3();
  private animSpeed = 0;

  constructor(private world: World) {
    // distinctive outfit so the player reads instantly through any lens
    this.body = new Humanoid({
      skin: 0xe6b58f, hair: 0x1c140d, shirt: 0xe5484d, pants: 0x1c2233, shoes: 0x111316,
    });
    this.group.add(this.body.group);

    // pistol held in the right hand; hidden while holstered
    this.weapon = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.16, 0.52),
      new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4, metalness: 0.5 })
    );
    // barrel runs down the forearm (local -y), so the raised aiming arm makes
    // it point straight forward
    this.weapon.position.set(0, -0.08, 0.0);
    this.weapon.rotation.x = Math.PI / 2;
    this.weapon.visible = false;
    this.body.rightHand.add(this.weapon);

    // muzzle flash at the barrel tip
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 })
    );
    this.muzzle.position.set(0, 0, 0.34);
    this.muzzle.visible = false;
    this.weapon.add(this.muzzle);

    this.group.position.copy(this.pos);
  }

  /** Eye/aim point used for line-of-sight tests against the player. */
  chestPoint(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pos.x, CONFIG.player.height * 0.6, this.pos.z);
  }

  /** Trigger the visual muzzle flash (called when a shot actually fires). */
  flashMuzzle() {
    this.muzzleTimer = 0.06;
    this.muzzle.visible = true;
  }

  /** Eat food: restore health. */
  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /** Energy drink: refill run energy and extend how long it lasts. */
  drinkEnergy(amount: number, buffSeconds: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
    this.energyBuff = Math.max(this.energyBuff, buffSeconds);
  }

  /** World position of the muzzle, for spawning projectiles. */
  getMuzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    this.muzzle.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.muzzle.matrixWorld);
  }

  /** Horizontal aim direction (the way the body — and thus the gun — faces). */
  getAimDir(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  /** Apply a car hit: damage + knockback, with brief invulnerability. */
  takeHit(dmg: number, dir: THREE.Vector3) {
    if (this.invuln > 0 || this.dead) return;
    this.health = Math.max(0, this.health - dmg);
    this.invuln = 0.8;
    this.knock.copy(dir).setY(0).normalize().multiplyScalar(7);
    if (this.health <= 0) this.dead = true;
  }

  private respawn() {
    this.dead = false;
    this.health = this.maxHealth;
    this.pos.set(0, 0, 0);
    this.knock.set(0, 0, 0);
  }

  update(dt: number, input: Input) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      this.muzzle.visible = this.muzzleTimer > 0;
    }

    if (this.dead) {
      this.body.update(dt, 0);
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, Math.PI / 2, 0.1);
      this.invuln -= dt;
      if (this.invuln < -2) { this.group.rotation.z = 0; this.respawn(); }
      this.group.position.copy(this.pos);
      return;
    }

    // holster state is toggled by the input handler; reflect it here
    this.weapon.visible = this.armed;
    this.body.setAiming(this.armed);

    // ── tank-style, character-relative movement ──────────────────────────────
    // A/D turn the body; W/S drive along whichever way it now faces.
    let turn = 0;
    if (input.isDown("a")) turn += 1; // A turns left, D turns right
    if (input.isDown("d")) turn -= 1;
    this.facing += turn * CONFIG.player.turnSpeed * dt;

    let drive = 0;
    if (input.isDown("w")) drive += 1;
    if (input.isDown("s")) drive -= 1;

    // run energy: sprinting drains it (an active drink buff makes it cheap),
    // resting regenerates it. Once it hits empty you're "exhausted" and can't
    // sprint again until it recovers past a threshold.
    if (this.energyBuff > 0) this.energyBuff -= dt;
    this.sprinting = input.isDown("shift") && !this.exhausted && this.energy > 1 && drive !== 0;
    if (this.sprinting) {
      const mul = this.energyBuff > 0 ? CONFIG.player.buffDrainMul : 1;
      this.energy = Math.max(0, this.energy - CONFIG.player.sprintDrain * mul * dt);
      if (this.energy <= 0) this.exhausted = true;
    } else {
      this.energy = Math.min(this.maxEnergy, this.energy + CONFIG.player.energyRegen * dt);
      if (this.exhausted && this.energy >= CONFIG.player.energyRecover) this.exhausted = false;
    }

    const before = this.tmp.copy(this.pos);
    if (drive !== 0) {
      const speed = this.sprinting ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed;
      const fx = Math.sin(this.facing) * drive * speed * dt;
      const fz = Math.cos(this.facing) * drive * speed * dt;
      this.tryMove(fx, fz);
    }

    // apply + decay knockback from car hits
    if (this.knock.lengthSq() > 1e-3) {
      this.tryMove(this.knock.x * dt, this.knock.z * dt);
      this.knock.multiplyScalar(Math.pow(0.02, dt));
    }

    // keep inside the world — OR inside a room (e.g. the shop interior, which
    // sits far off the map and would otherwise be clamped away)
    if (this.confine) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, this.confine.minX, this.confine.maxX);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, this.confine.minZ, this.confine.maxZ);
    } else {
      const half = CONFIG.world.half - 2;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -half, half);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -half, half);
    }

    // animate legs/arms from how fast we actually moved (reverse plays a touch slower)
    const moved = before.distanceTo(this.pos);
    this.animSpeed += (moved / Math.max(dt, 1e-4) - this.animSpeed) * 0.4;
    this.body.update(dt, this.animSpeed);

    this.group.visible = this.invuln > 0 ? Math.floor(this.invuln * 16) % 2 === 0 : true;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
  }

  private tryMove(dx: number, dz: number) {
    const r = CONFIG.player.radius;
    if (!this.world.isInsideBuilding(this.pos.x + dx, this.pos.z, r)) this.pos.x += dx;
    if (!this.world.isInsideBuilding(this.pos.x, this.pos.z + dz, r)) this.pos.z += dz;
  }
}
