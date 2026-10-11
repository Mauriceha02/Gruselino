import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('dist/sw.js', root), 'utf8');
const assets = JSON.parse(source.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);

test('offline cache contains the module, eight figures, styles and install icons under any subpath', async () => {
  for (const scope of ['https://example.test/', 'https://example.test/Gruselino/']) {
    const listeners = new Map(); const entries = new Map();
    const cache = {
      async addAll(requests) { for (const request of requests) entries.set(request.url, { body: request.url }); },
      async match(url) { return entries.get(url); }, async keys() { return [...entries.keys()].map(url => ({ url })); },
    };
    runInNewContext(source, {
      URL, Set, Promise, Request: class { constructor(url) { this.url = url; } },
      fetch() { throw new Error('Network disabled'); },
      caches: { async open() { return cache; }, async keys() { return []; } },
      self: { registration: { scope }, clients: { async claim() {} }, addEventListener(type, callback) { listeners.set(type, callback); } },
    });
    let install; listeners.get('install')({ waitUntil(promise) { install = promise; } }); await install;
    for (const suffix of ['?offline=1', '#gruselino', '?offline=1#gruselino?invite=private']) {
      let home; listeners.get('fetch')({ request: { url: scope + suffix, method: 'GET', mode: 'navigate' }, respondWith(promise) { home = promise; } });
      assert.equal((await home).body, scope + 'index.html');
    }
    for (const path of assets) {
      let response; listeners.get('fetch')({ request: { url: scope + path, method: 'GET', mode: 'cors' }, respondWith(promise) { response = promise; } });
      assert.equal((await response).body, scope + path);
    }
    assert(assets.includes('assets/ghost.svg')); assert(assets.includes('app/ui/game-app.js'));
    for (const path of ['app/ui/local-game.js', 'app/ui/solo-game.js', 'app/game/local-match.js', 'network/peer.js', 'network/signals.js', 'network/protocol.js']) assert(assets.includes(path), path);
    assert(!assets.includes('PLAN.md')); assert(!assets.includes('.git/config'));
  }
});

test('standalone uses a strict CSP, and the integration module contains no service-worker registration', async () => {
  const html = await readFile(new URL('dist/index.html', root), 'utf8');
  assert(html.includes("script-src 'self'; script-src-attr 'none'"));
  assert(html.includes('no-referrer')); assert(!html.includes('{{VERSION}}'));
  const module = await readFile(new URL('bundle/app/ui/game-app.js', root), 'utf8');
  assert(module.includes('export function mountGruselino'));
  assert(!module.includes('serviceWorker.register'));
  await assert.rejects(readFile(new URL('bundle/app/main.js', root)), { code: 'ENOENT' });
  for (const size of [180, 192, 512]) {
    const png = await readFile(new URL(`dist/assets/icon-${size}.png`, root));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});

test('private files in the asset folder prevent publication', async () => {
  const path = new URL('public/assets/private.pem', root);
  try {
    await writeFile(path, 'dummy content');
    assert.throws(() => execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'pipe' }), /Nicht zur Veröffentlichung freigegeben/);
  } finally { await rm(path, { force: true }); }
});
