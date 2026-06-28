import * as THREE from "three";
import { CONFIG } from "./config";
import { World } from "./World";
import { Humanoid } from "./Humanoid";

// Places a shopkeeper at each shop door with a glowing sign, and answers
// "is the player close enough to shop?". The actual buy menu is DOM, driven by
// main.
export class ShopSystem {
  private keepers: Humanoid[] = [];
  readonly doors: THREE.Vector3[] = [];

  constructor(scene: THREE.Scene, world: World) {
    for (const door of world.shopDoors) {
      this.doors.push(door.pos.clone());

      const keeper = new Humanoid({
        skin: 0xe0b48a, hair: 0x2b2018, shirt: 0x6a3d2a, pants: 0x222730, shoes: 0x14161c,
      });
      keeper.group.position.copy(door.pos);
      keeper.group.rotation.y = Math.atan2(door.forward.x, door.forward.z);
      scene.add(keeper.group);
      this.keepers.push(keeper);

      // awning sign above the door
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.8, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x21d07a, emissive: 0x12693c, emissiveIntensity: 0.8 })
      );
      sign.position.set(door.pos.x + door.forward.x * 0.4, 3.2, door.pos.z + door.forward.z * 0.4);
      sign.rotation.y = Math.atan2(door.forward.x, door.forward.z);
      scene.add(sign);
    }
  }

  /** Index of a shop within interact range of the player, or -1. */
  nearestWithin(playerPos: THREE.Vector3): number {
    const r = CONFIG.farm.interactRange + 1.2;
    let best = -1;
    let bestD = r * r;
    this.doors.forEach((d, i) => {
      const dx = d.x - playerPos.x, dz = d.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = i; }
    });
    return best;
  }

  update(dt: number) {
    for (const k of this.keepers) k.update(dt, 0); // idle breathing
  }
}
