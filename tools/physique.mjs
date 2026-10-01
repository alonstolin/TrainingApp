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
const height = Number(flags['--height'] ?? 1568);
if (!Number.isFinite(fps) || fps <= 0) die('--fps must be a positive number.');
if (!Number.isFinite(height) || height < 200) die('--height must be at least 200.');

// Output folder is named by DATE, because that is how the protocol refers to a
// session and "IMG_3699" is not a date. A clip already named 2026-10-01.mov
// keeps its name; anything else is dated from the file's own timestamp, which
// for a phone clip is when it was recorded.
const stem = path.basename(file).replace(/\.[^.]+$/, '');
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const folder = /^\d{4}-\d{2}-\d{2}$/.test(stem) ? stem : isoDay(fs.statSync(file).mtime);
const outDir = path.resolve(flags['--out'] ?? path.join(path.dirname(file), folder));
const framesDir = path.join(outDir, 'frames');
fs.mkdirSync(framesDir, { recursive: true });

const run = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

// ---- frames
// -vf scale: -2 keeps the aspect ratio and an even width (h264 sources often
// need it); q:v 3 is visually clean at a fraction of the size of q 1.
//
// 1568 is the long edge a vision model resizes to, so anything larger is
// discarded on read and anything smaller is detail given away for nothing. It
// matters more here than it sounds: a full-body frame 900px tall leaves the
// torso about 250px wide, and a lat width difference worth acting on is a few
// percent of that. The source is 4K; the ceiling is the only sensible default.
run(['-i', file, '-vf', `fps=${fps},scale=-2:${height}`, '-q:v', '3', path.join(framesDir, 'frame-%03d.jpg')]);

const frames = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).sort();
if (!frames.length) {
  console.error('ffmpeg produced no frames — is that file really a video?');
  process.exit(1);
}

// ---- contact sheet
//
// Deliberately NOT numbered in the image. Burning an index in needs ffmpeg's
// drawtext, which needs freetype, which Homebrew's ffmpeg is built without —
// and sending someone to a custom build for a frame number is a bad trade. The
// legend below does the same job: the montage is strictly row-major in filename
// order, so a position in the grid maps to a filename by arithmetic.
const cols = Math.min(6, frames.length);
const rows = Math.ceil(frames.length / cols);
const contact = path.join(outDir, 'contact.jpg');
run([
  '-i', path.join(framesDir, 'frame-%03d.jpg'),
  '-vf', `scale=-2:320,tile=${cols}x${rows}:margin=6:padding=6:color=black`,
  '-frames:v', '1',
  '-q:v', '3',
  contact,
]);

// The legend lives next to the sheet so whoever reads the folder — me, the
// agent, or you in six months — can convert "second image on row three" into a
// filename without counting tiles.
const legend = [
  `contact.jpg — ${frames.length} frames, ${cols} per row, row-major (left to right, top to bottom).`,
  `Frames were taken at ${fps} fps, so each row covers about ${(cols / fps).toFixed(0)}s.`,
  '',
  ...Array.from({ length: rows }, (_, r) => {
    const first = frames[r * cols];
    const last = frames[Math.min((r + 1) * cols, frames.length) - 1];
    return `  row ${r + 1}: ${first} … ${last}`;
  }),
  '',
  'Open the individual files in frames/ for anything worth judging — the tiles',
  'are thumbnails and will not support a call on symmetry.',
].join('\n');
fs.writeFileSync(path.join(outDir, 'contact.txt'), `${legend}\n`);

const kb = (p) => `${Math.round(fs.statSync(p).size / 1024)} KB`;
const rel = (p) => path.relative(ROOT, p);
console.log(`${frames.length} frames at ${fps} fps → ${rel(framesDir)}/ (${kb(path.join(framesDir, frames[0]))} each)`);
console.log(`contact sheet → ${rel(contact)} (${kb(contact)}) · ${cols} per row, row-major`);
console.log(`legend        → ${rel(path.join(outDir, 'contact.txt'))}`);
console.log('\nRead the contact sheet first, pick the squarest frame for each pose, then open those individually.');
