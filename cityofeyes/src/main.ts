import * as THREE from "three";
import { CONFIG } from "./engine/config";
import { Input } from "./engine/Input";
import { World } from "./engine/World";
import { Player } from "./engine/Player";
import { CrowdSystem } from "./engine/CrowdSystem";
import { TrafficSystem } from "./engine/TrafficSystem";
import { AttentionSystem } from "./engine/AttentionSystem";
import { SpectatorSystem } from "./engine/SpectatorSystem";
import { CameraDirector } from "./engine/CameraDirector";
import { DebugGizmos } from "./engine/DebugGizmos";
import { ProjectileSystem } from "./engine/ProjectileSystem";
import { PoliceSystem } from "./engine/PoliceSystem";
import { PickupSystem } from "./engine/PickupSystem";
import { ShopSystem } from "./engine/ShopSystem";
import { FarmSystem } from "./engine/FarmSystem";
import { Inventory, ITEMS, SHOP_STOCK } from "./engine/Inventory";
import { DroneSystem } from "./engine/DroneSystem";
import { Voice } from "./engine/Voice";
import { Sfx } from "./engine/Sfx";

function fatal(msg: string) {
  let el = document.getElementById("fatal");
  if (!el) {
    el = document.createElement("div");
    el.id = "fatal";
    el.style.cssText =
      "position:fixed;inset:0;z-index:99;background:#1a0c0c;color:#ffb4b4;" +
      "font:13px ui-monospace,monospace;padding:24px;white-space:pre-wrap;overflow:auto";
    document.body.appendChild(el);
  }
  el.textContent = "Runtime error:\n\n" + msg;
}
window.addEventListener("error", (e) => fatal(`${e.message}\n${e.error?.stack ?? ""}`));
window.addEventListener("unhandledrejection", (e) => fatal(String(e.reason)));

// ── DOM ──────────────────────────────────────────────────────────────────────
const appEl = document.getElementById("app")!;
const cutFlash = document.getElementById("cut-flash")!;
const grain = document.getElementById("grain")!;
const lensKindEl = document.querySelector("#lens .kind") as HTMLElement;
const lensWhoEl = document.querySelector("#lens .who") as HTMLElement;
const heatFillEl = document.querySelector("#heat .fill") as HTMLElement;
const heatWitEl = document.querySelector("#heat .witnesses") as HTMLElement;
const healthFillEl = document.querySelector("#health .fill") as HTMLElement;
const moneyEl = document.getElementById("money") as HTMLElement;
const wantedEl = document.getElementById("wanted") as HTMLElement;
const energyFillEl = document.querySelector("#energy .fill") as HTMLElement;
const hotbarEl = document.getElementById("hotbar") as HTMLElement;
const promptEl = document.getElementById("prompt") as HTMLElement;
const shopEl = document.getElementById("shop") as HTMLElement;
const shopRowsEl = document.querySelector("#shop .rows") as HTMLElement;
const shopBalEl = document.querySelector("#shop .bal") as HTMLElement;
const debugEl = document.getElementById("debug") as HTMLElement;

// ── renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
appEl.appendChild(renderer.domElement);

// ── systems ──────────────────────────────────────────────────────────────────
const input = new Input();
const sfx = new Sfx();
const world = new World();
const player = new Player(world);
world.scene.add(player.group);
const crowd = new CrowdSystem(world);
const traffic = new TrafficSystem(world.scene, world.roads, sfx);
const attention = new AttentionSystem(world, crowd);
const spectator = new SpectatorSystem(world);
const director = new CameraDirector(window.innerWidth / window.innerHeight, cutFlash, grain, appEl);
const gizmos = new DebugGizmos(world.scene);
const police = new PoliceSystem(world.scene, world);
const shops = new ShopSystem(world.scene, world);
const farms = new FarmSystem(world.scene, world);
const drones = new DroneSystem(world.scene);
const voice = new Voice();
const inventory = new Inventory();
let shopOpen = false;
const toastEl = document.getElementById("toast") as HTMLElement;
let toastTimer = 0;

// ── game state ───────────────────────────────────────────────────────────────
let money = 0;
let wanted = 0;
let crimeTimer = 99;

function addWanted(stars: number) {
  wanted = Math.min(CONFIG.wanted.max, wanted + stars);
  crimeTimer = 0;
  sfx.whistle();
}

const pickups = new PickupSystem(world.scene, (amt) => { money += amt; sfx.coin(); });
const projectiles = new ProjectileSystem(world, crowd, police, {
  damage: CONFIG.combat.bulletDamage,
  onPedHit: (ped, died) => {
    if (died) {
      sfx.bodyfall();
      const amt = CONFIG.combat.moneyMin + Math.random() * (CONFIG.combat.moneyMax - CONFIG.combat.moneyMin);
      pickups.drop(ped.pos, Math.round(amt));
      attention.heat = Math.min(1, attention.heat + 0.3);
      addWanted(CONFIG.wanted.perCivilianKill);
    } else sfx.scream();
  },
  onOfficerHit: (died) => { if (died) { sfx.bodyfall(); addWanted(CONFIG.wanted.perCopKill); } },
});

const LENS_LABELS: Record<string, string> = {
  pedestrian: "PEDESTRIAN", sitter: "BYSTANDER", driver: "PASSING DRIVER",
  cctv: "SECURITY CAMERA", drone: "CAMERA DRONE", window: "WINDOW", critter: "ANIMAL",
  unobserved: "— UNOBSERVED —",
};

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  director.resize(window.innerWidth / window.innerHeight);
});

// ── fixed-timestep loop ──────────────────────────────────────────────────────
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
const aim = new THREE.Vector3();
const muzzle = new THREE.Vector3();

function step(dt: number) {
  if (input.pressed("tab")) gizmos.toggle();
  if (input.pressed("q")) spectator.cycle(-1);
  if (input.pressed("e")) spectator.cycle(1);
  if (input.pressed("r")) spectator.clearManual();
  if (input.pressed("g")) sfx.holster();

  // interact: shop / harvest
  if (input.pressed("f")) handleInteract();
  if (input.pressed("escape") && shopOpen) closeShop();
  // use inventory items with number keys
  for (let i = 1; i <= 5; i++) if (input.pressed(String(i))) useSlot(i - 1);
  // save / load
  if (input.pressed("k")) saveGame();
  if (input.pressed("l")) loadGame();

  player.update(dt, input);

  // space fires, only with the gun drawn
  const fired = input.pressed(" ") && player.armed && !player.dead;
  if (fired) {
    player.flashMuzzle();
    projectiles.spawn(player.getMuzzleWorld(muzzle), player.getAimDir(aim));
    sfx.gun();
    traffic.onGunshot(sfx);
  }

  projectiles.update(dt);
  traffic.update(dt, player);
  attention.update(dt, player, fired);
  crowd.update(dt, player, (p) => attention.canSee(p), sfx, voice);
  police.update(dt, player, crowd, sfx, wanted >= 1, (dmg, dir) => player.takeHit(dmg, dir));
  pickups.update(dt, player.pos);
  shops.update(dt);
  farms.update(dt);
  drones.update(dt, player.pos);
  spectator.update(dt, player, crowd, attention, drones.drones);

  // occasional friendly greeting from a calm nearby pedestrian
  if (Math.random() < dt * 0.5) {
    for (const p of crowd.peds) {
      if (p.state === "calm" && !p.dead && p.pos.distanceToSquared(player.pos) < 49) { voice.greet(); break; }
    }
  }

  // wanted level: decays after a crime-free spell; cleared when busted (dead)
  crimeTimer += dt;
  if (crimeTimer > CONFIG.wanted.decayDelay) wanted = Math.max(0, wanted - CONFIG.wanted.decayRate * dt);
  if (player.dead) wanted = 0;

  // police respond to the wanted player AND to brawling civilians
  const brawlers = crowd.peds.filter((p) => !p.dead && p.fightTarget).length;
  const wantedCops = wanted >= 1 ? Math.ceil(wanted * CONFIG.wanted.policePerStar) : 0;
  const targetCops = Math.max(wantedCops, brawlers > 0 ? 2 : 0);
  if (targetCops > 0) { police.setTargetCount(targetCops, player); sfx.startSiren(); }
  else { if (police.count > 0) police.clear(); sfx.stopSiren(); }
}

function handleInteract() {
  if (shopOpen) { closeShop(); return; }
  if (shops.nearestWithin(player.pos) >= 0) { openShop(); return; }
  const got = farms.tryHarvest(player.pos);
  if (got) {
    inventory.add(got.foodId);
    sfx.coin();
    if (got.seen) { voice.farmer(); addWanted(1); } // a farmer saw you steal
  }
}

function saveGame() {
  const data = {
    px: player.pos.x, pz: player.pos.z, facing: player.facing,
    health: player.health, energy: player.energy,
    money, wanted, inv: inventory.serialize(),
  };
  localStorage.setItem("cityofeyes_save", JSON.stringify(data));
  toast("Game saved");
}

function loadGame() {
  const raw = localStorage.getItem("cityofeyes_save");
  if (!raw) { toast("No save found"); return; }
  try {
    const d = JSON.parse(raw);
    player.pos.set(d.px, 0, d.pz);
    player.group.position.copy(player.pos);
    player.facing = d.facing;
    player.health = d.health;
    player.energy = d.energy;
    money = d.money;
    wanted = d.wanted;
    inventory.load(d.inv ?? {});
    toast("Game loaded");
  } catch { toast("Load failed"); }
}

function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastEl.style.opacity = "0"; }, 1200);
}

function useSlot(index: number) {
  const slots = inventory.slots();
  const slot = slots[index];
  if (!slot) return;
  const def = slot.def;
  if (def.kind === "food") player.heal(def.heal ?? 0);
  else player.drinkEnergy(def.energy ?? 0, def.buffSeconds ?? 0);
  inventory.remove(def.id);
  sfx.coin();
}

function openShop() {
  shopOpen = true;
  shopEl.style.display = "flex";
  shopRowsEl.innerHTML = "";
  for (const id of SHOP_STOCK) {
    const def = ITEMS[id];
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span>${def.name}</span><span class="price">$${def.price}</span>`;
    row.onclick = () => buy(id);
    shopRowsEl.appendChild(row);
  }
  refreshShopBalance();
}
function closeShop() { shopOpen = false; shopEl.style.display = "none"; }
function buy(id: string) {
  const def = ITEMS[id];
  if (money < def.price) return;
  money -= def.price;
  inventory.add(id);
  sfx.coin();
  refreshShopBalance();
}
function refreshShopBalance() { shopBalEl.textContent = `Your money: $${money}`; }

function frame(now: number) {
  requestAnimationFrame(frame);
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { step(STEP); acc -= STEP; }

  director.update(STEP, player, spectator, attention.heat);
  gizmos.update(spectator.candidates, player, spectator.active.eyePosition(new THREE.Vector3()));
  renderer.render(world.scene, director.camera);
  updateHud();
  input.endFrame();
}

function updateHud() {
  lensKindEl.textContent = LENS_LABELS[spectator.active.kind] ?? spectator.active.kind;
  lensWhoEl.textContent = spectator.isUnobserved
    ? "no one is watching — going dark"
    : `via ${spectator.active.id}${spectator.manual ? " [LOCKED]" : ""}  (${spectator.eligible.length} eyes near)`;

  healthFillEl.style.width = `${Math.round((player.health / player.maxHealth) * 100)}%`;
  energyFillEl.style.width = `${Math.round((player.energy / player.maxEnergy) * 100)}%`;
  heatFillEl.style.width = `${Math.round(attention.heat * 100)}%`;
  heatWitEl.textContent = `${attention.witnessCount} witness${attention.witnessCount === 1 ? "" : "es"}`;
  moneyEl.textContent = `$${money}`;

  // inventory hotbar
  const slots = inventory.slots();
  hotbarEl.innerHTML = slots
    .slice(0, 5)
    .map((s, i) => `<div class="slot"><div class="k">${i + 1}</div><div class="n">${s.def.name} ×${s.count}</div></div>`)
    .join("");

  // interact prompt
  if (!shopOpen) {
    if (shops.nearestWithin(player.pos) >= 0) { promptEl.style.display = "block"; promptEl.innerHTML = "<b>F</b> — enter shop"; }
    else if (farms.cropInRange(player.pos)) { promptEl.style.display = "block"; promptEl.innerHTML = "<b>F</b> — take crop"; }
    else promptEl.style.display = "none";
  } else promptEl.style.display = "none";

  const stars = Math.ceil(wanted);
  wantedEl.textContent = stars > 0 ? "★".repeat(stars) + "☆".repeat(CONFIG.wanted.max - stars) : "";

  if (gizmos.enabled) {
    debugEl.textContent =
      `lens ${spectator.active.id} (${spectator.active.kind})\n` +
      `heat ${attention.heat.toFixed(2)}  wanted ${wanted.toFixed(2)}  cops ${police.count}`;
  } else debugEl.textContent = "";
}

step(STEP);
director.update(STEP, player, spectator, attention.heat);
requestAnimationFrame(frame);
