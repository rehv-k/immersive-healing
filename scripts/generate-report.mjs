// generate-report — TC 커버리지 리포트 (방법론 파트 C의 Vitest 이식).
//  vitest 실행(JUnit XML) → TC-ID 집계 → docs/tc/*.md 대조 → docs/report/ci-report.md.
//  태깅 규약: 테스트 제목에 완전형 ID `[TC-<COMP>-NN]` 포함(복수 가능 — pytest 마커 인자 나열의 등가).
//  게이트: vitest 종료코드 그대로 + orphan(태그됐으나 문서 정의 없음) > 0 이면 exit 1 (하드닝, 방법론 부록3 #3).
//  주의: 커버리지 표는 TC 문서당 걸린 모든 스위트를 합산한다(방법론 §C.7 함정 5).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TC_DIR = join(ROOT, 'docs', 'tc');
const OUT = join(ROOT, 'docs', 'report', 'ci-report.md');

// 테스트 파일 → 담당 TC 문서 (새 테스트 파일은 여기 등록 — CLAUDE.md §9 동기화 표)
const SUITES = [
  { file: 'tests/sceneState.test.ts', tc: 'TC_COR_CoreStateSettings.md', component: 'COR — 상태 머신' },
  { file: 'tests/settings.test.ts', tc: 'TC_COR_CoreStateSettings.md', component: 'COR — 설정·프로필' },
  { file: 'tests/adaptation.test.ts', tc: 'TC_QLT_Adaptation.md', component: 'QLT — 품질 적응' },
  { file: 'tests/rendition.test.ts', tc: 'TC_VID_VideoRendition.md', component: 'VID — 렌디션 선택' },
];

const TC_ID_RE = /TC-([A-Z]+)-(\d+)/g;

function runVitest(junitPath) {
  const r = spawnSync(
    process.execPath,
    [join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--reporter=junit', `--outputFile=${junitPath}`],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
  );
  if (r.error) throw r.error;
  return r.status ?? 1;
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function parseJUnit(xml) {
  const byFile = new Map(); // file -> {passed,failed,skipped,cases:[{name,status,tcIds}]}
  const byTc = new Map(); // TC-ID -> {passed,failed,skipped,cases:[name]}
  const caseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const m of xml.matchAll(caseRe)) {
    const attrs = m[1];
    const body = m[2] ?? '';
    // 주의: `classname=`이 `name=` 패턴에 먼저 걸린다 — 반드시 공백 경계로 구분
    const name = decodeEntities(/\sname="([^"]*)"/.exec(attrs)?.[1] ?? '?');
    const classname = decodeEntities(/\sclassname="([^"]*)"/.exec(attrs)?.[1] ?? '?');
    const file = classname.replace(/\\/g, '/');
    const status = /<(failure|error)\b/.test(body) ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed';
    const tcIds = [...name.matchAll(TC_ID_RE)].map((t) => t[0]);
    const rec = byFile.get(file) ?? { passed: 0, failed: 0, skipped: 0, cases: [] };
    rec[status] += 1;
    rec.cases.push({ name, status, tcIds });
    byFile.set(file, rec);
    for (const id of tcIds) {
      const t = byTc.get(id) ?? { passed: 0, failed: 0, skipped: 0, cases: [] };
      t[status] += 1;
      t.cases.push(name);
      byTc.set(id, t);
    }
  }
  return { byFile, byTc };
}

function parseTcDocs() {
  // TC_<COMP>_*.md가 "정의한" ID 집합. 파일명 접두와 일치하는 ID만 취해 교차참조를 배제한다.
  const defined = new Map(); // COMP -> { doc, ids:Set }
  for (const f of readdirSync(TC_DIR).filter((n) => /^TC_[A-Z]+_.*\.md$/.test(n)).sort()) {
    const comp = f.split('_')[1];
    const text = readFileSync(join(TC_DIR, f), 'utf8');
    const ids = new Set([...text.matchAll(TC_ID_RE)].filter(([, c]) => c === comp).map(([id]) => id));
    if (ids.size) defined.set(comp, { doc: f, ids });
  }
  return defined;
}

function sortIds(ids) {
  return [...ids].sort((a, b) => {
    const [, ca, na] = /TC-([A-Z]+)-(\d+)/.exec(a);
    const [, cb, nb] = /TC-([A-Z]+)-(\d+)/.exec(b);
    return ca === cb ? Number(na) - Number(nb) : ca.localeCompare(cb);
  });
}

function main() {
  const tmp = join(tmpdir(), `ih-junit-${Date.now()}.xml`);
  const rc = runVitest(tmp);
  let xml;
  try {
    xml = readFileSync(tmp, 'utf8');
  } catch {
    console.error('[report] JUnit XML이 생성되지 않았다 — vitest 실행 실패');
    process.exit(rc || 1);
  }
  rmSync(tmp, { force: true });

  const { byFile, byTc } = parseJUnit(xml);
  const defined = parseTcDocs();

  // 집합 대조: uncovered = 정의 − 태그 / orphan = 태그 − 정의
  const taggedByComp = new Map();
  for (const id of byTc.keys()) {
    const comp = /TC-([A-Z]+)-/.exec(id)[1];
    (taggedByComp.get(comp) ?? taggedByComp.set(comp, new Set()).get(comp)).add(id);
  }
  const orphans = [];
  for (const [comp, ids] of taggedByComp) {
    const def = defined.get(comp)?.ids ?? new Set();
    for (const id of ids) if (!def.has(id)) orphans.push(id);
  }
  const uncovered = new Map(); // comp -> ids[]
  for (const [comp, { ids }] of defined) {
    const tagged = taggedByComp.get(comp) ?? new Set();
    const u = sortIds([...ids].filter((id) => !tagged.has(id)));
    if (u.length) uncovered.set(comp, u);
  }

  // SUITES 미등록 파일 경고 (방법론 §C.7 함정 4)
  const registered = new Set(SUITES.map((s) => s.file));
  const unregistered = [...byFile.keys()].filter((f) => !registered.has(f));

  const totals = { passed: 0, failed: 0, skipped: 0 };
  for (const rec of byFile.values()) for (const k of ['passed', 'failed', 'skipped']) totals[k] += rec[k];
  const coveredDocs = new Set();
  for (const s of SUITES) if (byFile.has(s.file)) coveredDocs.add(s.tc);

  const L = [];
  L.push('# TC 커버리지 리포트 (자동 생성 — 손 편집 금지)');
  L.push('');
  L.push(`> 생성: \`node scripts/generate-report.mjs\` · ${new Date().toISOString()}`);
  L.push('> 이 리포트는 **특정 실행의 evidence**다 — 요구·시험의 권위는 `docs/tc/` TC 문서다.');
  L.push('> 미커버에는 다른 레인(검사·시연·분석)이 포함된다 — 각 TC 문서 §3의 검증 방법 열 참조.');
  L.push('');
  L.push('## ① 요약');
  L.push('');
  L.push(`- 테스트 파일 ${byFile.size} · 테스트 ${totals.passed + totals.failed + totals.skipped} (통과 ${totals.passed} / 실패 ${totals.failed} / 건너뜀 ${totals.skipped})`);
  L.push(`- TC 문서 자동시험 연결 ${coveredDocs.size} / ${defined.size}`);
  L.push(`- **orphan ${orphans.length}건** (게이트: 0이어야 함) · 미커버 ${[...uncovered.values()].reduce((a, v) => a + v.length, 0)}건`);
  L.push('');
  L.push('## ② TC 문서 커버리지');
  L.push('');
  L.push('| TC 문서 | 자동시험 | 담당 테스트 파일 |');
  L.push('|---|---|---|');
  for (const [comp, { doc, ids }] of defined) {
    const suites = SUITES.filter((s) => s.tc === doc).map((s) => `\`${s.file}\``);
    const tagged = taggedByComp.get(comp) ?? new Set();
    let failedInComp = 0;
    for (const id of tagged) failedInComp += byTc.get(id)?.failed ?? 0;
    const mark = tagged.size === 0 ? '— (검사·시연 레인)' : failedInComp ? '❌' : `✅ ${tagged.size}/${ids.size}`;
    L.push(`| \`${doc}\` | ${mark} | ${suites.join(' · ') || '—'} |`);
  }
  L.push('');
  L.push('## ③ TC-ID별 결과');
  L.push('');
  L.push('| 상태 | TC-ID | 통과/실패/건너뜀 | 테스트 |');
  L.push('|---|---|---|---|');
  for (const id of sortIds(byTc.keys())) {
    const t = byTc.get(id);
    const mark = t.failed ? '❌' : t.skipped && !t.passed ? '⏭' : '✅';
    L.push(`| ${mark} | ${id} | ${t.passed}/${t.failed}/${t.skipped} | ${t.cases.map((c) => `\`${c}\``).join('<br>')} |`);
  }
  L.push('');
  L.push('## ④ TC 문서 대조');
  L.push('');
  L.push('| 컴포넌트 | 문서 정의 | 태그됨 | 미커버(다른 레인 포함) |');
  L.push('|---|---|---|---|');
  for (const [comp, { ids }] of defined) {
    const tagged = taggedByComp.get(comp) ?? new Set();
    const u = uncovered.get(comp) ?? [];
    L.push(`| ${comp} | ${ids.size} | ${tagged.size} | ${u.join(' · ') || '—'} |`);
  }
  if (orphans.length) {
    L.push('');
    L.push('### ⚠️ orphan (태그됐으나 문서 정의 없음 — 오타/드리프트 의심, 커밋 불가)');
    L.push('');
    for (const id of sortIds(orphans)) L.push(`- **${id}**`);
  }
  if (unregistered.length) {
    L.push('');
    L.push('### ⚠️ SUITES 미등록 테스트 파일 (generate-report.mjs에 등록할 것)');
    L.push('');
    for (const f of unregistered) L.push(`- \`${f}\``);
  }
  L.push('');
  L.push('## ⑤ 파일별 상세');
  L.push('');
  L.push('| 파일 | 통과 | 실패 | 건너뜀 | 실패 케이스 |');
  L.push('|---|---|---|---|---|');
  for (const [file, rec] of byFile) {
    const fails = rec.cases.filter((c) => c.status === 'failed').map((c) => `\`${c.name}\``).join('<br>') || '—';
    L.push(`| \`${file}\` | ${rec.passed} | ${rec.failed} | ${rec.skipped} | ${fails} |`);
  }
  L.push('');

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, L.join('\n'), 'utf8');

  console.log(`[report] ${OUT}`);
  console.log(`[report] 통과 ${totals.passed} / 실패 ${totals.failed} / 건너뜀 ${totals.skipped} · orphan ${orphans.length}`);
  if (orphans.length) {
    console.error('[report] FAILED — orphan TC-ID 존재 (문서에 정의를 추가하거나 태그 오타를 고칠 것):');
    for (const id of sortIds(orphans)) console.error('  -', id);
    process.exit(1);
  }
  process.exit(rc);
}

main();
