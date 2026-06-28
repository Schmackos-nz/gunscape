import * as THREE from "three";
import { CONFIG } from "./config";
import { RoadNetwork } from "./RoadNetwork";

// Greybox city: a ground plane, a grid of block buildings separated by streets,
// and a set of fixed CCTV mounts. The building meshes double as the occluders
// the SpectatorSystem raycasts against for line-of-sight.
export class World {
  readonly scene = new THREE.Scene();
  readonly occluders: THREE.Mesh[] = [];
  /** Footprints used to keep agents out of buildings (xz min/max). */
  readonly footprints: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  readonly cctvMounts: { pos: THREE.Vector3; forward: THREE.Vector3 }[] = [];
  readonly shopDoors: { pos: THREE.Vector3; forward: THREE.Vector3 }[] = [];
  readonly roads = new RoadNetwork();

  constructor() {
    const s = this.scene;
    const horizon = 0xcfe3f2;
    s.background = new THREE.Color(horizon);
    s.fog = new THREE.Fog(horizon, 150, 360);

    // daytime gradient sky dome
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.world.half * 1.6, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x3f86d6) },
          bottomColor: { value: new THREE.Color(horizon) },
          exponent: { value: 0.7 },
        },
        vertexShader:
          "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 topColor; uniform vec3 bottomColor; uniform float exponent; varying vec3 vP;" +
          "void main(){ float h = normalize(vP).y; float t = pow(max(h,0.0), exponent); gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0); }",
      })
    );
    s.add(sky);

    // bright daytime lighting
    const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x6e6b50, 1.1);
    s.add(hemi);
    s.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sun.position.set(60, 110, 40);
    s.add(sun);

    // rural ground (grass) across the whole map...
    const half = CONFIG.world.half;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2, half * 2),
      new THREE.MeshStandardMaterial({ color: 0x40592f, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    s.add(ground);

    // ...with a paved floor over the central town
    const tHalf = CONFIG.world.townHalf + 14;
    const town = new THREE.Mesh(
      new THREE.PlaneGeometry(tHalf * 2, tHalf * 2),
      new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 1 })
    );
    town.rotation.x = -Math.PI / 2;
    town.position.y = 0.01;
    s.add(town);

    this.roads.buildMeshes(s);
    this.buildBlocks();
    this.placeShops();
    this.placeCCTV();
  }

  private buildBlocks() {
    const { half, townHalf, blockSize, streetWidth } = CONFIG.world;
    const stride = blockSize + streetWidth;

    for (let cx = -half + stride / 2; cx < half; cx += stride) {
      for (let cz = -half + stride / 2; cz < half; cz += stride) {
        // buildings only in the town, and never on the central plaza
        if (Math.max(Math.abs(cx), Math.abs(cz)) > townHalf) continue;
        if (Math.abs(cx) < stride && Math.abs(cz) < stride) continue;

        const h = 12 + Math.random() * 34;
        const w = blockSize * (0.7 + Math.random() * 0.3);
        const d = blockSize * (0.7 + Math.random() * 0.3);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeFacadeMaterial(w, h, d));
        b.position.set(cx, h / 2, cz);
        this.scene.add(b);
        this.occluders.push(b);
        this.footprints.push({
          minX: cx - w / 2, maxX: cx + w / 2,
          minZ: cz - d / 2, maxZ: cz + d / 2,
        });
      }
    }
  }

  private placeShops() {
    const ordered = [...this.footprints].sort((a, b) => centerDistSq(a) - centerDistSq(b));
    for (let i = 0; i < Math.min(CONFIG.world.shopCount, ordered.length); i++) {
      const fp = ordered[i];
      const cx = (fp.minX + fp.maxX) / 2;
      const cz = (fp.minZ + fp.maxZ) / 2;
      const px = THREE.MathUtils.clamp(0, fp.minX, fp.maxX);
      const pz = THREE.MathUtils.clamp(0, fp.minZ, fp.maxZ);
      const out = new THREE.Vector3(px - cx, 0, pz - cz);
      if (out.lengthSq() < 1e-4) out.set(1, 0, 0);
      out.normalize();
      const pos = new THREE.Vector3(px + out.x * 1.8, 0, pz + out.z * 1.8);
      this.shopDoors.push({ pos, forward: out });
    }
  }

  private placeCCTV() {
    // Mount cameras on the building wall nearest the plaza, sticking out on a
    // bracket so they're clearly visible AND have a clean sightline inward.
    // Sort buildings by closeness to the plaza so the densest coverage is
    // exactly where the player spends time.
    const ordered = [...this.footprints].sort((a, b) => centerDistSq(a) - centerDistSq(b));

    for (const fp of ordered) {
      const cx = (fp.minX + fp.maxX) / 2;
      const cz = (fp.minZ + fp.maxZ) / 2;

      // pick the wall facing the plaza: clamp origin onto the footprint edge
      const px = THREE.MathUtils.clamp(0, fp.minX, fp.maxX);
      const pz = THREE.MathUtils.clamp(0, fp.minZ, fp.maxZ);
      // push the mount out from that wall, toward the plaza, on a bracket
      const outward = new THREE.Vector3(px - cx, 0, pz - cz);
      if (outward.lengthSq() < 1e-4) outward.set(1, 0, 0);
      outward.normalize();
      const wallX = px + outward.x * 0.4;
      const wallZ = pz + outward.z * 0.4;
      const housing = new THREE.Vector3(wallX + outward.x * 1.0, 7, wallZ + outward.z * 1.0);

      // aim toward the plaza centre, angled slightly down
      const forward = new THREE.Vector3(-housing.x, -3, -housing.z).normalize();
      // the EYE sits just ahead of the lens, so the camera never frames its own
      // housing/lens (which previously filled the view with a red circle)
      const eye = housing.clone().addScaledVector(forward, 0.6);
      this.cctvMounts.push({ pos: eye, forward });
      this.addCctvModel(housing, new THREE.Vector3(wallX, 7, wallZ), forward);
    }
  }

  private addCctvModel(pos: THREE.Vector3, wall: THREE.Vector3, forward: THREE.Vector3) {
    const g = new THREE.Group();

    // bracket arm from the wall out to the housing
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, pos.distanceTo(wall), 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2f38 })
    );
    arm.position.copy(wall).lerp(pos, 0.5);
    arm.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      pos.clone().sub(wall).normalize()
    );
    g.add(arm);

    // housing
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5 })
    );
    housing.position.copy(pos);
    housing.lookAt(pos.clone().add(forward));
    g.add(housing);

    // small recessed lens with a subtle red glow so cameras read at a glance
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xcc2020, emissive: 0xff0000, emissiveIntensity: 0.7 })
    );
    lens.position.copy(pos).add(forward.clone().multiplyScalar(0.22));
    g.add(lens);

    this.scene.add(g);
  }

  /** True if (x,z) is inside any building footprint (with optional padding). */
  isInsideBuilding(x: number, z: number, pad = 0): boolean {
    for (const f of this.footprints) {
      if (x > f.minX - pad && x < f.maxX + pad && z > f.minZ - pad && z < f.maxZ + pad)
        return true;
    }
    return false;
  }

  /** Random walkable point on the street grid. */
  randomWalkablePoint(out: THREE.Vector3): THREE.Vector3 {
    const half = CONFIG.world.half - 4;
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() * 2 - 1) * half;
      const z = (Math.random() * 2 - 1) * half;
      if (!this.isInsideBuilding(x, z, 1.5)) return out.set(x, 0, z);
    }
    return out.set(0, 0, 0);
  }
}

function centerDistSq(f: { minX: number; maxX: number; minZ: number; maxZ: number }): number {
  const cx = (f.minX + f.maxX) / 2;
  const cz = (f.minZ + f.maxZ) / 2;
  return cx * cx + cz * cz;
}

// A procedural window grid baked into a small canvas. Lit windows glow via the
// emissive map. One texture per building (cheap) gives each its own pattern.
function makeWindowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const facade = ["#39455a", "#3f4a5e", "#4a4540", "#34506a"][(Math.random() * 4) | 0];
  x.fillStyle = facade;
  x.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      x.fillStyle = Math.random() < 0.55 ? "#ffd98a" : "#0e131c";
      x.fillRect(6 + col * 14, 6 + row * 14, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeFacadeMaterial(w: number, h: number, d: number): THREE.MeshStandardMaterial {
  const tex = makeWindowTexture();
  tex.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 5)));
  // a separate clone for the wider faces keeps windows roughly square
  return new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.4,
    roughness: 0.9,
  });
}
