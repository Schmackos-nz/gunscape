#!/usr/bin/env node
/* ============================================================ *
 *  GUNSCAPE CLASSIC — standalone dedicated server
 *
 *  Run:  cd server && npm install && npm start
 *  Env:  PORT (default 8787), HOST (default 0.0.0.0)
 *
 *  - Accounts (register/login) persisted to ./accounts.json
 *  - Server is the authority for accounts + each player's canonical
 *    position/appearance/hp; it validates movement, persists profiles,
 *    and broadcasts presence snapshots to every connected client.
 *  - Also serves the static game client from the parent folder, so
 *    hosting the server hosts the playable game at http://<host>:<port>/.
 * ============================================================ */
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { WebSocketServer } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');              // static client lives one level up
const ACCOUNTS = join(__dirname, 'accounts.json');
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const WORLD_HALF = 300;                            // must match the client map size
const TICK_MS = 100;                               // 10 snapshots/sec

// ── account store ────────────────────────────────────────────
let accounts = {};
try { if (existsSync(ACCOUNTS)) accounts = JSON.parse(readFileSync(ACCOUNTS, 'utf8')); }
catch (e) { console.error('Could not read accounts.json:', e.message); }
let saveTimer = null;
function saveAccounts() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { writeFileSync(ACCOUNTS, JSON.stringify(accounts, null, 2)); }
    catch (e) { console.error('Save failed:', e.message); }
  }, 500);
}
function hash(pass, salt) { return createHash('sha256').update(salt + ':' + pass).digest('hex'); }

// ── static file server (serves the game client) ──────────────
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.ico':'image/x-icon', '.svg':'image/svg+xml' };
const httpServer = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

// ── websocket game layer ─────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });
const clients = new Map();          // ws -> session {id, user, state}
let nextId = 1;

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(obj, except) { const s = JSON.stringify(obj);
  for (const ws of clients.keys()) if (ws !== except && ws.readyState === 1) ws.send(s); }

function defaultProfile() {
  return { x: 0, z: 40, ry: 0, hp: 100, maxhp: 100, name: '', appearance: {} };
}

wss.on('connection', (ws) => {
  const session = { id: nextId++, user: null, authed: false, state: defaultProfile(), lastMove: Date.now() };
  clients.set(ws, session);

  ws.on('message', (buf) => {
    let msg; try { msg = JSON.parse(buf.toString()); } catch { return; }
    switch (msg.t) {
      case 'register': {
        const user = String(msg.user || '').trim().toLowerCase();
        if (!/^[a-z0-9_]{3,16}$/.test(user)) return send(ws, { t: 'authfail', why: 'Username must be 3-16 chars (a-z, 0-9, _).' });
        if (!msg.pass || msg.pass.length < 4) return send(ws, { t: 'authfail', why: 'Password must be 4+ characters.' });
        if (accounts[user]) return send(ws, { t: 'authfail', why: 'That username is taken.' });
        const salt = randomBytes(8).toString('hex');
        accounts[user] = { salt, pass: hash(msg.pass, salt), profile: defaultProfile() };
        accounts[user].profile.name = user;
        saveAccounts();
        login(ws, session, user);
        break;
      }
      case 'login': {
        const user = String(msg.user || '').trim().toLowerCase();
        const acc = accounts[user];
        if (!acc || acc.pass !== hash(msg.pass || '', acc.salt)) return send(ws, { t: 'authfail', why: 'Wrong username or password.' });
        if ([...clients.values()].some(s => s.user === user)) return send(ws, { t: 'authfail', why: 'That account is already online.' });
        login(ws, session, user);
        break;
      }
      case 'state': {
        if (!session.authed) return;
        // server-authoritative movement: clamp to world + reject teleports
        const s = session.state, now = Date.now();
        let nx = clamp(+msg.x || 0), nz = clamp(+msg.z || 0);
        const dt = Math.max(0.001, (now - session.lastMove) / 1000); session.lastMove = now;
        const maxStep = 30 * dt + 4;                // generous cap vs run speed
        const dx = nx - s.x, dz = nz - s.z, d = Math.hypot(dx, dz);
        if (d > maxStep) { const k = maxStep / d; nx = s.x + dx * k; nz = s.z + dz * k; }
        s.x = nx; s.z = nz;
        s.ry = +msg.ry || 0;
        s.hp = Math.max(0, Math.min(s.maxhp, +msg.hp || s.hp));
        s.maxhp = +msg.maxhp || s.maxhp;
        if (msg.appearance) s.appearance = msg.appearance;
        break;
      }
      case 'chat': {
        if (!session.authed) return;
        const text = String(msg.msg || '').slice(0, 120);
        if (text) broadcast({ t: 'chat', from: session.user, msg: text });
        break;
      }
      case 'save': {                                 // client pushes durable profile (skills/inv)
        if (!session.authed) return;
        const acc = accounts[session.user];
        if (acc && msg.profile) { acc.profile = Object.assign(acc.profile, msg.profile); saveAccounts(); }
        break;
      }
    }
  });

  ws.on('close', () => {
    const s = clients.get(ws);
    if (s && s.authed) {
      const acc = accounts[s.user];
      if (acc) { acc.profile = Object.assign(acc.profile, s.state); saveAccounts(); }
      broadcast({ t: 'leave', id: s.id });
      console.log(`- ${s.user} left (${clients.size - 1} online)`);
    }
    clients.delete(ws);
  });
});

function clamp(v) { return Math.max(-(WORLD_HALF - 4), Math.min(WORLD_HALF - 4, v)); }
function login(ws, session, user) {
  session.user = user; session.authed = true;
  session.state = Object.assign(defaultProfile(), accounts[user].profile, { name: user });
  send(ws, { t: 'authok', id: session.id, user, profile: accounts[user].profile });
  broadcast({ t: 'join', id: session.id, user }, ws);
  console.log(`+ ${user} joined (${clients.size} online)`);
}

// periodic authoritative snapshot of everyone's presence
setInterval(() => {
  const players = [];
  for (const s of clients.values()) if (s.authed)
    players.push({ id: s.id, user: s.user, x: s.state.x, z: s.state.z, ry: s.state.ry,
      hp: s.state.hp, maxhp: s.state.maxhp, appearance: s.state.appearance });
  if (players.length) broadcast({ t: 'snapshot', players });
}, TICK_MS);

httpServer.listen(PORT, HOST, () => {
  console.log(`\n  Gunscape dedicated server`);
  console.log(`  WebSocket + game client → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  console.log(`  Share ws://<your-ip>:${PORT} with friends to connect.\n`);
});
