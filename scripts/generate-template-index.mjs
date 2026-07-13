import { readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../static/', import.meta.url);
const rootPath = fileURLToPath(root);
const supported = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const files = (await readdir(root)).filter(name => supported.has(extname(name).toLowerCase()));

function displayName(file) {
  return file.slice(0, -extname(file).length).replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
}

function familyName(file) {
  let name = displayName(file).split(/\s+-\s+/)[0];
  name = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:full clean|empty template|clean template|textless|transparent|template|blank|original|extended|edited|uncut|redraw|variant|vertical|horizontal|version|full|clean|hd|4k)\b/gi, ' ')
    .replace(/\b(?:v(?:ersion)?\s*)?\d+\b/gi, ' ')
    .replace(/\b\d+\s*panels?\b/gi, ' ')
    .replace(/[“”"'_:|/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name || displayName(file);
}

const initial = new Map();
for (const file of files) {
  const family = familyName(file);
  const key = family.toLocaleLowerCase('en');
  if (!initial.has(key)) initial.set(key, { name: family, variants: [] });
  initial.get(key).variants.push({ name: displayName(file), file });
}

// Merge close naming variations only when they share a meaningful two-word
// prefix and most of their title words. This catches variants without turning
// every "Cat …" or "Man …" template into one giant family.
const groups = [...initial.values()].sort((a, b) => a.name.localeCompare(b.name));
const removed = new Set();
const words = value => value.toLowerCase().split(/\s+/).filter(word => word.length > 1);
for (let i = 0; i < groups.length; i++) {
  if (removed.has(i)) continue;
  const a = words(groups[i].name);
  for (let j = i + 1; j < groups.length; j++) {
    if (removed.has(j)) continue;
    const b = words(groups[j].name);
    if (a[0] !== b[0] || a[1] !== b[1]) continue;
    const common = a.filter(word => b.includes(word)).length;
    if (common / Math.min(a.length, b.length) < .72) continue;
    groups[i].variants.push(...groups[j].variants);
    removed.add(j);
  }
}

const catalog = groups.filter((_, index) => !removed.has(index)).map(group => ({
  ...group,
  variants: group.variants.sort((a, b) => a.name.localeCompare(b.name))
}));

const output = {
  generated: new Date().toISOString(),
  templateCount: files.length,
  familyCount: catalog.length,
  families: catalog
};
await writeFile(join(rootPath, 'templates.json'), JSON.stringify(output));
await writeFile(join(rootPath, 'templates.js'), `window.MEME_TEMPLATE_CATALOG=${JSON.stringify(output)};`);
console.log(`Indexed ${files.length} templates in ${catalog.length} families.`);
