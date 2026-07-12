import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
const exists = async rel => { try { await fs.access(path.join(root, rel)); return true; } catch { return false; } };
const index = await read('index.html');
const app = await read('assets/js/app.js');
const serviceWorker = await read('service-worker.js');
const manifest = JSON.parse(await read('manifest.webmanifest'));

const ids = [...index.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const seen = new Set();
for (const id of ids) {
  if (seen.has(id)) errors.push(`index.html duplicate id: ${id}`);
  seen.add(id);
}
for (const match of app.matchAll(/querySelector\('#([^']+)'\)/g)) {
  if (!seen.has(match[1])) errors.push(`app.js selector not found in index.html: #${match[1]}`);
}

const localRefs = [...index.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(ref => !/^(https?:|#|mailto:)/.test(ref));
for (const ref of localRefs) {
  const clean = ref.replace(/^\.\//, '').split(/[?#]/)[0];
  if (clean && !(await exists(clean))) errors.push(`index.html missing local asset: ${clean}`);
}
for (const icon of manifest.icons || []) {
  if (!(await exists(icon.src))) errors.push(`manifest missing icon: ${icon.src}`);
}
for (const match of serviceWorker.matchAll(/'\.\/([^']+)'/g)) {
  const rel = match[1];
  if (rel && !(await exists(rel))) errors.push(`service-worker missing cached asset: ${rel}`);
}
if (!index.includes('leaflet@1.9.4')) errors.push('Leaflet stable version pin missing');
if (!index.includes('OpenStreetMap')) errors.push('OpenStreetMap attribution/dependency missing');
if (/((src|href)=")\//.test(index)) errors.push('Root-absolute URL found; GitHub project Pages may break');

if (errors.length) {
  console.error(`프로젝트 검증 실패: ${errors.length}건`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`프로젝트 검증 통과: ${ids.length} unique DOM ids, ${localRefs.length} local references, ${manifest.icons.length} PWA icons`);
