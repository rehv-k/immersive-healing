// audio/scheduler — fades on the audio clock. Never on rAF (SRS-AUD-2).

export function fadeTo(ctx: AudioContext, gain: GainNode, target: number, seconds: number): void {
  const now = ctx.currentTime;
  const p = gain.gain;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(Math.max(0, target), now + Math.max(0.01, seconds));
}

/** Equal-power crossfade between two gain nodes. */
export function crossfade(
  ctx: AudioContext,
  from: GainNode,
  to: GainNode,
  seconds: number,
  steps = 32,
): void {
  const now = ctx.currentTime;
  const dur = Math.max(0.05, seconds);
  const outCurve = new Float32Array(steps);
  const inCurve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    outCurve[i] = Math.cos((t * Math.PI) / 2);
    inCurve[i] = Math.sin((t * Math.PI) / 2);
  }
  from.gain.cancelScheduledValues(now);
  to.gain.cancelScheduledValues(now);
  from.gain.setValueCurveAtTime(outCurve, now, dur);
  to.gain.setValueCurveAtTime(inCurve, now, dur);
}
