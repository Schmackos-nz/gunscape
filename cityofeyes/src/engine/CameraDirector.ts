import * as THREE from "three";
import { CONFIG } from "./config";
import { Player } from "./Player";
import { SpectatorSystem } from "./SpectatorSystem";

// Drives the real THREE camera from whichever eye the SpectatorSystem picked.
// Smoothly eases between nearby eyes; hard-CUTS (with a black flash) when the
// new eye is far from the old, because flying the camera across the city would
// read as a glitch. Tightens FOV as heat rises (the loose, wandering 2nd-person
// gaze becomes a fixed, intense stare) and applies grain when unobserved.
export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;

  private curPos = new THREE.Vector3();
  private curLook = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private prevEye = new THREE.Vector3();
  private ease = 1; // 1 = settled, <1 = mid-ease
  private fov = 55;

  /** Ground-projected forward of the current shot — feeds player movement. */
  readonly forward = new THREE.Vector3(0, 0, 1);

  constructor(
    aspect: number,
    private cutFlash: HTMLElement,
    private grain: HTMLElement,
    private appEl: HTMLElement
  ) {
    this.camera = new THREE.PerspectiveCamera(this.fov, aspect, 0.1, 400);
    this.spawnAt(new THREE.Vector3(10, 12, 10), new THREE.Vector3(0, 1, 0));
  }

  private spawnAt(pos: THREE.Vector3, look: THREE.Vector3) {
    this.curPos.copy(pos); this.targetPos.copy(pos); this.prevEye.copy(pos);
    this.curLook.copy(look); this.targetLook.copy(look);
  }

  update(dt: number, player: Player, spec: SpectatorSystem, heat: number) {
    // where the active eye is, and what it should frame (player head, lifted)
    spec.active.eyePosition(this.targetPos);
    player.chestPoint(this.targetLook);
    this.targetLook.y += 0.35; // frame the head, not the chest

    // handoff: decide cut vs ease by how far the eye jumped
    if (spec.handed) {
      const jumpSq = this.targetPos.distanceToSquared(this.prevEye);
      if (jumpSq > CONFIG.spectator.cutDistanceSq) {
        // hard cut — snap and flash
        this.curPos.copy(this.targetPos);
        this.flash();
        this.ease = 1;
      } else {
        this.ease = 0; // begin a quick ease from the old eye
      }
      this.prevEye.copy(this.targetPos);
    }

    // ease position toward the (possibly moving) eye
    if (this.ease < 1) {
      this.ease = Math.min(1, this.ease + dt / CONFIG.spectator.easeTime);
      const k = smooth(this.ease);
      this.curPos.lerp(this.targetPos, k);
    } else {
      // settled: track the eye tightly (it's a live person, so a little lag is good)
      this.curPos.lerp(this.targetPos, 1 - Math.pow(0.001, dt));
    }
    this.curLook.lerp(this.targetLook, 1 - Math.pow(0.0001, dt));

    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);

    // ground forward for player control basis
    this.forward.copy(this.curLook).sub(this.curPos).setY(0);
    if (this.forward.lengthSq() < 1e-4) this.forward.set(0, 0, 1);
    this.forward.normalize();

    // alarm zoom: 55° calm → ~40° at full heat (mechanical lenses don't emote)
    const wantFov = spec.active.mechanical ? 50 : 55 - heat * 15;
    this.fov += (wantFov - this.fov) * (1 - Math.pow(0.01, dt));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // unobserved styling: grain on, world desaturated/dimmed
    const un = spec.isUnobserved;
    this.grain.style.opacity = un ? "0.55" : "0";
    this.appEl.style.filter = un ? "saturate(0.25) brightness(0.8) contrast(1.1)" : "none";
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private flash() {
    this.cutFlash.style.transition = "none";
    this.cutFlash.style.opacity = "0.85";
    requestAnimationFrame(() => {
      this.cutFlash.style.transition = "opacity 0.18s ease-out";
      this.cutFlash.style.opacity = "0";
    });
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep
}
