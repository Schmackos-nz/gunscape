#!/usr/bin/env node
/* Regenerates patchnotes.js from git history so the in-game version chip +
 * changelog update on every commit. Run by the prepare-commit-msg hook (which
 * passes the in-progress commit message via --msg-file) and usable manually.
 *
 *   node scripts/changelog.mjs [--msg-file <path>]
 *
 * Version scheme: 1.0.<build>, where <build> = total commit count (incl. the
 * one being made). Each commit becomes a changelog entry (subject + body bullets).
 */
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'patchnotes.js');
const MAX = 40;

function sh(cmd) { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }
const esc = s => String(s).replace(/\s+/g, ' ').trim();   // normalize whitespace; HTML-escaped client-side

// in-progress commit (from the hook's message file)
let pending = null;
const mi = process.argv.indexOf('--msg-file');
if (mi >= 0 && process.argv[mi + 1] && existsSync(process.argv[mi + 1])) {
  const lines = readFileSync(process.argv[mi + 1], 'utf8').split('\n').filter(l => !l.startsWith('#'));
  const first = lines.find(l => l.trim());
  if (first) {
    const body = lines.slice(lines.indexOf(first) + 1)
      .map(l => l.trim()).filter(Boolean)
      .filter(l => !/^Co-Authored-By/i.test(l) && !/Generated with|Claude Code/i.test(l) && l !== '\u{1F916}');
    pending = { subject: first.trim(), body };
  }
}

// hide behind-the-scenes / infra commits from the in-game patch notes
const INFRA = /wrangler|cloudflare|account_id|package-lock|lock ?file|\bdeploy\b|\bci\b|workflow|secret|\bhooks?\b|prepare-commit|post-commit|gitignore|claude\.md|build script|node_modules|crlf|lf will/i;
const gameNotes = body => body.filter(l => !INFRA.test(l));

const count = parseInt(sh('git rev-list --count HEAD') || '0', 10);
let build = count + (pending ? 1 : 0);
const today = new Date().toISOString().slice(0, 10);

const patches = [];
if (pending) { if (!INFRA.test(pending.subject)) patches.push({ version: '1.0.' + build, date: today, title: esc(pending.subject), notes: gameNotes(pending.body).map(esc) }); build--; }

const raw = sh(`git log --pretty=format:%h%x1f%ad%x1f%s --date=short -n ${MAX}`);
if (raw) for (const line of raw.split('\n')) {
  const parts = line.split('\x1f'); const d = parts[1], s = parts[2];
  if (pending && s === pending.subject) { /* already handled / skip dup */ build--; continue; }
  if (!INFRA.test(s)) patches.push({ version: '1.0.' + build, date: d, title: esc(s), notes: [] }); // game-only
  build--;
}

const data = { version: patches.length ? patches[0].version : '1.0.0', generated: today, patches };
writeFileSync(OUT, 'window.PATCHNOTES=' + JSON.stringify(data, null, 1) + ';\n');
console.log('patchnotes.js -> ' + data.version + ' (' + patches.length + ' entries)');
