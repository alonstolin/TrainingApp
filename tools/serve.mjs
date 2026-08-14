#!/usr/bin/env node
/**
 * Static dev server.
 *
 * Serves the app at /TrainingApp/ — the SAME subpath GitHub Pages uses.
 * Testing at the server root hides every absolute-path bug until deploy, which
 * is exactly the class of bug that is miserable to debug on a phone.
 *
 * Service workers are allowed on http://localhost (secure-context exception),
 * so no local TLS is needed.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_PATH ?? '/TrainingApp';
const PORT = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (urlPath === BASE) {
    res.writeHead(302, { Location: `${BASE}/` });
    res.end();
    return;
  }
  if (!urlPath.startsWith(`${BASE}/`)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Not found. The app is served at ${BASE}/`);
    return;
  }

  let rel = urlPath.slice(BASE.length + 1);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';

  const file = path.join(ROOT, rel);
  // Refuse to serve outside the repo.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      // Hash routing means every route is index.html; nothing should 404 to a
      // navigation, but a missing asset must fail loudly rather than silently
      // returning HTML that then fails to parse as JS.
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      // Mimic GitHub Pages' caching so SW update behaviour is realistic locally.
      'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=600',
      'Service-Worker-Allowed': `${BASE}/`,
    });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Training app → http://localhost:${PORT}${BASE}/\n`);
});
