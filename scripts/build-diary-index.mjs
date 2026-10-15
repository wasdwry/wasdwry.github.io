import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { parseDiary } from '../assets/diary-core.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = await Promise.all(entries.map(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : /\.md$/i.test(entry.name) ? [resolve(directory, entry.name)] : []));
  return result.flat();
}
const entries = await Promise.all((await files(resolve(root, 'diary'))).map(async file => {
  const markdown = await readFile(file, 'utf8');
  const entry = parseDiary(markdown, relative(root, file).split(sep).join('/'));
  return { ...entry, version: createHash('sha256').update(markdown).digest('hex').slice(0, 16) };
}));
entries.sort((a, b) => b.date.localeCompare(a.date) || b.path.localeCompare(a.path));
const index = { version: 1, items: entries.map(({ body, ...entry }) => entry) };
const search = { version: 1, items: entries.map(entry => ({ path: entry.path, text: (entry.title + '\n' + entry.body).toLocaleLowerCase() })) };
for (const [name, data] of [['diary-index', index], ['diary-search', search]]) {
  await writeFile(resolve(root, 'assets', name + '.json'), JSON.stringify(data) + '\n');
}
console.log('Updated diary directory and search index: ' + entries.length + ' entries.');
