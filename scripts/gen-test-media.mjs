// gen-test-media — synthesizes local development sunset renditions with FFmpeg (lavfi).
// Real media sourcing (Pexels/Pixabay, PRD §6.1) is a user licensing decision; these
// procedurally generated clips let the full video pipeline (A/B swap, renditions) run locally.
// Encoding follows SRS §5.5: H.264, CRF19+VBV, 30fps CFR, closed 2s GOP, yuv420p, -an, faststart.
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const OUT = join(process.cwd(), 'public', 'media');
mkdirSync(OUT, { recursive: true });

const DURATION = 24; // seconds — short for quick local encodes; frame count = GOP multiple (24s*30=720=12 GOP)
const RENDITIONS = [
  { name: '720p', w: 1280, h: 720, maxrate: '4M', bufsize: '7M', level: '3.1' },
  { name: '1080p', w: 1920, h: 1080, maxrate: '7M', bufsize: '12M', level: '4.0' },
  { name: '1440p', w: 2560, h: 1440, maxrate: '12M', bufsize: '20M', level: '5.0' },
];

// Loop-safe by construction: all animation terms are sinusoidal with periods dividing DURATION.
// Vertical sunset gradient + soft sun disc + subtle shimmer. (geq is slow but offline-only.)
const T = DURATION;
const filter =
  `nullsrc=s=640x360:d=${T}:r=30,format=gray,` +
  `geq=lum='128',null`; // placeholder; real color built below via geq rgb

function geqExpr(w, h) {
  // Normalized coords via W/H built-ins; loop-safe time terms use sin(2*PI*T/(period)).
  const r = `clip(255*(0.92-0.75*(Y/H)) + 90*exp(-((X/W-0.5)*(X/W-0.5)+(Y/H-0.72)*(Y/H-0.72))*38) + 6*sin(2*PI*T/${T}) ,0,255)`;
  const g = `clip(255*(0.45-0.33*(Y/H)) + 55*exp(-((X/W-0.5)*(X/W-0.5)+(Y/H-0.72)*(Y/H-0.72))*38) + 4*sin(2*PI*T/${T}+1.0) ,0,255)`;
  const b = `clip(255*(0.35+0.25*(Y/H)) + 25*exp(-((X/W-0.5)*(X/W-0.5)+(Y/H-0.72)*(Y/H-0.72))*38) ,0,255)`;
  return `geq=r='${r}':g='${g}':b='${b}'`;
}

for (const r of RENDITIONS) {
  const out = join(OUT, `sunset_${r.name}.mp4`);
  if (existsSync(out)) {
    console.log(`skip ${r.name} (exists)`);
    continue;
  }
  console.log(`encoding ${r.name}…`);
  // Generate at 960x540 then scale up — geq per-pixel cost stays manageable.
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=black:s=960x540:r=30:d=${DURATION}`,
    '-vf', `${geqExpr(960, 540)},scale=${r.w}:${r.h}:flags=lanczos,format=yuv420p`,
    '-an',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level:v', r.level,
    '-preset', 'fast',
    '-crf', '19',
    '-maxrate', r.maxrate,
    '-bufsize', r.bufsize,
    '-x264-params', 'keyint=60:min-keyint=60:scenecut=0:open_gop=0',
    '-r', '30',
    '-fps_mode', 'cfr',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-colorspace', 'bt709',
    '-movflags', '+faststart',
    out,
  ];
  execFileSync(ffmpegPath, args, { stdio: 'inherit' });
}
console.log('done →', OUT);
