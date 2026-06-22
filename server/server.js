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
import { World } from './world.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');              // static client lives one level up
const ACCOUNTS = process.env.ACCOUNTS_FILE || join(__dirname, 'accounts.json'); // set to a volume path to persist
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
const world = new World();           // authoritative enemy/loot/combat simulation
function wsById(id) { for (const [w, s] of clients) if (s.id === id) return w; return null; }
function wsByUser(u) { for (const [w, s] of clients) if (s.user === u) return w; return null; }

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(obj, except) { const s = JSON.stringify(obj);
  for (const ws of clients.keys()) if (ws !== except && ws.readyState === 1) ws.send(s); }

// ── admin commands ───────────────────────────────────────────
// Admins: usernames in the ADMINS env (comma-separated), plus 'admin' by default.
const ADMINS = new Set((process.env.ADMINS || 'admin').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
function isAdmin(u) { return ADMINS.has(u) || (accounts[u] && accounts[u].admin); }
function adminCommand(ws, session, line) {
  if (!session.authed) return;
  const sysTo = (w, m) => send(w, { t: 'chat', from: 'SERVER', msg: m });
  if (!isAdmin(session.user)) return sysTo(ws, "You aren't an admin.");
  line = line.replace(/^\//, '');
  const sp = line.indexOf(' '), cmd = (sp < 0 ? line : line.slice(0, sp)).toLowerCase(), rest = sp < 0 ? '' : line.slice(sp + 1).trim();
  const target = () => { const sp2 = rest.indexOf(' '); return sp2 < 0 ? [rest.toLowerCase(), ''] : [rest.slice(0, sp2).toLowerCase(), rest.slice(sp2 + 1)]; };
  switch (cmd) {
    case 'broadcast': case 'say': broadcast({ t: 'chat', from: 'SERVER', msg: rest }); break;
    case 'announce': broadcast({ t: 'announce', msg: rest, ms: 180000 }); console.log(`[announce] ${rest}`); break;
    case 'dm': { const [u, m] = target(); const tw = wsByUser(u);
      if (tw) { send(tw, { t: 'chat', from: session.user + ' (DM)', msg: m }); sysTo(ws, `→ ${u}: ${m}`); } else sysTo(ws, `${u} is not online.`); break; }
    case 'kick': { const u = rest.toLowerCase(); const tw = wsByUser(u);
      if (tw) { const ts = clients.get(tw); if (ts) ts.kicked = true; send(tw, { t: 'kicked', why: 'You were kicked by an admin.' }); setTimeout(() => tw.close(), 50); sysTo(ws, `Kicked ${u}.`); } else sysTo(ws, `${u} is not online.`); break; }
    case 'ban': { const u = rest.toLowerCase(); if (accounts[u]) { accounts[u].banned = true; saveAccounts(); }
      const tw = wsByUser(u); if (tw) { const ts = clients.get(tw); if (ts) ts.kicked = true; send(tw, { t: 'kicked', why: 'You have been banned.' }); setTimeout(() => tw.close(), 50); }
      sysTo(ws, `Banned ${u}.`); break; }
    case 'unban': { const u = rest.toLowerCase(); if (accounts[u]) { accounts[u].banned = false; saveAccounts(); } sysTo(ws, `Unbanned ${u}.`); break; }
    case 'who': sysTo(ws, 'Online: ' + [...clients.values()].filter(s => s.authed).map(s => s.user).join(', ')); break;
    case 'give': { const [id, amtStr] = target(); const n = Math.max(1, Math.min(1000, parseInt(amtStr) || 1));
      if (!id) { sysTo(ws, 'Usage: /give <itemid> <amount> — see /itemids'); break; }
      send(ws, { t: 'give', k: id, n }); sysTo(ws, `Gave you ${n}× ${id}.`); break; }
    case 'simulate': { send(ws, { t: 'simulate', v: rest.trim().toLowerCase() }); sysTo(ws, `Simulating stats: ${rest || '99'}`); break; }
    default: sysTo(ws, 'Admin cmds: /broadcast · /announce · /dm <user> <m> · /kick · /ban · /unban · /who · /give <itemid> <n> · /itemids · /simulate <lvl|off>');
  }
}

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
        if (acc.banned) return send(ws, { t: 'authfail', why: 'This account is banned.' });
        if ([...clients.values()].some(s => s.user === user)) return send(ws, { t: 'authfail', why: 'That account is already online.' });
        login(ws, session, user);
        break;
      }
      case 'admin': { adminCommand(ws, session, String(msg.line || '')); break; }
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
        world.input(session.id, { x: s.x, z: s.z, ry: s.ry, armour: +msg.armour || undefined,
          aim: +msg.aim || undefined, maxhp: +msg.maxhp || undefined, weapon: msg.appearance && msg.appearance.weapon });
        break;
      }
      case 'duelstart': { if (session.authed) world.setDuel(session.id, msg.opponent); break; }
      case 'duelattack': { if (session.authed) world.pvpAttack(session.id, msg.target); break; }
      case 'duelend': { if (session.authed) world.endDuelFor(session.id); break; }
      case 'heal': { if (session.authed) world.heal(session.id, +msg.amt || 0); break; }
      case 'selfhurt': {   // client-side boss (Darude) damaging the player; server applies it to world HP
        if (session.authed) { const wp = world.players.get(session.id);
          if (wp && !wp.dead) { wp.hp = Math.max(0, wp.hp - Math.max(0, Math.min(999, +msg.dmg || 0)));
            if (wp.hp <= 0) { wp.dead = true; wp.respawnAt = Date.now() + 4000; send(ws, { t: 'death' }); } } }
        break;
      }
      case 'droploot': { if (session.authed) { const wp = world.players.get(session.id); if (wp) world.dropLoot(session.id, msg.items, wp.x, wp.z); } break; }
      case 'p2p': {   // relay a player-to-player message (duel/trade) to one target
        if (!session.authed) break;
        const tw = wsById(msg.to);
        if (tw) { const out = Object.assign({}, msg, { from: session.id, fromUser: session.user }); delete out.to; send(tw, out); }
        break;
      }
      case 'attack': { if (session.authed) world.attackIntent(session.id, msg.enemyId); break; }
      case 'pickup': { if (session.authed) { const got = world.pickup(session.id, msg.lootId); if (got) send(ws, { t: 'looted', k: got.k, n: got.n }); } break; }
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
      if (s.kicked) {                                  // kicked/banned → remove immediately, no linger
        world.removePlayer(s.id); broadcast({ t: 'leave', id: s.id });
        console.log(`- ${s.user} removed`);
      } else {
        // logout-linger: your character stays in the world for 10s; if it dies in that
        // window it's a real death (gear drops). Don't remove or broadcast leave yet.
        lingering.set(s.id, { user: s.user, removeAt: Date.now() + 10000, appearance: s.state.appearance });
        console.log(`~ ${s.user} logging out (10s linger)`);
      }
    }
    clients.delete(ws);
  });
});

const lingering = new Map();   // pid -> { user, removeAt } : characters left in-world after disconnect
function gearFromProfile(acc) {
  const p = (acc && acc.profile) || {}, items = [];
  for (const it of (p.inv || [])) if (it && it.k) items.push({ k: it.k, n: it.n });
  const eq = p.equip || {};
  for (const slot of ['weapon', 'head', 'body', 'legs']) { const k = eq[slot]; if (k && k !== 'fists') items.push({ k, n: 1 }); }
  return items;
}
function wipeGear(acc) { if (acc && acc.profile) { acc.profile.inv = []; acc.profile.equip = { weapon: 'fists', head: null, body: null, legs: null }; } }

function clamp(v) { return Math.max(-(WORLD_HALF - 4), Math.min(WORLD_HALF - 4, v)); }
function login(ws, session, user) {
  // if this account is still lingering from a recent disconnect, reclaim it cleanly
  for (const [pid, info] of lingering) if (info.user === user) { world.removePlayer(pid); broadcast({ t: 'leave', id: pid }); lingering.delete(pid); }
  session.user = user; session.authed = true;
  session.state = Object.assign(defaultProfile(), accounts[user].profile, { name: user });
  world.addPlayer(session.id, session.state);
  send(ws, { t: 'authok', id: session.id, user, profile: accounts[user].profile });
  broadcast({ t: 'join', id: session.id, user }, ws);
  console.log(`+ ${user} joined (${clients.size} online)`);
}

// periodic authoritative tick: presence + world simulation
setInterval(() => {
  const now = Date.now();
  const { events, fx } = world.tick(TICK_MS / 1000, now);
  if (fx.length) broadcast({ t: 'fx', list: fx });   // damage numbers everyone can see

  // process logged-out characters lingering in the world
  for (const [pid, info] of lingering) {
    const wp = world.players.get(pid);
    if (!wp) { lingering.delete(pid); continue; }
    if (wp.dead) {                                    // killed while logged out → real death
      world.dropLoot(pid, gearFromProfile(accounts[info.user]), wp.x, wp.z, true);
      wipeGear(accounts[info.user]); saveAccounts();
      world.removePlayer(pid); broadcast({ t: 'leave', id: pid }); lingering.delete(pid);
      console.log(`x ${info.user} was killed while logged out — gear dropped`);
    } else if (now >= info.removeAt) {                // survived the window → just leave
      const acc = accounts[info.user]; if (acc) { acc.profile = Object.assign(acc.profile, { x: wp.x, z: wp.z, hp: wp.hp }); saveAccounts(); }
      world.removePlayer(pid); broadcast({ t: 'leave', id: pid }); lingering.delete(pid);
      console.log(`- ${info.user} left`);
    }
  }

  const players = [];
  for (const s of clients.values()) if (s.authed) {
    const wp = world.players.get(s.id);                 // server-authoritative HP
    players.push({ id: s.id, user: s.user, x: s.state.x, z: s.state.z, ry: s.state.ry,
      hp: wp ? Math.round(wp.hp) : s.state.hp, maxhp: wp ? wp.maxhp : s.state.maxhp, appearance: s.state.appearance });
  }
  for (const [pid, info] of lingering) {                 // include lingering ghosts so others see them
    const wp = world.players.get(pid); if (!wp) continue;
    players.push({ id: pid, user: info.user, x: wp.x, z: wp.z, ry: wp.ry, hp: Math.round(wp.hp), maxhp: wp.maxhp, appearance: info.appearance });
  }
  if (players.length) {
    const w = world.snapshot();
    broadcast({ t: 'snapshot', players, enemies: w.enemies, loot: w.loot });
  }
  for (const ev of events) { const w = wsById(ev.pid); if (w) send(w, ev); } // xp / death notices
}, TICK_MS);

httpServer.listen(PORT, HOST, () => {
  console.log(`\n  Gunscape dedicated server`);
  console.log(`  WebSocket + game client → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  console.log(`  Share ws://<your-ip>:${PORT} with friends to connect.\n`);
});
