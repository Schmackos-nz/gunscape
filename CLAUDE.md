# Gunscape Classic — project guide for Claude

RuneScape Classic, but with guns. A 3D browser RPG (Three.js, no build step for
the client) plus an optional standalone dedicated server for online multiplayer.

## ⏭️ Next planned change (do this next)
**Move to a FULL server-authoritative world.** Today the server already simulates
enemies/loot/combat (`server/world.js`) and broadcasts them, but the **client does
not consume them** — online play still runs the client's local enemy/loot sim, and
HP/PvP are decided client-side. The next change makes the world truly shared &
authoritative:
- Online mode: stop the local enemy/loot simulation; render & lerp enemies and loot
  from the server `{t:"snapshot", enemies, loot}` (reuse `ENEMY_BUILDERS` by `type`).
- Send intents instead of resolving locally: `{t:"attack", enemyId}` on click,
  `{t:"pickup", lootId}` for loot; use server-owned HP and the `xp`/`death` events.
- Make PvP server-authoritative (replaces the current attacker-reported `pvphit`).
- Keep **offline mode** running the existing local sim unchanged.
- Then layer on the still-open items: smart pathfinding through doors, single-combat
  enforcement outside multi-combat zones, and the 10s logout-linger / death-counts.

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
