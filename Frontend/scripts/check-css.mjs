import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'src');
const baselinePath = join(root, 'scripts', 'css-unused-baseline.json');
const supportedThemes = new Set(['light', 'dark-sidebar']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.html']);

// Classes produced from API values or template expressions do not always appear
// as complete literals in JSX. Keep this list intentionally small.
const dynamicClassAllowlist = new Set([
  'active',
  'blocked',
  'cancelado',
  'collapsed',
  'completado',
  'copied',
  'delayed',
  'en_operacion',
  'error',
  'expanded',
  'green',
  'has-image',
  'in_operacion',
  'info',
  'inline',
  'is-refreshing',
  'neutral',
  'offline',
  'own',
  'owned',
  'pago_confirmado',
  'pendiente_pago',
  'pending',
  'selected',
  'success',
  'warning',
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function extractClasses(selector) {
  const classes = new Set();
  const pattern = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
  let match;
  while ((match = pattern.exec(selector))) classes.add(match[1]);
  return classes;
}

function targetClasses(selector) {
  const targets = [];

  for (const item of selector.split(',')) {
    const compounds = item
      .trim()
      .split(/\s+|(?=[>+~])|(?<=[>+~])/)
      .filter((part) => part && !/^[>+~]$/.test(part));
    const target = compounds.at(-1) ?? '';
    if (target.includes('::')) continue;

    const classes = [...target.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)];
    if (classes.length) targets.push(classes.at(-1)[1]);
  }

  return targets;
}

function rememberTarget(map, className, location) {
  if (!map.has(className)) map.set(className, []);
  map.get(className).push(location);
}

const allFiles = await listFiles(sourceDir);
const cssFiles = allFiles.filter((path) => extname(path) === '.css');
const sourceFiles = allFiles.filter((path) => sourceExtensions.has(extname(path)));
const sourceText = (await Promise.all(sourceFiles.map((path) => readFile(path, 'utf8')))).join('\n');
const errors = [];
const unusedClasses = new Map();
const relativeTargets = new Map();
const offsetTargets = new Map();
let selectorCount = 0;

for (const path of cssFiles) {
  const css = await readFile(path, 'utf8');
  const displayPath = relative(root, path);

  for (const match of css.matchAll(/!important\b/g)) {
    errors.push(`${displayPath}:${lineForOffset(css, match.index)}: no se permite !important`);
  }

  for (const match of css.matchAll(/\[data-theme\s*=\s*["']?([^"'\]\s]+)["']?\]/g)) {
    if (!supportedThemes.has(match[1])) {
      errors.push(`${displayPath}:${lineForOffset(css, match.index)}: tema no soportado "${match[1]}"`);
    }
  }

  let stylesheet;
  try {
    stylesheet = postcss.parse(css, { from: path });
  } catch (error) {
    errors.push(`${displayPath}: CSS invalido: ${error.reason ?? error.message}`);
    continue;
  }

  stylesheet.walkRules((rule) => {
    selectorCount += 1;
    const targets = targetClasses(rule.selector);

    rule.walkDecls((declaration) => {
      const location = `${displayPath}:${declaration.source?.start?.line ?? rule.source?.start?.line ?? 1}`;
      if (declaration.prop === 'position' && declaration.value.trim() === 'relative') {
        for (const className of targets) rememberTarget(relativeTargets, className, location);
      }
      if (declaration.prop === 'top' && declaration.value.trim() !== 'auto') {
        for (const className of targets) rememberTarget(offsetTargets, className, location);
      }
    });

    for (const className of extractClasses(rule.selector)) {
      if (dynamicClassAllowlist.has(className)) continue;
      if (!sourceText.includes(className)) {
        if (!unusedClasses.has(className)) {
          unusedClasses.set(className, `${displayPath}:${rule.source?.start?.line ?? 1}`);
        }
      }
    }
  });
}

for (const [className, relativeLocations] of relativeTargets) {
  const topLocations = offsetTargets.get(className);
  if (!topLocations) continue;
  errors.push(
    `${relativeLocations[0]}: ".${className}" usa position: relative y tambien top en `
    + `${topLocations[0]}; esta combinacion puede desplazar el componente fuera de su flujo`,
  );
}

if (errors.length) {
  console.error(`Auditoria CSS: ${errors.length} problema(s)\n`);
  console.error(errors.join('\n'));
  process.exit(1);
}

if (process.argv.includes('--write-baseline')) {
  const baseline = [...unusedClasses.keys()].sort();
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline CSS actualizado: ${baseline.length} clases sin uso conocidas`);
  process.exit(0);
}

const baseline = existsSync(baselinePath)
  ? new Set(JSON.parse(await readFile(baselinePath, 'utf8')))
  : new Set();

for (const [className, location] of unusedClasses) {
  if (!baseline.has(className)) {
    errors.push(`${location}: clase sin uso nueva ".${className}"`);
  }
}

for (const className of baseline) {
  if (!unusedClasses.has(className)) {
    errors.push(
      `scripts/css-unused-baseline.json: entrada resuelta ".${className}"; `
      + 'ejecuta npm run check:css:baseline',
    );
  }
}

if (errors.length) {
  console.error(`Auditoria CSS: ${errors.length} problema(s)\n`);
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  `Auditoria CSS OK: ${cssFiles.length} archivos, ${selectorCount} reglas, `
  + `${unusedClasses.size} clases obsoletas conocidas`,
);
