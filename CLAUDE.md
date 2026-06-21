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

## ⏭️ Next planned changes
- **Smart pathfinding** through open doors/around walls (only `nearestOpen` exists).
- **Single-combat enforcement** outside the multi-combat zones (server-side).
- **10s logout-linger** with death-counts.

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
