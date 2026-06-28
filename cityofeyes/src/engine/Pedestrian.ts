import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { RoadNetwork } from "./RoadNetwork";
import { Spectator, LensKind } from "./Spectator";
import { Humanoid, randomCivilianColors } from "./Humanoid";

export type AlarmState = "calm" | "alert" | "panic";

// A citizen who walks the pavement on their own route and ignores the player
// until alarm builds. The same object is a Spectator the camera can ride. Peds
// physically collide with each other and the player (resolved in CrowdSystem);
// sustained shoving builds aggression that can erupt into a fistfight.
export class Pedestrian implements Spectator {
  readonly id: string;
  readonly mechanical = false;
  kind: LensKind;
  stability: number;
  fieldOfViewCos = Math.cos(THREE.MathUtils.degToRad(70));

  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  heading = 0;

  alarm = 0;
  state: AlarmState = "calm";
  enteredPanic = false; // true on the frame they first panic (for voice lines)
  private prevState: AlarmState = "calm";
  dead = false;
  shopping = false; // ducked into a store; hidden + inert
  private shopTimer = 0;
  health = CONFIG.crowd.health;

  // shoving / brawling
  aggro = 0;
  contactThisFrame = false;
  fightTarget: Pedestrian | null = null;
  fightTimer = 0;
  punchCd = 0;
  private reaching = false;

  // armed self-defence
  readonly armed: boolean;
  defensive = false; // drawing on the player who's aiming at them
  shootCd = 0;
  private weapon?: THREE.Mesh;

  // sidewalk navigation state
  private ci = 0; private cj = 0;
  private ni = 0; private nj = 0;
  private fromI = -1; private fromJ = -1;
  private rail = new THREE.Vector3();
  private segDir = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3(1, 0, 0);
  private sideOffset: number;

  private body: Humanoid;
  private animSpeed = 0;
  private lastPos = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(index: number, _world: World, private roads: RoadNetwork) {
    this.id = "ped" + index;
    const loiterer = Math.random() < 0.25;
    this.kind = loiterer ? "sitter" : "pedestrian";
    this.stability = loiterer ? 0.8 : 0.4;
    this.sideOffset =
      CONFIG.crowd.sidewalkOffset + (Math.random() - 0.5) * CONFIG.crowd.sidewalkSpread;

    this.body = new Humanoid(randomCivilianColors());
    this.group.add(this.body.group);

    this.armed = Math.random() < CONFIG.crowd.armedChance;
    if (this.armed) {
      this.weapon = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.14, 0.46),
        new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4, metalness: 0.5 })
      );
      this.weapon.position.set(0, -0.08, 0);
      this.weapon.rotation.x = Math.PI / 2;
      this.weapon.visible = false;
      this.body.rightHand.add(this.weapon);
    }

    const start = roads.randomNode();
    this.ci = start.i; this.cj = start.j;
    roads.nodePos(this.ci, this.cj, this.rail);
    this.pickNextNode();
    this.pos.copy(this.rail).addScaledVector(this.right, this.sideOffset);
    this.lastPos.copy(this.pos);
  }

  private pickNextNode() {
    const next = this.roads.randomNeighbor(this.ci, this.cj, this.fromI, this.fromJ);
    this.ni = next.i; this.nj = next.j;
    const end = this.tmp;
    this.roads.nodePos(this.ni, this.nj, end);
    this.segDir.copy(end).sub(this.rail).setY(0);
    if (this.segDir.lengthSq() < 1e-4) this.segDir.set(0, 0, 1);
    this.segDir.normalize();
    this.right.set(this.segDir.z, 0, -this.segDir.x);
    this.heading = Math.atan2(this.segDir.x, this.segDir.z);
  }

  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    const f = CONFIG.crowd.eyeForwardOffset;
    return out.set(
      this.pos.x + Math.sin(this.heading) * f,
      CONFIG.crowd.eyeHeight,
      this.pos.z + Math.cos(this.heading) * f
    );
  }
  eyeForward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  /** Take a bullet. Returns true if this shot killed them. */
  takeDamage(dmg: number): boolean {
    if (this.dead) return false;
    this.health -= dmg;
    this.alarm = 1;
    if (this.health <= 0) {
      this.dead = true;
      this.fightTarget = null;
      return true;
    }
    return false;
  }

  startFight(other: Pedestrian, seconds: number) {
    this.fightTarget = other;
    this.fightTimer = seconds;
  }

  /** Pop into a store: hide and go inert for a few seconds. */
  goShopping(seconds: number) {
    this.shopping = true;
    this.shopTimer = seconds;
    this.group.visible = false;
  }

  update(dt: number, playerPos: THREE.Vector3, canSeePlayer: boolean) {
    if (this.shopping) {
      this.shopTimer -= dt;
      if (this.shopTimer <= 0) { this.shopping = false; this.group.visible = true; }
      return;
    }
    if (this.dead) {
      this.group.position.copy(this.pos);
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, Math.PI / 2, 0.12);
      this.body.update(dt, 0);
      return;
    }

    // contact flag is set by the collision pass on the PREVIOUS frame
    this.reaching = this.contactThisFrame;
    this.contactThisFrame = false;
    this.punchCd -= dt;
    this.aggro = Math.max(0, this.aggro - dt * 0.5); // calm down when not jostled

    if (this.alarm >= CONFIG.attention.panicThreshold) this.state = "panic";
    else if (this.alarm >= CONFIG.attention.witnessThreshold) this.state = "alert";
    else this.state = "calm";
    this.enteredPanic = this.state === "panic" && this.prevState !== "panic";
    this.prevState = this.state;

    this.body.setAlarm(THREE.MathUtils.clamp(this.alarm, 0, 1));

    // a gun threat overrides any petty brawl
    if (this.state !== "calm") { this.fightTarget = null; this.fightTimer = 0; }
    if (this.fightTarget && (this.fightTarget.dead || this.fightTimer <= 0)) {
      this.fightTarget = null;
    }

    if (this.defensive) {
      // armed civilian standing their ground, aiming back at the player
      const to = this.tmp.copy(playerPos).sub(this.pos).setY(0);
      if (to.lengthSq() > 1e-4) this.heading = Math.atan2(to.x, to.z);
      this.rail.copy(this.pos);
    } else if (this.state === "panic") {
      const away = this.tmp.copy(this.pos).sub(playerPos).setY(0);
      if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
      away.normalize();
      this.heading = Math.atan2(away.x, away.z);
      this.pos.x += away.x * CONFIG.attention.fleeSpeed * dt;
      this.pos.z += away.z * CONFIG.attention.fleeSpeed * dt;
      this.rail.copy(this.pos);
    } else if (this.state === "alert" && canSeePlayer) {
      const to = this.tmp.copy(playerPos).sub(this.pos).setY(0);
      if (to.lengthSq() > 1e-4) this.heading = Math.atan2(to.x, to.z);
    } else if (this.fightTarget) {
      this.brawl(dt);
    } else {
      this.walkPavement(dt);
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;

    const moved = this.lastPos.distanceTo(this.pos);
    this.lastPos.copy(this.pos);
    this.animSpeed += (moved / Math.max(dt, 1e-4) - this.animSpeed) * 0.4;
    this.body.setReaching(this.reaching && !this.defensive);
    this.body.setFighting(!!this.fightTarget);
    this.body.setAiming(this.defensive);
    if (this.weapon) this.weapon.visible = this.defensive;
    this.body.update(dt, this.animSpeed);
  }

  private brawl(dt: number) {
    this.fightTimer -= dt;
    const to = this.tmp.copy(this.fightTarget!.pos).sub(this.pos).setY(0);
    const d = to.length();
    if (d > 1e-3) this.heading = Math.atan2(to.x, to.z);
    // shuffle in to stay within swinging range
    if (d > 1.0) { to.normalize(); this.pos.addScaledVector(to, 0.8 * dt); }
    this.rail.copy(this.pos);
    if (this.fightTimer <= 0) { this.fightTarget = null; this.aggro = 0; }
  }

  private walkPavement(dt: number) {
    this.roads.nodePos(this.ni, this.nj, this.tmp);
    const toEnd = this.tmp.sub(this.rail).setY(0);
    const dist = toEnd.length();
    const step = CONFIG.crowd.walkSpeed * dt;

    if (dist <= Math.max(step, CONFIG.crowd.arriveRadius)) {
      this.roads.nodePos(this.ni, this.nj, this.rail);
      this.fromI = this.ci; this.fromJ = this.cj;
      this.ci = this.ni; this.cj = this.nj;
      this.pickNextNode();
    } else {
      this.rail.addScaledVector(this.segDir, step);
    }

    // steer the (free, pushable) body toward the curb target — shoves knock it
    // off and it walks back, instead of hard-snapping through other bodies
    const tx = this.rail.x + this.right.x * this.sideOffset;
    const tz = this.rail.z + this.right.z * this.sideOffset;
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dd = Math.hypot(dx, dz);
    if (dd > 1e-4) {
      const k = Math.min(1, (CONFIG.crowd.walkSpeed * dt) / dd);
      this.pos.x += dx * k;
      this.pos.z += dz * k;
    }
  }
}
