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

console.log(`Built dist/ (${FILES.filter(f => existsSync(join(DIST, f))).join(', ')} + ${DIRS.join(', ')} + cityofeyes)`);
