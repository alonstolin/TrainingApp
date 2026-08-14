#!/usr/bin/env node
/**
 * Regenerates the service worker precache list and version stamp.
 *
 * Hand-maintaining a precache list is the classic way a PWA "works on my machine"
 * and then boots to a blank screen offline, because one newly-added module was
 * never cached. Generating it makes that failure structurally impossible.
 *
 *   node tools/gen-sw-manifest.mjs           rewrite sw.js + src/version.js
 *   node tools/gen-sw-manifest.mjs --check   exit 1 if either is stale (CI)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const EXCLUDE_DIRS = new Set(['node_modules', 'tests', 'tools', '.git', '.github', 'test-results', 'playwright-report']);
const INCLUDE_EXT = new Set(['.html', '.js', '.css', '.webmanifest', '.png', '.svg', '.ico']);
const EXCLUDE_FILES = new Set(['sw.js', 'package.json', 'package-lock.json']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.nojekyll') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      if (!INCLUDE_EXT.has(path.extname(entry.name))) continue;
      out.push(full);
    }
  }
  return out;
}

const files = walk(ROOT).sort();
const rels = files.map((f) => `./${path.relative(ROOT, f).split(path.sep).join('/')}`);

// './' and './index.html' are the same document; both keys are needed because a
// navigation to the scope root is looked up as './'.
const precache = ['./', ...rels];

const hash = crypto.createHash('sha256');
for (const f of files) hash.update(fs.readFileSync(f));
const stamp = new Date();
const version = `${stamp.getFullYear()}.${String(stamp.getMonth() + 1).padStart(2, '0')}.${String(
  stamp.getDate(),
).padStart(2, '0')}-${hash.digest('hex').slice(0, 8)}`;

const swPath = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');

const replaceBlock = (src, start, end, body) => {
  const re = new RegExp(`(${start}\\n)[\\s\\S]*?(\\n${end})`);
  if (!re.test(src)) throw new Error(`Marker ${start} not found in sw.js`);
  return src.replace(re, `$1${body}$2`);
};

const listBody = `const PRECACHE = [\n${precache.map((p) => `  '${p}',`).join('\n')}\n];`;
let next = replaceBlock(sw, '// <<<PRECACHE-START>>>', '// <<<PRECACHE-END>>>', listBody);
next = replaceBlock(
  next,
  '// <<<GENERATED-VERSION-START>>>',
  '// <<<GENERATED-VERSION-END>>>',
  `const VERSION = '${version}';`,
);

const versionPath = path.join(ROOT, 'src', 'version.js');
const versionSrc = `/** Stamped by tools/gen-sw-manifest.mjs. Keep in sync with the VERSION in sw.js. */\nexport const APP_VERSION = '${version}';\n`;

if (CHECK) {
  const currentList = sw.match(/\/\/ <<<PRECACHE-START>>>\n([\s\S]*?)\n\/\/ <<<PRECACHE-END>>>/)?.[1] ?? '';
  const nextList = next.match(/\/\/ <<<PRECACHE-START>>>\n([\s\S]*?)\n\/\/ <<<PRECACHE-END>>>/)?.[1] ?? '';
  if (currentList.trim() !== nextList.trim()) {
    console.error('✖ sw.js precache list is stale. Run: npm run build:sw');
    const cur = new Set(currentList.match(/'([^']+)'/g) ?? []);
    const nxt = new Set(nextList.match(/'([^']+)'/g) ?? []);
    for (const f of nxt) if (!cur.has(f)) console.error(`  + missing from precache: ${f}`);
    for (const f of cur) if (!nxt.has(f)) console.error(`  - stale entry: ${f}`);
    process.exit(1);
  }
  console.log(`✓ sw.js precache list is current (${precache.length} files)`);
  process.exit(0);
}

fs.writeFileSync(swPath, next);
fs.writeFileSync(versionPath, versionSrc);
console.log(`✓ precached ${precache.length} files · version ${version}`);
