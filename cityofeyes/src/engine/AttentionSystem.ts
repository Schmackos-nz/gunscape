import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { Player } from "./Player";
import { CrowdSystem } from "./CrowdSystem";
import { Pedestrian } from "./Pedestrian";
import { clearLineOfSight } from "./los";

// The crime layer. Tracks who can see the player, accumulates per-ped alarm
// from alarming acts (brandish / gunfire), promotes alarmed peds to witnesses,
// and rolls witness count up into a city-wide HEAT (manhunt) level. Heat cools
// while the player is unwitnessed — i.e. hiding from all eyes is the cooldown,
// the exact same "who can see me" axis the camera runs on.
export class AttentionSystem {
  heat = 0;
  witnessCount = 0;

  private chest = new THREE.Vector3();
  private eye = new THREE.Vector3();
  // cache LoS results each frame so peds + spectator scoring share one pass
  private sightCache = new Map<string, boolean>();

  constructor(private world: World, private crowd: CrowdSystem) {}

  /** Whether a given ped currently has clear LoS to the player (cached/frame). */
  canSee(p: Pedestrian): boolean {
    const cached = this.sightCache.get(p.id);
    return cached ?? false;
  }

  update(dt: number, player: Player, fired: boolean) {
    player.chestPoint(this.chest);
    this.sightCache.clear();

    let witnesses = 0;
    for (const p of this.crowd.peds) {
      const within = p.pos.distanceToSquared(player.pos) <
        CONFIG.attention.sightRange * CONFIG.attention.sightRange;
      let sees = false;
      if (within) {
        p.eyePosition(this.eye);
        sees = clearLineOfSight(this.eye, this.chest, this.world.occluders);
      }
      this.sightCache.set(p.id, sees);

      // accumulate / decay alarm
      if (sees && player.armed) {
        p.alarm = Math.min(1, p.alarm + CONFIG.attention.brandishGain * dt);
      } else if (sees && fired) {
        p.alarm = Math.min(1, p.alarm + CONFIG.attention.fireGain);
      } else if (!sees) {
        p.alarm = Math.max(0, p.alarm - CONFIG.attention.calmDecay * dt);
      }

      if (p.alarm >= CONFIG.attention.witnessThreshold && sees) witnesses++;
    }

    this.witnessCount = witnesses;

    // heat tracks witnesses; with none in sight it bleeds off (you've gone dark)
    if (witnesses > 0) {
      this.heat = Math.min(1, this.heat + CONFIG.attention.heatPerWitness * witnesses * dt);
    } else {
      this.heat = Math.max(0, this.heat - CONFIG.attention.heatDecay * dt);
    }
  }
}
