import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { Player } from "./Player";
import { CrowdSystem } from "./CrowdSystem";
import { AttentionSystem } from "./AttentionSystem";
import { Spectator } from "./Spectator";
import { UnobservedLens } from "./FallbackLenses";
import { clearLineOfSight } from "./los";

export interface CandidateScore {
  id: string;
  kind: string;
  score: number;
  eye: THREE.Vector3;
  active: boolean;
  blocked: boolean;
}

// Decides, every frame, which eye the camera rides. It scores every candidate
// lens (distance / line-of-sight / facing / stability / framing), keeps the
// active lens sticky to avoid twitch, and walks DOWN a fallback ladder
// (pedestrian -> CCTV -> unobserved vantage) so a Pure 2nd-person camera can
// never be left without an eye. The player can also manually hop between nearby
// eligible eyes, which locks the lens until that eye becomes unusable.
export class SpectatorSystem {
  active: Spectator;
  readonly unobserved = new UnobservedLens();
  handed = false;
  isUnobserved = false;
  manual: Spectator | null = null;

  candidates: CandidateScore[] = [];
  /** Real eyes currently usable as a lens, nearest-first (for view-hopping). */
  eligible: Spectator[] = [];

  private eye = new THREE.Vector3();
  private chest = new THREE.Vector3();
  private toPlayer = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private elig: { s: Spectator; dist: number }[] = [];

  constructor(private world: World) {
    this.active = this.unobserved;
  }

  /** Hop to the next/previous nearby eye (manual override). */
  cycle(dir: 1 | -1) {
    if (this.eligible.length === 0) return;
    const cur = this.eligible.indexOf(this.active);
    const start = cur >= 0 ? cur : 0;
    const next = (start + dir + this.eligible.length) % this.eligible.length;
    this.manual = this.eligible[next];
    if (this.manual !== this.active) this.swap(this.manual);
  }

  /** Drop the manual lock and return to automatic direction. */
  clearManual() {
    this.manual = null;
  }

  update(dt: number, player: Player, crowd: CrowdSystem, attention: AttentionSystem, drones: Spectator[]) {
    player.chestPoint(this.chest);
    this.unobserved.update(dt, player.pos);
    this.candidates.length = 0;
    this.elig.length = 0;

    let best: Spectator | null = null;
    let bestScore = -Infinity;
    let activeScore = -Infinity;

    const consider = (s: Spectator, losKnown?: boolean) => {
      s.eyePosition(this.eye);
      this.toPlayer.copy(this.chest).sub(this.eye);
      const dist = this.toPlayer.length();
      if (dist < CONFIG.spectator.minRange || dist > CONFIG.spectator.maxRange) return;
      this.toPlayer.divideScalar(dist);

      s.eyeForward(this.fwd);
      const facingDot = this.fwd.dot(this.toPlayer);
      if (facingDot < s.fieldOfViewCos) return; // player outside this eye's cone

      const los = losKnown ?? clearLineOfSight(this.eye, this.chest, this.world.occluders);
      const score = los ? this.scoreOf(s, dist, facingDot) : -1;

      this.candidates.push({
        id: s.id, kind: s.kind, score,
        eye: this.eye.clone(), active: s === this.active, blocked: !los,
      });

      if (!los) return;
      this.elig.push({ s, dist });
      if (s === this.active) activeScore = score;
      if (score > bestScore) { bestScore = score; best = s; }
    };

    for (const p of crowd.peds) {
      if (p.dead) continue; // don't ride a corpse
      consider(p, attention.canSee(p));
    }
    for (const c of crowd.cctv) consider(c);
    for (const d of drones) consider(d);

    // publish nearest-first eligible list for manual hopping
    this.elig.sort((a, b) => a.dist - b.dist);
    this.eligible = this.elig.map((e) => e.s);

    this.handed = false;

    // Manual override: hold the chosen eye while it stays usable.
    if (this.manual) {
      if (this.eligible.includes(this.manual)) {
        this.isUnobserved = false;
        if (this.active !== this.manual) this.swap(this.manual);
        return;
      }
      this.manual = null; // lost it — fall back to automatic
    }

    // No eligible eye anywhere -> unobserved vantage (the cooldown state).
    if (!best || bestScore < CONFIG.spectator.unobservedFloor) {
      if (this.active !== this.unobserved) this.swap(this.unobserved);
      this.isUnobserved = true;
      return;
    }
    this.isUnobserved = false;

    const activeStillValid = activeScore > CONFIG.spectator.unobservedFloor;
    const beatsActive = bestScore > activeScore + CONFIG.spectator.handoffHysteresis;
    if (best !== this.active && (!activeStillValid || beatsActive)) {
      this.swap(best);
    }
  }

  private scoreOf(s: Spectator, dist: number, facingDot: number): number {
    const c = CONFIG.spectator;

    let d: number;
    if (dist < c.sweetSpotNear) d = (dist - c.minRange) / (c.sweetSpotNear - c.minRange);
    else if (dist > c.sweetSpotFar) d = 1 - (dist - c.sweetSpotFar) / (c.maxRange - c.sweetSpotFar);
    else d = 1;
    d = THREE.MathUtils.clamp(d, 0, 1);

    const f = THREE.MathUtils.clamp((facingDot - s.fieldOfViewCos) / (1 - s.fieldOfViewCos), 0, 1);

    let score = d * 0.42 + f * 0.28 + s.stability * 0.18 + 0.06;
    if (s === this.active) score += c.stickyBonus;
    return score;
  }

  private swap(next: Spectator) {
    this.active = next;
    this.handed = true;
  }
}
