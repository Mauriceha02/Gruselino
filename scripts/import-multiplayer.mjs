import { readFile, readdir, mkdir, copyFile, rm, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('multiplayer.json', root), 'utf8'));
if (config.repository !== 'Mauriceha02/Game-Multiplayer' || !/^[a-f0-9]{40}$/.test(config.revision)) throw new Error('Ungültige Multiplayer-Version.');
const path = resolve(process.env.MULTIPLAYER_SOURCE ?? fileURLToPath(new URL('../Game-Multiplayer/', root)));
const source = pathToFileURL(path + '/');
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim() !== config.revision) throw new Error(`Game-Multiplayer muss auf ${config.revision} stehen.`);
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: source, encoding: 'utf8' }).trim()) throw new Error('Game-Multiplayer hat uncommittete Änderungen.');
execFileSync('npm', ['test'], { cwd: source, stdio: 'inherit' });
const destination = new URL('public/network/', root);
await rm(destination, { recursive: true, force: true }); await mkdir(destination, { recursive: true });
for (const entry of await readdir(new URL('bundle/app/network/', source), { withFileTypes: true })) {
  if (!entry.isFile() || entry.isSymbolicLink() || !/^[a-z-]+\.js$/.test(entry.name)) throw new Error('Ungültige Netzwerk-Datei.');
  const file = new URL(`bundle/app/network/${entry.name}`, source);
  if ((await lstat(file)).isSymbolicLink()) throw new Error('Ungültige Netzwerk-Datei.');
  await copyFile(file, new URL(entry.name, destination));
}
console.log(`Game-Multiplayer eingebunden: ${config.revision.slice(0, 7)}.`);
