import * as THREE from "three";

// Anything the camera can "ride". Pedestrians, drivers, CCTV, the fallback cam
// — all implement this. The SpectatorSystem only ever talks to this interface,
// which is what keeps the Pure 2nd-person camera honest: there is no special
// "player chase cam", only eyes that happen to be looking the player's way.
export type LensKind =
  | "pedestrian"
  | "sitter"
  | "driver"
  | "cctv"
  | "drone"
  | "window"
  | "critter"
  | "unobserved";

export interface Spectator {
  readonly id: string;
  readonly kind: LensKind;
  /** Mechanical lenses (CCTV) never get bored and ignore alarm framing. */
  readonly mechanical: boolean;
  /** 0..1 — how long this lens tends to hold a steady shot. */
  readonly stability: number;

  /** World-space position of the eye. */
  eyePosition(out: THREE.Vector3): THREE.Vector3;
  /** Unit forward the eye is currently oriented along (for facing/arc tests). */
  eyeForward(out: THREE.Vector3): THREE.Vector3;
  /** CCTV has a limited cone; pedestrians ~full but weighted by head facing. */
  fieldOfViewCos: number; // cos(halfAngle); candidate must be within the cone
}
