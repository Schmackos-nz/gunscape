#!/usr/bin/env node
// No bundler needed — copy the static client into dist/ for Cloudflare.
import { rmSync, mkdirSync, copyFileSync, existsSync, cpSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// static files + dirs that make up the playable client
const FILES = ['index.html', 'classic-2d.html', 'patchnotes.js'];
const DIRS = ['shared'];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const f of FILES) {
  const src = join(ROOT, f);
  if (existsSync(src)) copyFileSync(src, join(DIST, f));
}
for (const d of DIRS) {
  const src = join(ROOT, d);
  if (existsSync(src)) cpSync(src, join(DIST, d), { recursive: true });
}

// City of Eyes is a separate Vite + TS app; build it and nest its output at
// dist/cityofeyes/ so it's served at /cityofeyes/.
const CE = join(ROOT, 'cityofeyes');
if (existsSync(join(CE, 'package.json'))) {
  console.log('Building cityofeyes/ ...');
  execSync('npm ci', { cwd: CE, stdio: 'inherit' });
  execSync('npm run build', { cwd: CE, stdio: 'inherit' });
  cpSync(join(CE, 'dist'), join(DIST, 'cityofeyes'), { recursive: true });
}

// Deck of Omens is a separate Vite + React app; build it and nest its output
// at dist/deckofomens/ so it's served at /deckofomens/.
const DOO = join(ROOT, 'deckofomens');
if (existsSync(join(DOO, 'package.json'))) {
  console.log('Building deckofomens/ ...');
  execSync('npm ci', { cwd: DOO, stdio: 'inherit' });
  execSync('npm run build', { cwd: DOO, stdio: 'inherit' });
  cpSync(join(DOO, 'dist'), join(DIST, 'deckofomens'), { recursive: true });
}

// Phonemic (text -> IPA) is plain static files, no build step — copy it
// straight to dist/IPAConverter/ so it's served at /IPAConverter/.
const IPA = join(ROOT, 'IPAConverter');
if (existsSync(join(IPA, 'index.html'))) {
  for (const sub of ['index.html', 'src']) {
    cpSync(join(IPA, sub), join(DIST, 'IPAConverter', sub), { recursive: true });
  }
}

// Fevercrawl is a single self-contained HTML file, no build step — copy it to
// dist/fevercrawl/ so it's served at /fevercrawl/.
const FEVER = join(ROOT, 'fevercrawl');
if (existsSync(join(FEVER, 'index.html'))) {
  mkdirSync(join(DIST, 'fevercrawl'), { recursive: true });
  copyFileSync(join(FEVER, 'index.html'), join(DIST, 'fevercrawl', 'index.html'));
}

console.log(`Built dist/ (${FILES.filter(f => existsSync(join(DIST, f))).join(', ')} + ${DIRS.join(', ')} + cityofeyes + deckofomens + IPAConverter + fevercrawl)`);
