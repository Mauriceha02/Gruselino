import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir, copyFile, rm, lstat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const serviceModule = await readFile(new URL('public/network/service.js', root), 'utf8');
const serviceMatch = /^export const SERVICE_URL = (null|"[^"]+");\n$/.exec(serviceModule);
if (!serviceMatch) throw new Error('Ungültiger Verbindungsdienst.');
const service = JSON.parse(serviceMatch[1]);
if (service !== null && !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev$/.test(service)) throw new Error('Ungültiger Verbindungsdienst.');

async function regular(path, directory = false) {
  const parts = path.replace(/\/$/, '').split('/');
  for (let index = 0; index < parts.length; index++) {
    const name = parts.slice(0, index + 1).join('/');
    const entry = await lstat(new URL(name, root));
    if (entry.isSymbolicLink() || (index < parts.length - 1 || directory ? !entry.isDirectory() : !entry.isFile())) throw new Error(`Kein regulärer Build-Pfad: ${name}`);
  }
}
async function files(directory, allowed) {
  await regular(directory, true);
  const result = [];
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    const path = `${directory}${entry.name}`;
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) throw new Error(`Nicht zur Veröffentlichung freigegeben: ${path}`);
    if (entry.isDirectory()) result.push(...await files(`${path}/`, allowed));
    else if (entry.isFile() && allowed.test(entry.name)) result.push(path);
    else throw new Error(`Nicht zur Veröffentlichung freigegeben: ${path}`);
  }
  return result;
}
const release = process.env.GRUSELINO_RELEASE_NUMBER;
if (release !== undefined && (!/^[1-9]\d*$/.test(release) || !Number.isSafeInteger(Number(release)))) throw new Error('Ungültige Versionsnummer.');
const version = `1.0.0.${release ?? 1}`;
const mappings = [
  ['index.html', 'index.html'], ['manifest.webmanifest', 'manifest.webmanifest'],
  ['src/ui/gruselino.css', 'assets/gruselino.css'], ['src/ui/standalone.css', 'assets/standalone.css'],
  ...await files('public/assets/', /\.(?:svg|png)$/),
  ...await files('public/app/', /\.js$/),
  ...await files('public/network/', /\.js$/),
].map(entry => typeof entry === 'string' ? [entry, entry.replace(/^public\//, '')] : entry);
for (const [source] of mappings) await regular(source);
await regular('src/storage/service-worker.js');
for (const output of ['dist/', 'bundle/']) await rm(new URL(output, root), { recursive: true, force: true });
for (const [source, target] of mappings) {
  const dist = new URL(`dist/${target}`, root);
  await mkdir(new URL('./', dist), { recursive: true });
  if (source === 'index.html') await writeFile(dist, (await readFile(new URL(source, root), 'utf8')).replace('{{VERSION}}', version).replace("connect-src 'self'", "connect-src 'self'" + (service ? ' ' + service : '')));
  else await copyFile(new URL(source, root), dist);
  if (target.startsWith('network/') || target === 'assets/gruselino.css' || (/^assets\//.test(target) && /\.(?:svg|png)$/.test(target)) || (/^app\//.test(target) && !['app/main.js', 'app/ui/offline-app.js'].includes(target))) {
    const bundle = new URL(`bundle/${target}`, root);
    await mkdir(new URL('./', bundle), { recursive: true });
    await copyFile(dist, bundle);
  }
}
const workerSource = await readFile(new URL('src/storage/service-worker.js', root), 'utf8');
const assets = mappings.map(([, target]) => target).sort();
const hash = createHash('sha256').update(workerSource);
for (const path of assets) hash.update(path).update(await readFile(new URL(`dist/${path}`, root)));
const worker = `const REVISION = ${JSON.stringify(hash.digest('hex').slice(0, 20))};\nconst ASSETS = ${JSON.stringify(assets, null, 2)};\n${workerSource}`;
await writeFile(new URL('dist/sw.js', root), worker);
await writeFile(new URL('bundle/bundle.json', root), JSON.stringify({ version, entry: 'app/ui/game-app.js', css: 'assets/gruselino.css' }, null, 2) + '\n');
console.log(`Gruselino ${version}: dist/ für Vorschau, bundle/ für die Spiele-App.`);
