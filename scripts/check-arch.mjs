// check-arch — mechanical enforcement of the dependency rules (SRS §2.1 / §9.2 static layer).
//  * ui/ must not import scene/ or audio/ ; scene/ & audio/ must not import ui/
//  * only core/ may call store.coreSet / dispatch handler internals
//  * only core/inputSession.ts may touch pointer-lock / fullscreen APIs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(process.cwd(), 'src');
const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) check(p);
  }
}

function layerOf(rel) {
  const parts = rel.split(sep);
  return parts.length > 1 ? parts[0] : '(root)';
}

function check(file) {
  const rel = relative(SRC, file);
  const layer = layerOf(rel);
  const text = readFileSync(file, 'utf8');

  const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const imp of imports) {
    if (!imp.startsWith('.')) continue;
    const target = imp.replace(/^(\.\.\/)+|^\.\//g, '');
    const targetLayer = target.split('/')[0];
    const forbidden =
      (layer === 'ui' && (targetLayer === 'scene' || targetLayer === 'audio')) ||
      ((layer === 'scene' || layer === 'audio') && targetLayer === 'ui');
    if (forbidden) violations.push(`${rel}: forbidden import '${imp}' (${layer} -> ${targetLayer})`);
  }

  if (layer !== 'core' && /store\.coreSet\(/.test(text)) {
    violations.push(`${rel}: store.coreSet() outside core/`);
  }
  if (!/core[\\/]/.test(rel) || !rel.includes('inputSession')) {
    if (/requestPointerLock|exitPointerLock|requestFullscreen\(/.test(text)) {
      violations.push(`${rel}: pointer-lock/fullscreen API outside core/inputSession.ts`);
    }
  }
  if (/visibilitychange[\s\S]{0,120}suspend\(/.test(text)) {
    violations.push(`${rel}: visibilitychange->suspend() anti-pattern (SRS-AUD-7)`);
  }
  if (/\.loop\s*=\s*true/.test(text) && layer === 'scene' && /video/i.test(rel)) {
    violations.push(`${rel}: <video>.loop=true (loop is owned by swap logic, SRS-VID-2)`);
  }
}

walk(SRC);
if (violations.length) {
  console.error('[check-arch] FAILED');
  for (const v of violations) console.error('  -', v);
  process.exit(1);
}
console.log('[check-arch] OK');
