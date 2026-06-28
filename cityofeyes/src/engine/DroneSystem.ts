import * as THREE from "three";
import { CONFIG } from "./config";
import { Spectator, LensKind } from "./Spectator";

// A small camera drone that trails the player and orbits, holding a close,
// always-available aerial lens. Several of these mean the camera can fall back
// to a nearby drone instead of an abstract bird's-eye vantage — vital out in
// the rural areas where there are no pedestrians or CCTV.
class Drone implements Spectator {
  readonly id: string;
  readonly kind: LensKind = "drone";
  readonly mechanical = true;
  readonly stability = 0.6;
  fieldOfViewCos = Math.cos(THREE.MathUtils.degToRad(70));

  readonly group = new THREE.Group();
  private pos = new THREE.Vector3();
  private follow = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private angle: number;
  private radius: number;
  private height: number;
  private rotors: THREE.Mesh[] = [];

  constructor(index: number) {
    this.id = "drone" + index;
    this.angle = (index / CONFIG.drones.count) * Math.PI * 2;
    this.radius = CONFIG.drones.radius * (0.85 + Math.random() * 0.4);
    this.height = CONFIG.drones.height + (Math.random() - 0.5) * 3;
    this.buildModel();
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
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), armMat);
      arm.position.set(ax * 0.32, 0.02, az * 0.32);
      arm.scale.x = arm.scale.z = 6;
      this.group.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 10), rotorMat);
      rotor.position.set(ax * 0.32, 0.08, az * 0.32);
      this.group.add(rotor);
      this.rotors.push(rotor);
    }
  }

  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pos);
  }
  eyeForward(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.fwd);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    // trail the player, orbiting slowly
    this.follow.lerp(playerPos, 1 - Math.pow(0.2, dt));
    this.angle += dt * CONFIG.drones.orbitSpeed;
    this.pos.set(
      this.follow.x + Math.cos(this.angle) * this.radius,
      this.height + Math.sin(this.angle * 1.7) * 0.6,
      this.follow.z + Math.sin(this.angle) * this.radius
    );
    // always keep the player framed
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
