// Item registry + a tiny inventory. Foods restore health; the energy drink
// refills run energy and grants a buff that makes energy last much longer for a
// few minutes.
export interface ItemDef {
  id: string;
  name: string;
  kind: "food" | "drink";
  price: number;
  color: number;
  heal?: number;
  energy?: number;
  buffSeconds?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  carrot: { id: "carrot", name: "Carrot", kind: "food", price: 4, color: 0xff8c2b, heal: 8 },
  apple: { id: "apple", name: "Apple", kind: "food", price: 6, color: 0xd33b3b, heal: 12 },
  corn: { id: "corn", name: "Corn", kind: "food", price: 7, color: 0xf2c84b, heal: 10 },
  cabbage: { id: "cabbage", name: "Cabbage", kind: "food", price: 8, color: 0x7bbf4a, heal: 14 },
  burger: { id: "burger", name: "Burger", kind: "food", price: 18, color: 0x9b5a2a, heal: 40 },
  medkit: { id: "medkit", name: "Medkit", kind: "food", price: 45, color: 0xff4d6d, heal: 100 },
  energy_drink: { id: "energy_drink", name: "Energy Drink", kind: "drink", price: 12, color: 0x33e0ff, energy: 100, buffSeconds: 180 },
};

/** Items offered for sale in shops, in display order. */
export const SHOP_STOCK = ["apple", "corn", "burger", "medkit", "energy_drink"];

export class Inventory {
  private counts = new Map<string, number>();

  add(id: string, n = 1) {
    this.counts.set(id, (this.counts.get(id) ?? 0) + n);
  }
  count(id: string): number {
    return this.counts.get(id) ?? 0;
  }
  remove(id: string, n = 1): boolean {
    const c = this.counts.get(id) ?? 0;
    if (c < n) return false;
    this.counts.set(id, c - n);
    return true;
  }
  serialize(): Record<string, number> {
    const o: Record<string, number> = {};
    this.counts.forEach((v, k) => { o[k] = v; });
    return o;
  }
  load(obj: Record<string, number>) {
    this.counts.clear();
    for (const k in obj) if (ITEMS[k]) this.counts.set(k, obj[k]);
  }

  /** Non-empty entries in a stable order for the hotbar. */
  slots(): { def: ItemDef; count: number }[] {
    const out: { def: ItemDef; count: number }[] = [];
    for (const def of Object.values(ITEMS)) {
      const c = this.count(def.id);
      if (c > 0) out.push({ def, count: c });
    }
    return out;
  }
}
