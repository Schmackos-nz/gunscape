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

Also done: **loot respects single-combat** (multi-zone drops public instantly, else
killer-private 60s), **smart pathfinding** (`findPath` grid A* around walls/through
open doors, click-to-move uses `player.path`), **10s logout-linger** (server keeps a
disconnected avatar in-world 10s; dying then = real death, gear drops), **admin
commands** (`/broadcast /announce /dm /kick /ban /unban /who`, `ADMINS` env),
**buildings** (hinged doors via pivot group, windows + colour variety, two-storey
houses with a stair hole + enclosed upstairs + floor-aware collision via
`player.floor`/`wall.floor`), and a **quest tracker HUD** (`#questtracker`).

## Hosting (dedicated server)
- Cloudflare serves the static client (HTTPS) → the client connects via **`wss://`**
  on a secure page (see `normSrv`); enter just the hostname (no `:port`).
- Server runs on **Fly.io**: `Dockerfile` + `fly.toml` (app `gunscape-game`), persistent
  volume at `/data` via `ACCOUNTS_FILE`. Deploy: `fly deploy`. Also serves the client.

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
- **Patch-note style:** commit-body bullet lines become the in-game patch notes. Start
  a bullet with a category tag so the changelog renders it nicely, e.g.
  `Combat:`, `Balance:`, `Nerf:`, `Buff:`, `World:`, `UI:`, `Vendors:`, `Prayer:`,
  `Skills:`, `Bugfix:`, `Feature:`. For any nerf/buff give **before → after** values
  with an arrow, e.g. `Nerf: Bulwark damage soak 40% → 20%`. The changelog UI tags the
  category and strikes/greens the before/after values automatically.

## Deploy
Static client → Cloudflare (mirrors the Stormfall setup): `npm run build` → `dist/`,
then `npx wrangler deploy` (`wrangler.toml` name `gunscape`, `[assets]`). CI:
`.github/workflows/deploy.yml` runs on push to **main** and needs the
`CLOUDFLARE_API_TOKEN` repo secret. The dedicated server is hosted separately.

Repo: https://github.com/Schmackos-nz/gunscape (remote `origin`, branch `main`).
