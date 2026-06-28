import * as THREE from "three";
import { Spectator, LensKind } from "./Spectator";

// A fixed security camera. Never bored, never panics, but only sees inside its
// cone — part of the mandatory fallback ladder that lets the Pure 2nd-person
// camera always find *an* eye.
export class CCTV implements Spectator {
  readonly id: string;
  readonly kind: LensKind = "cctv";
  readonly mechanical = true;
  readonly stability = 1;
  fieldOfViewCos = Math.cos(THREE.MathUtils.degToRad(55)); // moderate cone

  private pos: THREE.Vector3;
  private forward: THREE.Vector3;

  constructor(index: number, pos: THREE.Vector3, forward: THREE.Vector3) {
    this.id = "cctv" + index;
    this.pos = pos.clone();
    this.forward = forward.clone().normalize();
  }

  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pos);
  }
  eyeForward(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.forward);
  }
}

// Last resort: a disembodied, drifting high vantage used when literally no eye
// can see the player. Rendered with grain + desaturation by the CameraDirector,
// it doubles as the visual signal that you are currently UNOBSERVED (and thus
// cooling down heat). It floats lazily so the shot never feels like a chase cam.
export class UnobservedLens implements Spectator {
  readonly id = "unobserved";
  readonly kind: LensKind = "unobserved";
  readonly mechanical = true;
  readonly stability = 1;
  fieldOfViewCos = -1; // sees everything (it's a contrivance, not a witness)

  private pos = new THREE.Vector3();
  private forward = new THREE.Vector3(0, -1, 0);
  private phase = 0;

  /** Park the vantage above-behind the player, drifting slowly. */
  update(dt: number, playerPos: THREE.Vector3) {
    this.phase += dt * 0.4;
    const r = 9;
    this.pos.set(
      playerPos.x + Math.cos(this.phase) * r,
      14,
      playerPos.z + Math.sin(this.phase) * r
    );
    this.forward.copy(playerPos).sub(this.pos).normalize();
  }

  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.pos);
  }
  eyeForward(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.forward);
  }
}
