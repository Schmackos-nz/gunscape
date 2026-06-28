import * as THREE from "three";

// A reusable low-poly humanoid: head with a simple face + hair, torso, two
// articulated arms (upper/lower/hand) and legs (upper/lower/foot). It animates a
// walk cycle scaled by movement speed, and exposes a right-hand anchor so the
// player can hold a weapon. Geometry is shared across every instance (built
// once below); only materials are per-character, which keeps a 70-strong crowd
// affordable.

export interface HumanoidColors {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  shoes: number;
}

// ── shared geometry (created once) ───────────────────────────────────────────
const G = {
  head: new THREE.SphereGeometry(0.23, 14, 12),
  torso: new THREE.CylinderGeometry(0.2, 0.27, 0.62, 12),
  pelvis: new THREE.CylinderGeometry(0.27, 0.24, 0.18, 12),
  neck: new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8),
  // hair primitives (shared)
  cap: new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
  capBuzz: new THREE.SphereGeometry(0.238, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
  bun: new THREE.SphereGeometry(0.1, 10, 8),
  spike: new THREE.ConeGeometry(0.05, 0.15, 5),
  tail: new THREE.CapsuleGeometry(0.055, 0.3, 4, 8),
  upperArm: new THREE.CylinderGeometry(0.058, 0.05, 0.3, 6),
  lowerArm: new THREE.CylinderGeometry(0.05, 0.044, 0.28, 6),
  hand: new THREE.SphereGeometry(0.062, 8, 6),
  upperLeg: new THREE.CylinderGeometry(0.095, 0.078, 0.44, 6),
  lowerLeg: new THREE.CylinderGeometry(0.072, 0.055, 0.42, 6),
  foot: new THREE.BoxGeometry(0.13, 0.09, 0.27),
  eyeWhite: new THREE.SphereGeometry(0.037, 8, 6),
  pupil: new THREE.SphereGeometry(0.019, 6, 5),
  nose: new THREE.ConeGeometry(0.03, 0.07, 6),
  brow: new THREE.BoxGeometry(0.09, 0.015, 0.02),
  mouth: new THREE.BoxGeometry(0.09, 0.018, 0.02),
};

const EYE_WHITE = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5 });
const PUPIL = new THREE.MeshStandardMaterial({ color: 0x1a1d24 });

const HIP_Y = 0.86;
const SHOULDER_Y = 1.4;

export class Humanoid {
  readonly group = new THREE.Group();
  readonly rightHand = new THREE.Group(); // anchor for held items

  private legL: THREE.Group; private legR: THREE.Group;
  private kneeL: THREE.Group; private kneeR: THREE.Group;
  private armL: THREE.Group; private armR: THREE.Group;
  private elbowR: THREE.Group;
  private shirtMat: THREE.MeshStandardMaterial;
  private root = new THREE.Group(); // whole skeleton, bobbed vertically
  private phase = Math.random() * Math.PI * 2;
  private aiming = false;
  private reaching = false; // hands out, shoving
  private fighting = false; // throwing punches
  private fightClock = Math.random() * 10;

  constructor(colors: HumanoidColors) {
    const skin = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.7 });
    const hair = new THREE.MeshStandardMaterial({ color: colors.hair, roughness: 0.85 });
    this.shirtMat = new THREE.MeshStandardMaterial({ color: colors.shirt, roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: colors.pants, roughness: 0.85 });
    const shoes = new THREE.MeshStandardMaterial({ color: colors.shoes, roughness: 0.6 });

    this.group.add(this.root);

    // torso + pelvis
    const torso = new THREE.Mesh(G.torso, this.shirtMat);
    torso.position.y = HIP_Y + 0.31;
    this.root.add(torso);
    const pelvis = new THREE.Mesh(G.pelvis, pants);
    pelvis.position.y = HIP_Y + 0.02;
    this.root.add(pelvis);
    const neck = new THREE.Mesh(G.neck, skin);
    neck.position.y = HIP_Y + 0.66;
    this.root.add(neck);

    // head + face + hair
    const headY = HIP_Y + 0.78;
    const head = new THREE.Mesh(G.head, skin);
    head.position.y = headY;
    head.scale.set(0.95, 1.08, 1);
    this.root.add(head);
    this.buildFace(head, skin, hair);

    // arms
    this.armL = this.buildArm(-1, skin, this.shirtMat);
    this.armR = this.buildArm(1, skin, this.shirtMat);
    this.elbowR = this.armR.children[1] as THREE.Group;
    this.root.add(this.armL, this.armR);

    // legs
    const legs = this.buildLegs(pants, shoes);
    this.legL = legs.legL; this.legR = legs.legR;
    this.kneeL = legs.kneeL; this.kneeR = legs.kneeR;
    this.root.add(this.legL, this.legR);

    // slight size variety so a crowd doesn't look cloned
    const s = 0.92 + Math.random() * 0.14;
    this.group.scale.setScalar(s);
  }

  private buildFace(head: THREE.Mesh, skin: THREE.Material, hairMat: THREE.Material) {
    const headY = head.position.y;
    const z = 0.2;
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(G.eyeWhite, EYE_WHITE);
      eye.position.set(sx * 0.08, headY + 0.03, z);
      this.root.add(eye);
      const pup = new THREE.Mesh(G.pupil, PUPIL);
      pup.position.set(sx * 0.08, headY + 0.03, z + 0.03);
      this.root.add(pup);
      const brow = new THREE.Mesh(G.brow, hairMat);
      brow.position.set(sx * 0.08, headY + 0.1, z + 0.01);
      this.root.add(brow);
    }
    const nose = new THREE.Mesh(G.nose, skin);
    nose.position.set(0, headY - 0.01, z + 0.03);
    nose.rotation.x = Math.PI / 2;
    this.root.add(nose);
    const mouth = new THREE.Mesh(G.mouth, new THREE.MeshStandardMaterial({ color: 0x8a4a44 }));
    mouth.position.set(0, headY - 0.11, z);
    this.root.add(mouth);

    this.root.add(buildHair(headY, hairMat));
  }

  private buildArm(side: number, skin: THREE.Material, sleeve: THREE.Material): THREE.Group {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, SHOULDER_Y, 0);
    shoulder.rotation.z = -side * 0.09; // rest slightly away from torso

    const upper = new THREE.Mesh(G.upperArm, sleeve);
    upper.position.y = -0.15;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    elbow.rotation.x = 0.12; // slight bend at rest
    shoulder.add(elbow);

    const lower = new THREE.Mesh(G.lowerArm, skin);
    lower.position.y = -0.14;
    elbow.add(lower);

    const hand = new THREE.Mesh(G.hand, skin);
    hand.position.y = -0.28;
    elbow.add(hand);

    if (side > 0) {
      this.rightHand.position.set(0, -0.3, 0.05);
      elbow.add(this.rightHand);
    }
    return shoulder;
  }

  private buildLegs(pants: THREE.Material, shoes: THREE.Material) {
    const make = (side: number) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, HIP_Y, 0);
      const upper = new THREE.Mesh(G.upperLeg, pants);
      upper.position.y = -0.22;
      hip.add(upper);

      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      const lower = new THREE.Mesh(G.lowerLeg, pants);
      lower.position.y = -0.21;
      knee.add(lower);
      const foot = new THREE.Mesh(G.foot, shoes);
      foot.position.set(0, -0.42, 0.06);
      knee.add(foot);
      return { hip, knee };
    };
    const l = make(-1);
    const r = make(1);
    return { legL: l.hip, legR: r.hip, kneeL: l.knee, kneeR: r.knee };
  }

  /** Aiming raises the right arm forward and holds it (for brandishing). */
  setAiming(on: boolean) {
    this.aiming = on;
  }

  /** Hands out, shoving a neighbour. */
  setReaching(on: boolean) {
    this.reaching = on;
  }

  /** Throwing punches at an opponent. */
  setFighting(on: boolean) {
    this.fighting = on;
  }

  /** Tint clothing red as alarm rises (0..1) so witnesses read at a glance. */
  setAlarm(a: number) {
    this.shirtMat.emissive.setRGB(a * 0.85, 0, 0);
    this.shirtMat.emissiveIntensity = a;
  }

  /** `speed` is metres/second; drives stride frequency + amplitude. */
  update(dt: number, speed: number) {
    const amp = THREE.MathUtils.clamp(speed * 0.34, 0.04, 0.7);
    this.phase += dt * (3.5 + speed * 1.3);
    const s = Math.sin(this.phase);

    this.legL.rotation.x = s * amp;
    this.legR.rotation.x = -s * amp;
    // knees bend as each leg swings back
    this.kneeL.rotation.x = Math.max(0, s) * amp * 1.3;
    this.kneeR.rotation.x = Math.max(0, -s) * amp * 1.3;

    this.fightClock += dt;
    if (this.fighting) {
      // alternating forward jabs on a fast independent clock
      const j = Math.sin(this.fightClock * 12);
      this.armR.rotation.x = -1.05 - Math.max(0, j) * 0.7;
      this.armL.rotation.x = -1.05 - Math.max(0, -j) * 0.7;
      this.elbowR.rotation.x = 0.2;
    } else if (this.aiming) {
      this.armR.rotation.x = -1.55; // raise the forearm to horizontal, pointing forward
      this.elbowR.rotation.x = 0.0;
      this.armL.rotation.x = -s * amp * 0.85;
    } else if (this.reaching) {
      this.armR.rotation.x = -1.15; // both hands out, pushing
      this.armL.rotation.x = -1.15;
      this.elbowR.rotation.x = 0.1;
    } else {
      this.armL.rotation.x = -s * amp * 0.85;
      this.armR.rotation.x = s * amp * 0.85;
      this.elbowR.rotation.x = 0.12;
    }

    // gentle vertical bob with each footfall
    this.root.position.y = Math.abs(Math.cos(this.phase)) * amp * 0.05;
  }
}

// Procedural hairstyles. A swept-back cap whose hairline is lifted above the
// brow (tilted back so it's short at the front, longer down the back), plus a
// range of styles for variety: short, buzz, bald, medium, long, ponytail, bun,
// and the occasional spiky top.
function buildHair(headY: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const r = Math.random();
  if (r < 0.08) return g; // bald

  const buzz = r < 0.2;
  const cap = new THREE.Mesh(buzz ? G.capBuzz : G.cap, mat);
  cap.position.set(0, headY, -0.012);
  cap.rotation.x = -0.45; // lift the front hairline, drape longer at the back
  g.add(cap);
  if (buzz) return g;

  if (r < 0.55) {
    // short — the tilted cap already reads as short-front / longer-back
  } else if (r < 0.72) {
    g.add(backPanel(headY, mat, 0.2)); // medium
  } else if (r < 0.86) {
    g.add(backPanel(headY, mat, 0.5)); // long, toward the shoulders
  } else if (r < 0.93) {
    g.add(backPanel(headY, mat, 0.16));
    const tail = new THREE.Mesh(G.tail, mat); // ponytail
    tail.position.set(0, headY - 0.26, -0.22);
    tail.rotation.x = 0.35;
    g.add(tail);
  } else {
    const bun = new THREE.Mesh(G.bun, mat); // bun
    bun.position.set(0, headY + 0.1, -0.2);
    g.add(bun);
  }

  if (Math.random() < 0.12) {
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Mesh(G.spike, mat);
      const a = (i / 7) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 0.1, headY + 0.17, Math.sin(a) * 0.1 - 0.02);
      sp.rotation.set(-0.2 + (Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
      g.add(sp);
    }
  }
  return g;
}

function backPanel(headY: number, mat: THREE.Material, len: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, len, 0.14), mat);
  m.position.set(0, headY - 0.04 - len / 2, -0.16);
  m.rotation.x = 0.1;
  return m;
}

// Handy palettes for procedural civilians.
const SKIN = [0xf1c9a5, 0xe0ac80, 0xc68642, 0x8d5524, 0xffdbac, 0xa1665e];
const HAIR = [0x2a1a0f, 0x4a2f1a, 0x000000, 0x6b6b6b, 0xb5651d, 0xd9c27a, 0x3b3b3b];
const SHIRT = [0x3a6ea5, 0x9a4a4a, 0x4a7a4a, 0xb0843a, 0x5a4a7a, 0x6a6a6a, 0xcdd2d8];
const PANTS = [0x2a2f3a, 0x3a3f4a, 0x4a3a2a, 0x23304a, 0x2e2e2e];
const SHOES = [0x1a1a1a, 0x2a1a10, 0x3a3a3a, 0x101418];

export function randomCivilianColors(): HumanoidColors {
  const pick = (a: number[]) => a[(Math.random() * a.length) | 0];
  return {
    skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT),
    pants: pick(PANTS), shoes: pick(SHOES),
  };
}
