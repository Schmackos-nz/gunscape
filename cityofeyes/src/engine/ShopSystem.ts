import * as THREE from "three";
import { World } from "./World";
import { Player } from "./Player";
import { Humanoid } from "./Humanoid";
import { CCTV } from "./FallbackLenses";
import { ITEMS, SHOP_STOCK } from "./Inventory";

// The interior convenience store lives far off the main map. Walking into a
// shop door portal teleports the player inside; a door portal inside teleports
// them back out. Two ceiling cameras film the interior so the 2nd-person lens
// keeps working in there.
const STORE = new THREE.Vector3(1000, 0, 1000);
const HX = 8, HZ = 6; // room half-extents

// Edge-triggered proximity portal: fires once when the player enters its
// radius, re-arms when they leave.
class Portal {
  armed = true;
  constructor(public pos: THREE.Vector3, public r: number) {}
  check(p: THREE.Vector3): boolean {
    const inside = p.distanceToSquared(this.pos) < this.r * this.r;
    if (inside && this.armed) { this.armed = false; return true; }
    if (!inside) this.armed = true;
    return false;
  }
}

export class ShopSystem {
  readonly interiorLenses: CCTV[] = [];
  inside = false;

  private doorPortals: Portal[] = [];
  private doorOut: { pos: THREE.Vector3; forward: THREE.Vector3 }[] = [];
  private exitPortal: Portal;
  private spawnIn = new THREE.Vector3(STORE.x, 0, STORE.z - HZ + 3);
  private counterPos = new THREE.Vector3(STORE.x, 0, STORE.z + HZ - 2);
  private keeper: Humanoid;
  private returnIndex = 0;

  constructor(scene: THREE.Scene, world: World) {
    // outside: a glowing portal pad + sign + frame at each shop door
    for (const door of world.shopDoors) {
      this.doorOut.push({ pos: door.pos.clone(), forward: door.forward.clone() });
      this.doorPortals.push(new Portal(door.pos.clone(), 2.0));
      this.buildStorefront(scene, door.pos, door.forward);
    }

    this.exitPortal = new Portal(new THREE.Vector3(STORE.x, 0, STORE.z - HZ + 0.6), 2.0);
    this.keeper = new Humanoid({
      skin: 0xe0b48a, hair: 0x2b2018, shirt: 0x9a3d3d, pants: 0x222730, shoes: 0x14161c,
    });
    this.buildInterior(scene);
  }

  private buildStorefront(scene: THREE.Scene, pos: THREE.Vector3, forward: THREE.Vector3) {
    const yaw = Math.atan2(forward.x, forward.z);
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 20),
      new THREE.MeshStandardMaterial({ color: 0x21d07a, emissive: 0x12693c, emissiveIntensity: 0.9 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(pos.x, 0.06, pos.z);
    scene.add(pad);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.8, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x21d07a, emissive: 0x12693c, emissiveIntensity: 0.8 })
    );
    sign.position.set(pos.x + forward.x * 0.4, 3.2, pos.z + forward.z * 0.4);
    sign.rotation.y = yaw;
    scene.add(sign);
  }

  private buildInterior(scene: THREE.Scene) {
    const C = STORE;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.9 });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HX * 2, HZ * 2),
      new THREE.MeshStandardMaterial({ color: 0x6b7480, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(C.x, 0.02, C.z);
    scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), wallMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(C.x, 4, C.z);
    scene.add(ceil);

    const wall = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), wallMat);
      m.position.set(x, 2, z);
      scene.add(m);
    };
    wall(HX * 2, 0.3, C.x, C.z + HZ); // north
    wall(0.3, HZ * 2, C.x + HX, C.z); // east
    wall(0.3, HZ * 2, C.x - HX, C.z); // west
    wall(HX - 1.5, 0.3, C.x - (HX + 1.5) / 2, C.z - HZ); // south-left (gap = doorway)
    wall(HX - 1.5, 0.3, C.x + (HX + 1.5) / 2, C.z - HZ); // south-right

    const light = new THREE.PointLight(0xfff0d0, 0.9, 40);
    light.position.set(C.x, 3.5, C.z);
    scene.add(light);

    // shelves stocked with item-coloured boxes
    const ids = SHOP_STOCK;
    for (let s = 0; s < 4; s++) {
      const side = s < 2 ? -1 : 1;
      const z = C.z - 2 + (s % 2) * 4;
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.4, 3),
        new THREE.MeshStandardMaterial({ color: 0x8a939c })
      );
      shelf.position.set(C.x + side * (HX - 1), 0.7, z);
      scene.add(shelf);
      for (let k = 0; k < 3; k++) {
        const def = ITEMS[ids[(s * 3 + k) % ids.length]];
        const item = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.3, 0.3),
          new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.15 })
        );
        item.position.set(C.x + side * (HX - 1.1), 1.5, z - 1 + k);
        scene.add(item);
      }
    }

    // counter + shopkeeper
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x5a4326, roughness: 0.7 })
    );
    counter.position.set(this.counterPos.x, 0.5, this.counterPos.z);
    scene.add(counter);
    this.keeper.group.position.set(C.x, 0, C.z + HZ - 1);
    this.keeper.group.rotation.y = Math.PI; // face the entrance (-z)
    scene.add(this.keeper.group);

    // exit portal pad
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 20),
      new THREE.MeshStandardMaterial({ color: 0xe5b54a, emissive: 0x7a5a12, emissiveIntensity: 0.9 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(this.exitPortal.pos.x, 0.05, this.exitPortal.pos.z);
    scene.add(pad);

    // two ceiling cameras so the 2nd-person lens works inside
    this.interiorLenses.push(new CCTV(900, new THREE.Vector3(C.x - HX + 1, 3.5, C.z + HZ - 1), new THREE.Vector3(0.4, -0.5, -1).normalize()));
    this.interiorLenses.push(new CCTV(901, new THREE.Vector3(C.x + HX - 1, 3.5, C.z - HZ + 1), new THREE.Vector3(-0.4, -0.5, 1).normalize()));
  }

  /** Player is inside, standing at the counter (for the buy prompt/menu). */
  nearCounter(playerPos: THREE.Vector3): boolean {
    return this.inside && playerPos.distanceToSquared(this.counterPos) < 3 * 3;
  }
  /** Player is outside, standing on a shop door pad (for the prompt). */
  nearDoor(playerPos: THREE.Vector3): boolean {
    return !this.inside && this.doorOut.some((d) => playerPos.distanceToSquared(d.pos) < 4);
  }

  update(dt: number, player: Player) {
    this.keeper.update(dt, 0);

    if (!this.inside) {
      for (let i = 0; i < this.doorPortals.length; i++) {
        if (this.doorPortals[i].check(player.pos)) { this.enter(i, player); break; }
      }
    } else if (this.exitPortal.check(player.pos)) {
      this.exit(player);
    }
  }

  private enter(i: number, player: Player) {
    this.returnIndex = i;
    this.inside = true;
    player.pos.copy(this.spawnIn);
    player.facing = 0; // look into the store (+z)
    player.group.position.copy(player.pos);
    this.exitPortal.armed = false;
  }

  private exit(player: Player) {
    const d = this.doorOut[this.returnIndex];
    player.pos.set(d.pos.x + d.forward.x * 2.6, 0, d.pos.z + d.forward.z * 2.6);
    player.facing = Math.atan2(d.forward.x, d.forward.z);
    player.group.position.copy(player.pos);
    this.inside = false;
    this.doorPortals[this.returnIndex].armed = false;
  }
}
