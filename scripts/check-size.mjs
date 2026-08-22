// check-size — JS bundle gzip budget <= 300KB (NFR-8 / SRS-DEP-4). Media excluded.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT = 300 * 1024;
const dist = join(process.cwd(), 'dist', 'assets');
let total = 0;
try {
  for (const name of readdirSync(dist)) {
    if (!name.endsWith('.js')) continue;
    const p = join(dist, name);
    if (!statSync(p).isFile()) continue;
    total += gzipSync(readFileSync(p)).length;
  }
} catch (e) {
  console.error('[check-size] dist/assets not found — run vite build first');
  process.exit(1);
}
const kb = (total / 1024).toFixed(1);
if (total > LIMIT) {
  console.error(`[check-size] FAILED — JS gzip ${kb}KB > 300KB`);
  process.exit(1);
}
console.log(`[check-size] OK — JS gzip ${kb}KB / 300KB`);
