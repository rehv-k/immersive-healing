// check-licenses — credits.json allowlist validation (SRS §5.3, v1.1 SPDX allowlist).
// Unknown values (typos included) and -NC / -ND patterns fail the build.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALLOW = new Set(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-3.0', 'Pexels', 'Pixabay', 'MIT', 'Zlib', 'OFL-1.1']);
const REJECT_PATTERNS = [/-NC/i, /-ND/i];

const raw = readFileSync(join(process.cwd(), 'src', 'data', 'credits.json'), 'utf8');
let entries;
try {
  entries = JSON.parse(raw);
} catch (e) {
  console.error('[check-licenses] credits.json parse error');
  process.exit(1);
}
const bad = [];
for (const c of entries) {
  if (typeof c.license !== 'string' || !c.title) {
    bad.push(`malformed entry: ${JSON.stringify(c).slice(0, 60)}`);
    continue;
  }
  if (REJECT_PATTERNS.some((p) => p.test(c.license))) bad.push(`${c.title}: rejected license ${c.license}`);
  else if (!ALLOW.has(c.license)) bad.push(`${c.title}: license '${c.license}' not in allowlist`);
}
if (bad.length) {
  console.error('[check-licenses] FAILED');
  for (const b of bad) console.error('  -', b);
  process.exit(1);
}
console.log(`[check-licenses] OK — ${entries.length} entries`);
