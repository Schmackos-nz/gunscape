// Version + changelog shown on the main menu. Bump VERSION and prepend an entry
// on every push.
export const VERSION = "0.3.0";

export interface ChangeEntry {
  version: string;
  notes: string[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: "0.3.0",
    notes: [
      "Wheels added to all cars.",
      "Main-menu changelog + version number.",
    ],
  },
  {
    version: "0.2.0",
    notes: [
      "Main menu, pause menu, and sound settings.",
      "Overwatch drone always trails you — the camera is never 'unobserved'.",
      "Car-vs-car collision; AI traffic brakes for your car.",
      "Steal & drive cars (parked or moving); carjack victims flee and yell.",
      "Wider roads with parked cars lining the curbs.",
    ],
  },
  {
    version: "0.1.0",
    notes: [
      "Pure 2nd-person camera: you're always watched by a nearby pedestrian, CCTV or drone.",
      "Crowd with collisions, brawls, and spoken voice lines; armed civilians defend themselves.",
      "Wanted level + police; shops, inventory, run energy, and rural farms to rob.",
      "Save states.",
    ],
  },
];
