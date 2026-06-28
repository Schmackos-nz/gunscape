import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { Humanoid, randomCivilianColors } from "./Humanoid";
import { ITEMS } from "./Inventory";
import { clearLineOfSight } from "./los";

interface Crop {
  mesh: THREE.Mesh;
  foodId: string;
  taken: boolean;
}

const CROP_FOODS = ["carrot", "cabbage", "corn"];

// A wandering farmer who tends the fields. If one sees the player steal a crop,
// they report it (handled by the caller via the harvest result).
class Farmer {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  private heading = 0;
  private body: Humanoid;
  private target = new THREE.Vector3();
  private animSpeed = 0;
  private last = new THREE.Vector3();

  constructor(spawn: THREE.Vector3) {
    this.body = new Humanoid({
      skin: 0xd9a878, hair: 0x6b4a25, shirt: 0x3f6d8a, pants: 0x4a3b27, shoes: 0x2a1d12,
    });
    this.group.add(this.body.group);
    this.pos.copy(spawn);
    this.target.copy(spawn);
    this.group.position.copy(this.pos);
    this.last.copy(this.pos);
  }

  eye(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pos.x, 1.6, this.pos.z);
  }

  update(dt: number, rngPoint: (out: THREE.Vector3) => void) {
    const to = this.target.clone().sub(this.pos).setY(0);
    if (to.length() < 1.5) {
      rngPoint(this.target);
    } else {
      to.normalize();
      this.heading = Math.atan2(to.x, to.z);
      this.pos.addScaledVector(to, 1.3 * dt);
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    const moved = this.last.distanceTo(this.pos);
    this.last.copy(this.pos);
    this.animSpeed += (moved / Math.max(dt, 1e-4) - this.animSpeed) * 0.4;
    this.body.update(dt, this.animSpeed);
  }
}

export class FarmSystem {
  private crops: Crop[] = [];
  private farmers: Farmer[] = [];

  constructor(scene: THREE.Scene, private world: World) {
    for (let i = 0; i < CONFIG.farm.plots; i++) this.placePlot(scene);
    for (let i = 0; i < CONFIG.farm.farmers; i++) {
      const f = new Farmer(this.ruralPoint(new THREE.Vector3()));
      this.farmers.push(f);
      scene.add(f.group);
    }
  }

  /** A random point in the farmland ring (beyond the town) that clears the
   *  roads, so plots/crops land on grass and never on the tarmac. */
  private ruralPoint(out: THREE.Vector3): THREE.Vector3 {
    const { townHalf, half, roadWidth } = CONFIG.world;
    const lines = this.world.roads.lines;
    const margin = roadWidth / 2 + 7; // keep a 12-wide plot fully off any road
    const nearRoad = (v: number) => lines.some((l) => Math.abs(v - l) < margin);
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() * 2 - 1) * (half - 10);
      const z = (Math.random() * 2 - 1) * (half - 10);
      if (Math.max(Math.abs(x), Math.abs(z)) <= townHalf + 10) continue;
      if (nearRoad(x) || nearRoad(z)) continue;
      return out.set(x, 0, z);
    }
    return out.set(half - 14, 0, half - 14);
  }

  private placePlot(scene: THREE.Scene) {
    const c = this.ruralPoint(new THREE.Vector3());
    const size = 12;
    const soil = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x5a4326, roughness: 1 })
    );
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(c.x, 0.03, c.z);
    scene.add(soil);

    const foodId = CROP_FOODS[(Math.random() * CROP_FOODS.length) | 0];
    const color = ITEMS[foodId].color;
    const per = CONFIG.farm.cropsPerPlot;
    const cols = Math.ceil(Math.sqrt(per));
    for (let i = 0; i < per; i++) {
      const gx = (i % cols) / (cols - 1) - 0.5;
      const gz = (Math.floor(i / cols) % cols) / (cols - 1) - 0.5;
      const x = c.x + gx * (size - 2);
      const z = c.z + gz * (size - 2);
      const mesh = this.cropMesh(foodId, color);
      mesh.position.set(x, 0.3, z);
      scene.add(mesh);
      this.crops.push({ mesh, foodId, taken: false });
    }
  }

  private cropMesh(foodId: string, color: number): THREE.Mesh {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    let geo: THREE.BufferGeometry;
    if (foodId === "carrot") geo = new THREE.ConeGeometry(0.18, 0.5, 6);
    else if (foodId === "corn") geo = new THREE.CylinderGeometry(0.12, 0.14, 0.7, 6);
    else geo = new THREE.SphereGeometry(0.26, 8, 6);
    return new THREE.Mesh(geo, mat);
  }

  update(dt: number) {
    const rng = (out: THREE.Vector3) => this.ruralPoint(out);
    for (const f of this.farmers) f.update(dt, rng);
  }

  /** Is there a harvestable crop within reach (for the interact prompt)? */
  cropInRange(playerPos: THREE.Vector3): boolean {
    const r2 = CONFIG.farm.interactRange ** 2;
    for (const c of this.crops) {
      if (c.taken) continue;
      const dx = c.mesh.position.x - playerPos.x;
      const dz = c.mesh.position.z - playerPos.z;
      if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  }

  /** Harvest the nearest crop in range. Returns the food taken + whether a
   *  farmer saw it (so the caller can raise the wanted level). */
  tryHarvest(playerPos: THREE.Vector3): { foodId: string; seen: boolean } | null {
    const r = CONFIG.farm.interactRange;
    let best: Crop | null = null;
    let bestD = r * r;
    for (const crop of this.crops) {
      if (crop.taken) continue;
      const dx = crop.mesh.position.x - playerPos.x;
      const dz = crop.mesh.position.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = crop; }
    }
    if (!best) return null;

    best.taken = true;
    best.mesh.visible = false;

    // did any farmer witness the theft?
    let seen = false;
    const eye = new THREE.Vector3();
    const chest = new THREE.Vector3(playerPos.x, 1.0, playerPos.z);
    for (const f of this.farmers) {
      if (f.pos.distanceToSquared(playerPos) > CONFIG.farm.witnessRange ** 2) continue;
      if (clearLineOfSight(f.eye(eye), chest, this.world.occluders)) { seen = true; break; }
    }
    return { foodId: best.foodId, seen };
  }
}
