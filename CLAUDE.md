# Gunscape Classic — project guide for Claude

RuneScape Classic, but with guns. A 3D browser RPG (Three.js, no build step for
the client) plus an optional standalone dedicated server for online multiplayer.

## Status
**Server-authoritative world is DONE.** Online play renders enemies/loot from the
server `{t:"snapshot", enemies, loot}` (via `serverEnemies`/`serverLoot`), sends
`{t:"attack"}`/`{t:"pickup"}`/`{t:"heal"}`/`{t:"droploot"}` intents, and uses
server-owned HP + `xp`/`hurt`/`death` events. Offline still runs the local sim.

PvP is also server-authoritative now: duels register via `duelstart`, attack via
`duelattack`; `world.js` resolves hits/death and emits `pvpxp`/`duelwin`. Combat
audio + tracers are networked (server broadcasts `fx` shot/eshot/kill; clients play
them distance-attenuated, skipping their own).

Single-combat is enforced server-side: outside the multi-combat zones an enemy is
locked to one attacker (`e.engagedBy`), others get a `busy` event; multi-combat
zones (in `shared/world-data.js` `MULTI_ZONES`/`inMulti`) allow piling on.

## ⏭️ Next planned changes — DO THESE ALL IN ONE BATCH
Implement together in a single pass (then commit once):
1. **Loot respects single-combat** — enemy drops are lootable only by the player who
   was engaged with it (its `engagedBy`/killer) until the public timer, outside
   multi-combat zones. (Owner/`publicAt` already exist on loot; tie owner to the
   engaged fighter and gate pickup server-side.)
2. **Smart pathfinding** — route the player through open doors / around walls to the
   clicked destination (today only `nearestOpen` retargets to a walkable spot; add
   real path navigation, e.g. waypoints via the nearest open door of the building
   you're in, or a grid A* over `blockers`/`wallBoxes`).
3. **10s logout-linger + death-counts** — on disconnect the avatar stays in the
   world for 10s; if it's killed during that window it counts as a real death (gear
   drops). Server-side: keep the session's world player alive 10s after the socket
   closes before removing it.

## Run it
- **Single-player:** open `index.html`, choose **Play Offline**.
- **Multiplayer:** `cd server && npm install && npm start` (Node + ws). It serves the
  client and a WebSocket world at `http://localhost:8787/`. On the login screen pick a
  server, Register/Login. See `server/README.md`.

## Layout
- `index.html` — the whole client (HTML/CSS + Three.js engine, one big inline script).
- `shared/world-data.js` — UMD module: single source of MAP, `ENEMY_STATS`,
  `WEAPON_COMBAT`, `GUN_TIERS`/`ARMOUR_TIERS`, `BIOME_SPAWNS`, `biomeKind`,
  `COMBAT_RANGE`. Loaded by both client (global) and server (`globalThis`). **Add new
  enemies/weapons/map constants here** so client and server stay in sync.
- `server/` — dedicated server: `server.js` (accounts, presence, p2p relay, snapshot
  broadcast) + `world.js` (authoritative `World` sim).
- `patchnotes.js` — generated; powers the in-game version chip + changelog.
- `scripts/build.mjs` — copies static client to `dist/` for Cloudflare.
- `scripts/changelog.mjs` + `.githooks/post-commit` — regenerate `patchnotes.js` from
  git history on every commit (enabled via `git config core.hooksPath .githooks`).
- `classic-2d.html` — original 2D prototype.

## Conventions
- Client engine is global-scope classic scripts (no bundler); `function` decls are
  global. Keep declarative data in `shared/world-data.js`.
- Stats: Aim (bloom), Composure (flinch), Armour (defence), Vitality (HP ×10),
  Woodcutting, Cooking, Agility, Prayer.
- After changes, smoke-test headlessly: stub THREE + DOM (+ localStorage) in a `.cjs`,
  concat the inline + local-`src` scripts, append `startGame(false)`, drive rAF frames.
- Commit messages auto-become changelog entries; version is `1.0.<commit-count>`.

## Deploy
Static client → Cloudflare (mirrors the Stormfall setup): `npm run build` → `dist/`,
then `npx wrangler deploy` (`wrangler.toml` name `gunscape`, `[assets]`). CI:
`.github/workflows/deploy.yml` runs on push to **main** and needs the
`CLOUDFLARE_API_TOKEN` repo secret. The dedicated server is hosted separately.

Repo: https://github.com/Schmackos-nz/gunscape (remote `origin`, branch `main`).
