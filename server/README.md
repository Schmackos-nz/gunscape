# Gunscape Classic — Dedicated Server

A small standalone server that hosts **full online multiplayer** for Gunscape
Classic. It manages accounts (register/login), is the authority for each
player's position/appearance/health (it validates movement and persists
profiles), relays chat, and broadcasts presence snapshots to everyone.

It also serves the game client itself, so running the server gives you a
playable URL out of the box.

## Run it

```bash
cd server
npm install
npm start
```

You'll see:

```
  Gunscape dedicated server
  WebSocket + game client → http://localhost:8787/
```

- Open `http://localhost:8787/` to play against the server you just started.
- On the login screen, set **Server** to `ws://localhost:8787` (or
  `ws://<your-lan-ip>:8787` for friends on your network), then **Register**
  a username/password and log in.
- To expose it over the internet, port-forward the port (default `8787`) or
  put it behind a reverse proxy / tunnel (e.g. Cloudflare Tunnel, ngrok).

## Config

| Env var  | Default   | Meaning                                            |
|----------|-----------|----------------------------------------------------|
| `PORT`   | `8787`    | HTTP + WebSocket port                              |
| `HOST`   | `0.0.0.0` | Bind address                                       |
| `ADMINS` | `admin`   | Comma-separated admin usernames                    |

## Admin commands

Log in as an admin (any username in `ADMINS`, or the account `admin` by default)
and type these in the in-game chat box:

| Command            | Effect                                              |
|--------------------|-----------------------------------------------------|
| `/broadcast <msg>` | Send a SERVER message to everyone's chat            |
| `/announce <msg>`  | Big on-screen announcement for everyone (~3 min)    |
| `/dm <user> <msg>` | Private message to one player                       |
| `/kick <user>`     | Disconnect a player                                 |
| `/ban <user>`      | Ban an account (kicks them; blocks future logins)   |
| `/unban <user>`    | Lift a ban                                          |
| `/who`             | List online players                                 |

Bans are stored on the account in `accounts.json`.

Accounts are stored in `server/accounts.json` (created on first register).
Passwords are salted + SHA-256 hashed; this is a hobby server, not a bank.

## What's authoritative today

- Accounts, login sessions, and durable profiles.
- Each player's canonical position (movement is clamped to the world and
  rejected if it exceeds plausible speed), facing, and health.
- Chat relay and join/leave presence.

Enemies, loot, and combat resolution currently run client-side per player
(shared world authority for those is the next milestone). Offline mode runs
the entire game locally with no server.
