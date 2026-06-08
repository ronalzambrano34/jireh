import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const templatePath = join(root, 'sw-template.js');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
}

const files = (await listFiles(distDir))
  .filter((path) => !path.endsWith('/sw.js'))
  .map((path) => `/${relative(distDir, path).replaceAll('\\', '/')}`)
  .sort();

const template = await readFile(templatePath, 'utf8');
const versionHash = createHash('sha256');
for (const file of files) {
  versionHash.update(file);
  versionHash.update(await readFile(join(distDir, file.slice(1))));
}
const version = versionHash.digest('hex').slice(0, 12);
const serviceWorker = template
  .replace('__CACHE_NAME__', `jireh-pwa-${version}`)
  .replace('__PRECACHE_URLS__', JSON.stringify(files, null, 2));

await writeFile(join(distDir, 'sw.js'), serviceWorker);
console.log(`PWA cache ${version}: ${files.length} archivos`);
