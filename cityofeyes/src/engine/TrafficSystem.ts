import * as THREE from "three";
import { CONFIG } from "./config";
import { RoadNetwork } from "./RoadNetwork";
import { Player } from "./Player";
import { Sfx, Engine } from "./Sfx";
import { Humanoid, randomCivilianColors } from "./Humanoid";

interface VehicleType {
  name: string;
  w: number; l: number; h: number;
  base: number; // engine base frequency
  wave: OscillatorType;
  speedMul: number;
  vol: number; // engine loudness
  bike: boolean;
}

const TYPES: VehicleType[] = [
  { name: "sedan", w: 1.8, l: 3.8, h: 0.7, base: 72, wave: "sawtooth", speedMul: 1.0, vol: 0.05, bike: false },
  { name: "truck", w: 2.3, l: 5.4, h: 1.3, base: 44, wave: "sawtooth", speedMul: 0.78, vol: 0.075, bike: false },
  { name: "sports", w: 1.85, l: 3.9, h: 0.55, base: 112, wave: "sawtooth", speedMul: 1.45, vol: 0.05, bike: false },
  { name: "bike", w: 0.5, l: 1.9, h: 0.6, base: 150, wave: "square", speedMul: 1.3, vol: 0.035, bike: true },
];

// A vehicle locked to a road line, offset to a right-hand lane, driving until it
// runs off the map then respawning. Each has a live engine voice (pitch follows
// speed, volume follows distance to the player) and panics — speeding up and
// honking — when it hears a gunshot.
class Vehicle {
  readonly group = new THREE.Group();
  private type: VehicleType;
  private axis: "x" | "z" = "z";
  private line = 0;
  private lane = 0;
  private dir = 1;
  private speed = 0;
  private baseSpeed = 0;
  private travel = 0;
  private panic = 0;
  private engine: Engine;
  taken = false; // stolen by the player

  constructor(roads: RoadNetwork, sfx: Sfx) {
    this.type = TYPES[(Math.random() * TYPES.length) | 0];
    const t = this.type;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(t.w, t.h, t.l),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.55, 0.5),
        roughness: 0.4, metalness: 0.3,
      })
    );
    body.position.y = 0.45 + t.h / 2;
    this.group.add(body);

    if (t.bike) {
      // motorbike with a civilian rider
      const rider = new Humanoid(randomCivilianColors());
      rider.group.scale.setScalar(0.92);
      rider.group.position.set(0, 0.25, -0.1);
      this.group.add(rider.group);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
      for (const z of [t.l / 2 - 0.2, -t.l / 2 + 0.2]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(0, 0.32, z);
        this.group.add(wheel);
      }
    } else {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(t.w * 0.9, t.h * 0.8, t.l * 0.45),
        new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.2, metalness: 0.4 })
      );
      cabin.position.set(0, t.h + 0.5, -0.2);
      this.group.add(cabin);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(t.w * 0.8, 0.15, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff0b0, emissiveIntensity: 1 })
      );
      lamp.position.set(0, 0.55, t.l / 2);
      this.group.add(lamp);
    }

    this.engine = sfx.createEngine(t.base, t.wave);
    this.respawn(roads, true);
  }

  private respawn(roads: RoadNetwork, anywhere: boolean) {
    const { half } = CONFIG.world;
    this.axis = Math.random() < 0.5 ? "x" : "z";
    this.line = roads.lines[(Math.random() * roads.gridN) | 0];
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.lane = -this.dir * CONFIG.traffic.laneOffset;
    this.baseSpeed =
      (CONFIG.traffic.speed + (Math.random() - 0.5) * CONFIG.traffic.speedVariance) * this.type.speedMul;
    this.travel = anywhere ? (Math.random() * 2 - 1) * half : -this.dir * half;
  }

  startle(sfx: Sfx) {
    this.panic = CONFIG.traffic.panicTime;
    if (Math.random() < 0.5) sfx.honk();
  }

  worldPos(out: THREE.Vector3): THREE.Vector3 { return out.copy(this.group.position); }
  worldHeading(): number { return this.group.rotation.y; }

  update(dt: number, roads: RoadNetwork, player: Player, playerCarActive: boolean, playerCarPos: THREE.Vector3) {
    if (this.taken) { this.group.visible = false; this.engine.set(0, 0); return; }
    const { half } = CONFIG.world;
    if (this.panic > 0) this.panic -= dt;
    this.speed = this.panic > 0 ? this.baseSpeed * 1.7 : this.baseSpeed;

    // brake rather than drive through the player's car
    const newTravel = this.travel + this.dir * this.speed * dt;
    if (playerCarActive) {
      const px = this.axis === "z" ? this.line + this.lane : newTravel;
      const pz = this.axis === "z" ? newTravel : this.line + this.lane;
      const dx = playerCarPos.x - px, dz = playerCarPos.z - pz;
      if (dx * dx + dz * dz < 4 * 4) { this.engine.set(0.7, this.type.vol * 0.3); return; } // hold position
    }
    this.travel = newTravel;
    if (this.travel > half || this.travel < -half) { this.respawn(roads, false); return; }

    if (this.axis === "z") {
      this.group.position.set(this.line + this.lane, 0, this.travel);
      this.group.rotation.y = this.dir > 0 ? 0 : Math.PI;
    } else {
      this.group.position.set(this.travel, 0, this.line + this.lane);
      this.group.rotation.y = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    // engine: pitch from speed, volume from distance to player
    const dx = this.group.position.x - player.pos.x;
    const dz = this.group.position.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    const distGain = Math.max(0, 1 - dist / 48);
    const speedNorm = this.speed / (CONFIG.traffic.speed * 1.5);
    this.engine.set(0.7 + speedNorm * 0.9, this.type.vol * distGain);

    this.checkHit(player);
  }

  private checkHit(player: Player) {
    if (player.dead) return;
    const dx = player.pos.x - this.group.position.x;
    const dz = player.pos.z - this.group.position.z;
    const c = Math.cos(-this.group.rotation.y);
    const s = Math.sin(-this.group.rotation.y);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const r = CONFIG.player.radius;
    if (Math.abs(lx) < this.type.w / 2 + r && Math.abs(lz) < this.type.l / 2 + r) {
      const dir = new THREE.Vector3(dx, 0, dz);
      player.takeHit(CONFIG.traffic.hitDamage, dir);
    }
  }
}

interface Parked {
  group: THREE.Group;
  pos: THREE.Vector3;
  heading: number;
  taken: boolean;
}

export interface StealResult {
  pos: THREE.Vector3;
  heading: number;
  moving: boolean;
}

export class TrafficSystem {
  private vehicles: Vehicle[] = [];
  private parked: Parked[] = [];
  private tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, private roads: RoadNetwork, sfx: Sfx) {
    for (let i = 0; i < CONFIG.traffic.count; i++) {
      const v = new Vehicle(roads, sfx);
      this.vehicles.push(v);
      scene.add(v.group);
    }
    for (let i = 0; i < CONFIG.traffic.parkedCount; i++) this.spawnParked(scene);
  }

  private spawnParked(scene: THREE.Scene) {
    const { half } = CONFIG.world;
    const line = this.roads.lines[(Math.random() * this.roads.gridN) | 0];
    const along = (Math.random() * 2 - 1) * (half - 12);
    const side = Math.random() < 0.5 ? 1 : -1;
    const axisZ = Math.random() < 0.5; // road runs along Z?
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.7, 3.9),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.4, 0.45), roughness: 0.5, metalness: 0.3 })
    );
    body.position.y = 0.55;
    group.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.2, metalness: 0.4 })
    );
    cabin.position.set(0, 1.05, -0.2);
    group.add(cabin);

    const off = side * CONFIG.traffic.parkOffset;
    const pos = axisZ ? new THREE.Vector3(line + off, 0, along) : new THREE.Vector3(along, 0, line + off);
    const heading = axisZ ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    group.position.copy(pos);
    group.rotation.y = heading;
    scene.add(group);
    this.parked.push({ group, pos, heading, taken: false });
  }

  onGunshot(sfx: Sfx) {
    for (const v of this.vehicles) v.startle(sfx);
  }

  /** Nearest stealable car within range (parked or moving), or null. */
  private nearest(playerPos: THREE.Vector3): Parked | Vehicle | null {
    const r2 = CONFIG.driving.stealRange ** 2;
    let best: Parked | Vehicle | null = null;
    let bestD = r2;
    for (const p of this.parked) {
      if (p.taken) continue;
      const d = p.pos.distanceToSquared(playerPos);
      if (d < bestD) { bestD = d; best = p; }
    }
    for (const v of this.vehicles) {
      if (v.taken) continue;
      const d = v.worldPos(this.tmp).distanceToSquared(playerPos);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  nearStealable(playerPos: THREE.Vector3): boolean {
    return this.nearest(playerPos) !== null;
  }

  /** Centres of every solid car (moving + parked, not stolen) for the player
   *  car's collision checks. */
  carCenters(): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (const v of this.vehicles) if (!v.taken) out.push(v.worldPos(new THREE.Vector3()));
    for (const p of this.parked) if (!p.taken) out.push(p.pos);
    return out;
  }

  /** Take the nearest car; returns where/how to start driving it. */
  steal(playerPos: THREE.Vector3): StealResult | null {
    const pick = this.nearest(playerPos);
    if (!pick) return null;
    pick.taken = true;
    pick.group.visible = false;
    if (pick instanceof Vehicle) {
      return { pos: pick.worldPos(new THREE.Vector3()), heading: pick.worldHeading(), moving: true };
    }
    return { pos: pick.pos.clone(), heading: pick.heading, moving: false };
  }

  update(dt: number, player: Player, playerCarActive: boolean, playerCarPos: THREE.Vector3) {
    for (const v of this.vehicles) v.update(dt, this.roads, player, playerCarActive, playerCarPos);
  }
}
