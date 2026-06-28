import * as THREE from "three";
import { World } from "./World";
import { CrowdSystem } from "./CrowdSystem";
import { Pedestrian } from "./Pedestrian";
import { PoliceSystem } from "./PoliceSystem";

const SPEED = 90;
const LIFE = 1.3;
const HIT_RADIUS = 0.6;

interface Bullet {
  mesh: THREE.Mesh;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
}

export interface ProjectileHooks {
  damage: number;
  onPedHit: (ped: Pedestrian, died: boolean) => void;
  onOfficerHit: (died: boolean) => void;
}

// Bullets fired by the player. They travel along the aim direction, hit the
// first body they pass through (swept point-vs-segment test so they don't
// tunnel at speed), deal damage, and stop on buildings.
export class ProjectileSystem {
  private bullets: Bullet[] = [];
  private geo = new THREE.SphereGeometry(0.07, 6, 5);
  private mat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  private hitPoint = new THREE.Vector3();

  constructor(
    private world: World,
    private crowd: CrowdSystem,
    private police: PoliceSystem,
    private hooks: ProjectileHooks
  ) {}

  spawn(pos: THREE.Vector3, dir: THREE.Vector3) {
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.position.copy(pos);
    mesh.scale.set(1, 1, 3.5);
    this.world.scene.add(mesh);
    this.bullets.push({
      mesh, prev: pos.clone(),
      vel: dir.clone().normalize().multiplyScalar(SPEED), life: LIFE,
    });
  }

  update(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.prev.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;

      let remove = b.life <= 0;
      if (!remove && this.world.isInsideBuilding(b.mesh.position.x, b.mesh.position.z, 0)) {
        remove = true;
      }
      if (!remove) {
        const ped = this.firstPedHit(b);
        if (ped) {
          this.hooks.onPedHit(ped, ped.takeDamage(this.hooks.damage));
          remove = true;
        } else {
          const off = this.police.officerAt(b.prev, b.mesh.position, HIT_RADIUS);
          if (off) {
            this.hooks.onOfficerHit(off.takeDamage(this.hooks.damage));
            remove = true;
          }
        }
      }

      if (remove) {
        this.world.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
  }

  private firstPedHit(b: Bullet): Pedestrian | null {
    let best: Pedestrian | null = null;
    let bestT = Infinity;
    for (const p of this.crowd.peds) {
      if (p.dead || p.shopping) continue;
      this.hitPoint.set(p.pos.x, 1.0, p.pos.z);
      const t = distToSegmentSq(this.hitPoint, b.prev, b.mesh.position);
      if (t < HIT_RADIUS * HIT_RADIUS && t < bestT) { bestT = t; best = p; }
    }
    return best;
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
