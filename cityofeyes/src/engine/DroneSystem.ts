import * as THREE from "three";
import { CONFIG } from "./config";
import { Spectator, LensKind } from "./Spectator";

const SPEED = 10;

// A camera drone that PATROLS the farmland — it never trails the player into
// the city (where pedestrians and CCTV are the lenses). Only when the player is
// out in the rural ring does the drone close in and orbit, providing a genuine
// last-resort lens where there are no people or cameras.
class Drone implements Spectator {
  readonly id: string;
  readonly kind: LensKind = "drone";
  readonly mechanical = true;
  readonly stability = 0.6;
  fieldOfViewCos = Math.cos(THREE.MathUtils.degToRad(75));

  readonly group = new THREE.Group();
  private pos = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private roam = new THREE.Vector3();
  private angle: number;
  private radius: number;
  private height: number;
  private rotors: THREE.Mesh[] = [];
  private tmp = new THREE.Vector3();

  constructor(index: number) {
    this.id = "drone" + index;
    this.angle = (index / CONFIG.drones.count) * Math.PI * 2;
    this.radius = CONFIG.drones.radius * (0.85 + Math.random() * 0.4);
    this.height = CONFIG.drones.height + (Math.random() - 0.5) * 3;
    this.buildModel();
    this.pickRoam();
    this.pos.copy(this.roam);
  }

  private buildModel() {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.5, metalness: 0.4 })
    );
    this.group.add(body);
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1d24, emissive: 0xff2a2a, emissiveIntensity: 0.8 })
    );
    lens.position.set(0, -0.14, 0);
    this.group.add(lens);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x14161c });
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, transparent: true, opacity: 0.5 });
    for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.06), armMat);
      arm.position.set(ax * 0.32, 0.02, az * 0.32);
      this.group.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 10), rotorMat);
      rotor.position.set(ax * 0.32, 0.08, az * 0.32);
      this.group.add(rotor);
      this.rotors.push(rotor);
    }
  }

  private pickRoam() {
    const { townHalf, half } = CONFIG.world;
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() * 2 - 1) * (half - 10);
      const z = (Math.random() * 2 - 1) * (half - 10);
      if (Math.max(Math.abs(x), Math.abs(z)) > townHalf + 8) {
        this.roam.set(x, this.height, z);
        return;
      }
    }
    this.roam.set(half - 14, this.height, half - 14);
  }

  // eye sits just AHEAD of the drone body (toward the player) so the camera
  // never frames the drone's own chassis/rotors
  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pos).addScaledVector(this.fwd, 0.7);
  }
  eyeForward(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.fwd);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    const { townHalf } = CONFIG.world;
    const playerRural = Math.max(Math.abs(playerPos.x), Math.abs(playerPos.z)) > townHalf + 6;

    const target = this.tmp;
    if (playerRural) {
      // close in and orbit the rural player
      this.angle += dt * CONFIG.drones.orbitSpeed;
      target.set(
        playerPos.x + Math.cos(this.angle) * this.radius,
        this.height,
        playerPos.z + Math.sin(this.angle) * this.radius
      );
    } else {
      // patrol the farmland; never enter the city
      if (this.pos.distanceToSquared(this.roam) < 25) this.pickRoam();
      target.copy(this.roam);
    }

    const dir = target.sub(this.pos);
    const d = dir.length();
    if (d > 1e-3) this.pos.addScaledVector(dir.divideScalar(d), Math.min(d, SPEED * dt));

    this.fwd.copy(playerPos).sub(this.pos).normalize();
    this.group.position.copy(this.pos);
    this.group.lookAt(playerPos);
    for (const r of this.rotors) r.rotation.y += dt * 40;
  }
}

export class DroneSystem {
  readonly drones: Drone[] = [];

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < CONFIG.drones.count; i++) {
      const d = new Drone(i);
      this.drones.push(d);
      scene.add(d.group);
    }
  }

  update(dt: number, playerPos: THREE.Vector3) {
    for (const d of this.drones) d.update(dt, playerPos);
  }
}
