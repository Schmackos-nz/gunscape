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

  update(dt: number, roads: RoadNetwork, player: Player) {
    const { half } = CONFIG.world;
    if (this.panic > 0) this.panic -= dt;
    this.speed = this.panic > 0 ? this.baseSpeed * 1.7 : this.baseSpeed;

    this.travel += this.dir * this.speed * dt;
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

export class TrafficSystem {
  private vehicles: Vehicle[] = [];

  constructor(scene: THREE.Scene, private roads: RoadNetwork, sfx: Sfx) {
    for (let i = 0; i < CONFIG.traffic.count; i++) {
      const v = new Vehicle(roads, sfx);
      this.vehicles.push(v);
      scene.add(v.group);
    }
  }

  /** Civilian vehicles freak out when a gun goes off. */
  onGunshot(sfx: Sfx) {
    for (const v of this.vehicles) v.startle(sfx);
  }

  update(dt: number, player: Player) {
    for (const v of this.vehicles) v.update(dt, this.roads, player);
  }
}
