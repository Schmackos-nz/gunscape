import * as THREE from "three";

interface Pickup {
  mesh: THREE.Mesh;
  amount: number;
}

// Cash dropped by dead civilians. Spins on the ground; the player collects it
// by walking over it.
export class PickupSystem {
  private items: Pickup[] = [];
  private geo = new THREE.BoxGeometry(0.34, 0.04, 0.18);
  private mat = new THREE.MeshStandardMaterial({
    color: 0x4caf50, emissive: 0x1b5e20, emissiveIntensity: 0.5, roughness: 0.6,
  });

  constructor(private scene: THREE.Scene, private onCollect: (amount: number) => void) {}

  drop(pos: THREE.Vector3, amount: number) {
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.position.set(pos.x, 0.3, pos.z);
    this.scene.add(mesh);
    this.items.push({ mesh, amount });
  }

  update(dt: number, playerPos: THREE.Vector3) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.mesh.rotation.y += dt * 2.5;
      it.mesh.position.y = 0.3 + Math.sin(performance.now() * 0.004 + i) * 0.05;
      const dx = it.mesh.position.x - playerPos.x;
      const dz = it.mesh.position.z - playerPos.z;
      if (dx * dx + dz * dz < 1.4 * 1.4) {
        this.onCollect(it.amount);
        this.scene.remove(it.mesh);
        this.items.splice(i, 1);
      }
    }
  }
}
