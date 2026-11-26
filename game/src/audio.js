// Synthesised sound effects (WebAudio, no audio files).
// One job: an engine hum that follows the throttle, plus short cues for
// rings, landings, crashes and clicks. Everything is guarded: audio only
// starts after a user gesture, and a muted or missing AudioContext is silent.

let ctx = null;
let muted = false;
let humOsc = null;
let humGain = null;
let humFilter = null;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (humGain) humGain.gain.value = muted ? 0 : 0.05;
  return muted;
}

/** Create the audio graph on the first user gesture. Safe to call often. */
export function ensureAudio() {
  if (ctx || muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    humOsc = ctx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 62;
    humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 320;
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    humOsc.connect(humFilter).connect(humGain).connect(ctx.destination);
    humOsc.start();
  } catch {
    ctx = null;
  }
}

/** The engine hum follows the throttle (0..1). Call every frame. */
export function setEngine(throttle, running) {
  if (!ctx || !humGain || muted) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const target = running ? 0.02 + throttle * 0.05 : 0;
    humGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    humOsc.frequency.setTargetAtTime(52 + throttle * 70, ctx.currentTime, 0.1);
  } catch { /* audio is decoration, never fatal */ }
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch { /* ignore */ }
}

/** Two-note chime when a mail ring is collected. */
export function sfxRing() {
  blip(880, 0.14, 'sine', 0.16);
  setTimeout(() => blip(1318, 0.22, 'sine', 0.14), 90);
}

/** A soft thud for a touchdown. */
export function sfxLand() {
  blip(140, 0.22, 'triangle', 0.2, 70);
  setTimeout(() => blip(523, 0.18, 'sine', 0.12), 120);
  setTimeout(() => blip(784, 0.26, 'sine', 0.12), 240);
}

/** Noise burst for a crash. */
export function sfxCrash() {
  if (!ctx || muted) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  } catch { /* ignore */ }
}

/** A short click for menus. */
export function sfxClick() {
  blip(660, 0.07, 'square', 0.06);
}

/** A low warning buzz for low fuel. */
export function sfxWarn() {
  blip(220, 0.16, 'square', 0.07, 180);
}
