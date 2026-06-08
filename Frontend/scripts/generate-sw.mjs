import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const templatePath = join(root, 'sw-template.js');
const base = `/${(process.env.VITE_BASE || '/').replace(/^\/+|\/+$/g, '')}${process.env.VITE_BASE && process.env.VITE_BASE !== '/' ? '/' : ''}`;

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
  .map((path) => ({
    path,
    url: `${base}${relative(distDir, path).replaceAll('\\', '/')}`,
  }))
  .sort((left, right) => left.url.localeCompare(right.url));

const template = await readFile(templatePath, 'utf8');
const versionHash = createHash('sha256');
for (const file of files) {
  versionHash.update(file.url);
  versionHash.update(await readFile(file.path));
}
const version = versionHash.digest('hex').slice(0, 12);
const serviceWorker = template
  .replace('__CACHE_NAME__', `jireh-pwa-${version}`)
  .replace('__APP_BASE__', base)
  .replace('__PRECACHE_URLS__', JSON.stringify(files.map((file) => file.url), null, 2));

await writeFile(join(distDir, 'sw.js'), serviceWorker);
console.log(`PWA cache ${version}: ${files.length} archivos`);
