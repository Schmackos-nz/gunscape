import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { Input } from "./Input";
import { addWheels } from "./TrafficSystem";

// The car the player drives after stealing one. Free 2D movement (accelerate /
// brake-reverse / steer), blocked by buildings. While active the player avatar
// is hidden and the spectator camera frames this car.
export class PlayerCar {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  heading = 0;
  speed = 0;
  active = false;

  constructor(private world: World) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.7, 3.9),
      new THREE.MeshStandardMaterial({ color: 0xe5484d, roughness: 0.4, metalness: 0.3 })
    );
    body.position.y = 0.55;
    this.group.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.2, metalness: 0.4 })
    );
    cabin.position.set(0, 1.05, -0.2);
    this.group.add(cabin);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.15, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff0b0, emissiveIntensity: 1 })
    );
    lamp.position.set(0, 0.55, 1.98);
    this.group.add(lamp);
    addWheels(this.group, 1.9, 3.9);

    this.group.visible = false;
    world.scene.add(this.group);
  }

  enter(pos: THREE.Vector3, heading: number) {
    this.pos.set(pos.x, 0, pos.z);
    this.heading = heading;
    this.speed = 0;
    this.active = true;
    this.group.visible = true;
    this.sync();
  }

  /** A spot to step out onto, beside the car (clear of buildings). */
  exitPos(out: THREE.Vector3): THREE.Vector3 {
    const lx = Math.cos(this.heading), lz = -Math.sin(this.heading); // left of the car
    for (const s of [1, -1, 0]) {
      const x = this.pos.x + lx * 2.4 * s;
      const z = this.pos.z + lz * 2.4 * s;
      if (s === 0 || !this.world.isInsideBuilding(x, z, 0.5)) return out.set(x, 0, z);
    }
    return out.copy(this.pos);
  }

  update(dt: number, input: Input, obstacles: THREE.Vector3[] = []) {
    if (!this.active) return;
    const d = CONFIG.driving;

    if (input.isDown("w")) this.speed += d.accel * dt;
    else if (input.isDown("s")) this.speed -= d.brake * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), d.friction * dt);
    this.speed = THREE.MathUtils.clamp(this.speed, -d.reverseSpeed, d.maxSpeed);

    let steer = 0;
    if (input.isDown("a")) steer += 1;
    if (input.isDown("d")) steer -= 1;
    const grip = Math.min(Math.abs(this.speed) / 5, 1) * (this.speed >= 0 ? 1 : -1);
    this.heading += steer * d.turn * dt * grip;

    const fx = Math.sin(this.heading) * this.speed * dt;
    const fz = Math.cos(this.heading) * this.speed * dt;
    if (!this.world.isInsideBuilding(this.pos.x + fx, this.pos.z, 1.0)) this.pos.x += fx;
    else this.speed *= 0.3;
    if (!this.world.isInsideBuilding(this.pos.x, this.pos.z + fz, 1.0)) this.pos.z += fz;
    else this.speed *= 0.3;

    // collide with other cars: push out of any overlap and crunch the speed
    const minD = 3.0;
    for (const o of obstacles) {
      const ox = this.pos.x - o.x, oz = this.pos.z - o.z;
      const d2 = ox * ox + oz * oz;
      if (d2 < minD * minD && d2 > 1e-4) {
        const dist = Math.sqrt(d2);
        const push = minD - dist;
        this.pos.x += (ox / dist) * push;
        this.pos.z += (oz / dist) * push;
        this.speed *= 0.25;
      }
    }

    const half = CONFIG.world.half - 2;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -half, half);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -half, half);
    this.sync();
  }

  private sync() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }
}
