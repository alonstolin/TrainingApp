#!/usr/bin/env node
/**
 * Turn a weekly posing clip into frames the physique-analyst can read.
 *
 *   node tools/physique.mjs coach/data/physique/2026-10-05.mov
 *   node tools/physique.mjs <video> --fps 2 --out coach/data/physique/2026-10-05
 *
 * Why frames and not the video: nothing in this toolchain reads video, and more
 * importantly a still is what an assessment should rest on — you can say which
 * frame you judged and why. Extracting several per second means the analyst can
 * throw away the ones where the pose is crooked instead of hoping the single
 * still that got taken happened to be square, which is the whole reason a video
 * beats a photo here.
 *
 * The contact sheet is the other half of that: one montage showing every frame
 * at a glance, so the analyst reads ONE image to choose, then opens only the
 * two or three that are worth reading properly.
 *
 * Everything lands under coach/data/, which is gitignored — this repo is public
 * and none of it belongs in git.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node tools/physique.mjs <video> [--out dir] [--fps 1] [--height 900]';

const BOOLEAN_FLAGS = new Set(['--help']);

function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      rest.push(a);
      continue;
    }
    if (BOOLEAN_FLAGS.has(a)) {
      flags[a] = true;
      continue;
    }
    const v = argv[i + 1];
    if (v == null || v.startsWith('--')) die(`${a} needs a value.`);
    flags[a] = v;
    i++;
  }
  return { file: rest[0], flags };
}

function die(message, code = 2) {
  console.error(message);
  console.error(USAGE);
  process.exit(code);
}

const { file, flags } = parseArgs(process.argv.slice(2));
if (flags['--help']) {
  console.log(USAGE);
  process.exit(0);
}
if (!file) die('no video given.');
if (!fs.existsSync(file)) die(`no such file: ${file}`, 1);

// ffmpeg is the only thing that can do this. macOS ships `sips`, which handles
// images only, so there is no fallback worth pretending to have.
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).error) {
  console.error('ffmpeg is not installed, and it is the only tool here that can read video.');
  console.error('  brew install ffmpeg');
  process.exit(1);
}

const fps = Number(flags['--fps'] ?? 1);
const height = Number(flags['--height'] ?? 900);
if (!Number.isFinite(fps) || fps <= 0) die('--fps must be a positive number.');
if (!Number.isFinite(height) || height < 200) die('--height must be at least 200.');

// Default output is a folder named for the clip, beside it.
const stem = path.basename(file).replace(/\.[^.]+$/, '');
const outDir = path.resolve(flags['--out'] ?? path.join(path.dirname(file), stem));
const framesDir = path.join(outDir, 'frames');
fs.mkdirSync(framesDir, { recursive: true });

const run = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

// ---- frames
// -vf scale: -2 keeps the aspect ratio and an even width (h264 sources often
// need it); q:v 3 is visually clean at a fraction of the size of q 1.
run(['-i', file, '-vf', `fps=${fps},scale=-2:${height}`, '-q:v', '3', path.join(framesDir, 'frame-%03d.jpg')]);

const frames = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).sort();
if (!frames.length) {
  console.error('ffmpeg produced no frames — is that file really a video?');
  process.exit(1);
}

// ---- contact sheet, numbered so a frame can be named in the report
const cols = Math.min(6, frames.length);
const rows = Math.ceil(frames.length / cols);
const contact = path.join(outDir, 'contact.jpg');
run([
  '-i', path.join(framesDir, 'frame-%03d.jpg'),
  '-vf',
  [
    'scale=-2:320',
    // The index is burned in so the analyst can say "frame 7" and mean it.
    `drawtext=text='%{eif\\\\:n+1\\\\:d}':x=6:y=6:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`,
    `tile=${cols}x${rows}:margin=6:padding=6:color=black`,
  ].join(','),
  '-frames:v', '1',
  '-q:v', '3',
  contact,
]);

const kb = (p) => `${Math.round(fs.statSync(p).size / 1024)} KB`;
const rel = (p) => path.relative(ROOT, p);
console.log(`${frames.length} frames at ${fps} fps → ${rel(framesDir)}/ (${kb(path.join(framesDir, frames[0]))} each)`);
console.log(`contact sheet → ${rel(contact)} (${kb(contact)})`);
console.log('\nRead the contact sheet first, pick the squarest frame for each pose, then open those individually.');
