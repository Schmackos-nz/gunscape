import * as THREE from "three";
import { CONFIG } from "./config";
import { Spectator, LensKind } from "./Spectator";

const SPEED = 10;

// Camera drones. ONE is an "overwatch" drone that always trails the player at
// altitude, so there is always an eligible last-resort lens and the camera
// never has to fall back to an abstract bird's-eye view. When it's actually the
// active shot (no person/CCTV can see you) it drops in closer for a real
// framing. The rest patrol the farmland for flavour.
class Drone implements Spectator {
  readonly id: string;
  readonly kind: LensKind = "drone";
  readonly mechanical = true;
  readonly stability = 0.6;
  fieldOfViewCos = Math.cos(THREE.MathUtils.degToRad(80));

  readonly group = new THREE.Group();
  private overwatch: boolean;
  private pos = new THREE.Vector3();
  private anchor = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private roam = new THREE.Vector3();
  private angle: number;
  private rotors: THREE.Mesh[] = [];
  private tmp = new THREE.Vector3();

  constructor(index: number) {
    this.id = "drone" + index;
    this.overwatch = index === 0;
    this.angle = (index / CONFIG.drones.count) * Math.PI * 2;
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
        this.roam.set(x, CONFIG.drones.height, z);
        return;
      }
    }
    this.roam.set(half - 14, CONFIG.drones.height, half - 14);
  }

  // eye sits ahead of the body (toward the player) so the camera never frames
  // the drone's own chassis/rotors
  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pos).addScaledVector(this.fwd, 0.7);
  }
  eyeForward(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.fwd);
  }

  /** `active` = this overwatch drone is (about to be) the live shot. */
  update(dt: number, playerPos: THREE.Vector3, active: boolean) {
    if (this.overwatch) {
      // trail the player closely so it's always in range; orbit slowly
      this.anchor.lerp(playerPos, 1 - Math.pow(0.0001, dt));
      this.angle += dt * CONFIG.drones.orbitSpeed;
      const r = active ? 14 : 24; // close in for a real shot when it's the lens
      const h = active ? 9 : 16;
      const tx = this.anchor.x + Math.cos(this.angle) * r;
      const tz = this.anchor.z + Math.sin(this.angle) * r;
      this.pos.x += (tx - this.pos.x) * (1 - Math.pow(0.02, dt));
      this.pos.z += (tz - this.pos.z) * (1 - Math.pow(0.02, dt));
      this.pos.y += (h - this.pos.y) * (1 - Math.pow(0.05, dt));
    } else {
      // patrol the farmland
      if (this.pos.distanceToSquared(this.roam) < 25) this.pickRoam();
      const dir = this.tmp.copy(this.roam).sub(this.pos);
      const d = dir.length();
      if (d > 1e-3) this.pos.addScaledVector(dir.divideScalar(d), Math.min(d, SPEED * dt));
    }

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

  /** `coverNeeded` = the camera currently has no person/CCTV lens, so the
   *  overwatch drone should be the live shot (and close in). */
  update(dt: number, playerPos: THREE.Vector3, coverNeeded: boolean) {
    this.drones.forEach((d, i) => d.update(dt, playerPos, coverNeeded && i === 0));
  }
}
