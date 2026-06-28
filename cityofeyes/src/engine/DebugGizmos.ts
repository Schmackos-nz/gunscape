import * as THREE from "three";
import { Player } from "./Player";
import { SpectatorSystem, CandidateScore } from "./SpectatorSystem";

// Makes the camera's reasoning visible: a marker over every candidate eye
// (green = strong shot, yellow = weak, red = blocked) and a line from the
// chosen eye to the player. This is the go/no-go diagnostic for the whole
// concept — toggle with Tab.
export class DebugGizmos {
  private group = new THREE.Group();
  private markers: THREE.Mesh[] = [];
  private line: THREE.Line;
  private markerGeo = new THREE.SphereGeometry(0.5, 8, 6);
  enabled = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0x66ff99 })
    );
    this.group.add(this.line);
  }

  toggle() {
    this.enabled = !this.enabled;
    this.group.visible = this.enabled;
  }

  update(candidates: CandidateScore[], player: Player, activeEye: THREE.Vector3) {
    if (!this.enabled) return;

    // grow the marker pool as needed
    while (this.markers.length < candidates.length) {
      const m = new THREE.Mesh(
        this.markerGeo,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 })
      );
      this.markers.push(m);
      this.group.add(m);
    }

    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i];
      const c = candidates[i];
      if (!c) { m.visible = false; continue; }
      m.visible = true;
      m.position.copy(c.eye).setY(c.eye.y + 0.4);
      const mat = m.material as THREE.MeshBasicMaterial;
      if (c.blocked) mat.color.setHex(0xe5484d);
      else mat.color.setHSL(0.33 * THREE.MathUtils.clamp(c.score, 0, 1), 0.9, 0.55);
      m.scale.setScalar(c.active ? 1.8 : 1);
    }

    const chest = new THREE.Vector3();
    player.chestPoint(chest);
    (this.line.geometry as THREE.BufferGeometry).setFromPoints([activeEye.clone(), chest]);
  }
}
