import * as THREE from "three";
import { CONFIG } from "./config";

// Derives a road grid from the same block layout the World uses. Roads run
// along the gaps between building rows/columns. Both cars and pedestrians
// travel these lines — cars near the centre (lanes), pedestrians offset out to
// the curb (sidewalks). Intersections form a node grid that pedestrians path
// across, so civilians stay on the pavement instead of wandering through walls.
export class RoadNetwork {
  /** X coordinates of vertical roads (which run along Z), and vice-versa. */
  readonly lines: number[] = [];

  constructor() {
    const { half, blockSize, streetWidth } = CONFIG.world;
    const stride = blockSize + streetWidth;
    const centers: number[] = [];
    for (let c = -half + stride / 2; c < half; c += stride) centers.push(c);
    // a road sits halfway between each pair of adjacent block centres
    for (let i = 0; i < centers.length - 1; i++) {
      this.lines.push((centers[i] + centers[i + 1]) / 2);
    }
  }

  get gridN(): number {
    return this.lines.length;
  }

  nodePos(i: number, j: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.lines[i], 0, this.lines[j]);
  }

  randomNode(): { i: number; j: number } {
    const n = this.gridN;
    return { i: (Math.random() * n) | 0, j: (Math.random() * n) | 0 };
  }

  /** Pick a neighbouring intersection, preferring not to double back. */
  randomNeighbor(i: number, j: number, fromI: number, fromJ: number): { i: number; j: number } {
    const n = this.gridN;
    const opts: { i: number; j: number }[] = [];
    if (i > 0) opts.push({ i: i - 1, j });
    if (i < n - 1) opts.push({ i: i + 1, j });
    if (j > 0) opts.push({ i, j: j - 1 });
    if (j < n - 1) opts.push({ i, j: j + 1 });
    const forward = opts.filter((o) => !(o.i === fromI && o.j === fromJ));
    const pool = forward.length ? forward : opts;
    return pool[(Math.random() * pool.length) | 0];
  }

  /** Build the visible sidewalks, asphalt + lane markings into the scene. */
  buildMeshes(scene: THREE.Scene) {
    const { half, roadWidth } = CONFIG.world;
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 1 });
    const curb = new THREE.MeshStandardMaterial({ color: 0x4a5364, roughness: 1 });
    const len = half * 2;
    const pave = roadWidth + 5.5; // sidewalk strip width (slightly wider than road)

    for (const v of this.lines) {
      // pale sidewalk strip first (sits under/around the darker carriageway)
      const sV = new THREE.Mesh(new THREE.BoxGeometry(pave, 0.05, len), curb);
      sV.position.set(v, 0.025, 0);
      scene.add(sV);
      const sH = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, pave), curb);
      sH.position.set(0, 0.025, v);
      scene.add(sH);

      // vertical road (runs along Z)
      const r = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.04, len), asphalt);
      r.position.set(v, 0.06, 0);
      scene.add(r);
      // horizontal road (runs along X)
      const h = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, roadWidth), asphalt);
      h.position.set(0, 0.06, v);
      scene.add(h);
    }

    // dashed centre lines
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xe8c45a, emissive: 0x4a3a10, emissiveIntensity: 0.4,
    });
    const dash = (x: number, z: number, alongZ: boolean) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(alongZ ? 0.3 : 2.4, 0.05, alongZ ? 2.4 : 0.3),
        lineMat
      );
      m.position.set(x, 0.09, z);
      scene.add(m);
    };
    for (const v of this.lines) {
      for (let p = -half; p < half; p += 8) {
        dash(v, p, true);
        dash(p, v, false);
      }
    }
  }
}
