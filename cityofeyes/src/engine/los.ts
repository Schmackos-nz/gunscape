import * as THREE from "three";

// Shared line-of-sight test. Used by both the AttentionSystem (can this witness
// see the crime?) and the SpectatorSystem (is this lens's view of the player
// blocked?). One raycaster, reused, against the building occluders.
const ray = new THREE.Raycaster();
const dir = new THREE.Vector3();

export function clearLineOfSight(
  from: THREE.Vector3,
  to: THREE.Vector3,
  occluders: THREE.Mesh[]
): boolean {
  dir.copy(to).sub(from);
  const dist = dir.length();
  if (dist < 1e-3) return true;
  dir.divideScalar(dist);
  ray.set(from, dir);
  ray.far = dist - 0.3; // ignore hits right at the target
  const hits = ray.intersectObjects(occluders, false);
  return hits.length === 0;
}
