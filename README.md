# Gunscape Classic

RuneScape Classic — but with guns. A 3D browser RPG (Three.js, no build step
for the client) with woodcutting, cooking, prayer, agility, quests, a multi-biome
open world, and optional online multiplayer via a standalone dedicated server.

## Play

- **Single-player:** open `index.html` in a browser and choose **Play Offline**.
- **Multiplayer:** run the dedicated server (see `server/README.md`), then on the
  login screen enter the server address (e.g. `ws://localhost:8787`), register an
  account and log in. The server also serves the client at its own URL.

`classic-2d.html` is the original 2D prototype.

## Controls

Click to move · click a monster to auto-fight · click trees to chop · click loot to
grab · right-click for options · right-drag to turn · wheel to zoom · hold **Tab**
for attack styles + prayers. Toggle run by the minimap.

## Stats

Aim (bloom), Composure (flinch), Armour (defence), Vitality (HP ×10), plus
Woodcutting, Cooking, Agility and Prayer.

## Deploy

Static client deploys to Cloudflare, same flow as the other projects:

```bash
npm install
npm run build      # → dist/
npm run deploy     # build + npx wrangler deploy   (needs CLOUDFLARE_API_TOKEN)
```

Pushing to `main` runs `.github/workflows/deploy.yml` automatically (set the
`CLOUDFLARE_API_TOKEN` repository secret).

## Project layout

```
index.html            game client (HTML/CSS + Three.js engine)
classic-2d.html       original 2D prototype
server/               standalone dedicated multiplayer server (Node + ws)
scripts/build.mjs     copies static client into dist/ for deploy
wrangler.toml         Cloudflare static-assets config
```
