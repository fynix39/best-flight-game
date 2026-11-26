// The island chain: terrain, sea, rings, runway and scenery.
// One job: build a whole sortie's world from a seed, and answer "how high is
// the ground here?" for the flight rules. Nothing here touches the DOM.

import { MISSIONS, RING } from './config.js';
import { makeRandom } from './random.js';

// The heightfield is sampled every 25 m; terrainHeightAt lerps between samples.
const SAMPLE_STEP = 25;

/** Smoothstep interpolation between two height samples. */
function lerpHeight(a, b, t) {
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

/** Build one mission's world. Deterministic for (seed, missionIndex). */
export function createWorld(seed, missionIndex) {
  const mission = MISSIONS[missionIndex];
  const rnd = makeRandom(seed * 1000 + missionIndex * 77 + 13);
  const length = mission.length;
  const samples = Math.ceil(length / SAMPLE_STEP) + 2;

  // Rolling hills: a few sine waves with random phase, plus a noise wobble.
  // The strip end is flattened for the runway, and the start is a gentle
  // takeoff ramp so the plane is never born below the hill in front of it.
  const heights = [];
  const w1 = rnd.range(30, 55);
  const w2 = rnd.range(15, 30);
  const p1 = rnd.range(0, Math.PI * 2);
  const p2 = rnd.range(0, Math.PI * 2);
  const base = rnd.range(12, 24);
  for (let i = 0; i < samples; i++) {
    const x = i * SAMPLE_STEP;
    let h = base
      + w1 * 0.5 * (1 + Math.sin((x / 900) * Math.PI * 2 + p1))
      + w2 * 0.5 * (1 + Math.sin((x / 380) * Math.PI * 2 + p2))
      + rnd.range(-6, 6);
    // Gentle takeoff ramp, then a flat approach corridor for the last 900 m
    // so the final descent to the strip never meets a hill.
    if (x < 800) h = Math.min(h, 6 + x * 0.09);
    if (x > length - 900) h = 8;
    heights.push(Math.max(2, h));
  }

  // Mail rings: spaced along the route, at varied altitudes, always above
  // the hills beneath them AND above the highest ground on their 400 m
  // approach, so the line is flyable at a steady height.
  const rings = [];
  const n = mission.rings;
  for (let i = 0; i < n; i++) {
    const x = 500 + ((length - 1100) * (i + 0.5)) / n + rnd.range(-60, 60);
    let approachMax = 0;
    for (let ax = Math.max(0, x - 400); ax <= x; ax += 25) {
      approachMax = Math.max(approachMax, terrainHeightAtSamples(heights, ax));
    }
    const alt = Math.min(170, Math.max(50, approachMax + rnd.range(30, 55)));
    rings.push({ x, y: alt, r: RING.radius, taken: false, missed: false, phase: rnd.range(0, Math.PI * 2) });
  }

  // The strip: a flat runway with a windsock at its near end.
  const runway = { x0: length - 460, x1: length - 60, y: 8 };

  // Scenery, placed on the ground: palms near the beach, houses in the
  // middle, one lighthouse on a headland, clouds up in the sky.
  const palms = [];
  const houses = [];
  for (let x = 260; x < length - 600; x += 90) {
    const ground = terrainHeightAtSamples(heights, x);
    if (rnd.chance(0.55)) palms.push({ x: x + rnd.range(-25, 25), y: ground, lean: rnd.range(-0.22, 0.22), h: rnd.range(16, 26) });
    if (rnd.chance(0.22)) houses.push({ x: x + rnd.range(-20, 20), y: ground, w: rnd.range(22, 34), h: rnd.range(14, 22), hue: rnd.pick(['#e8b04b', '#c96f4a', '#7fa8c9', '#e0d6c2']) });
  }
  const lighthouseX = 900 + rnd.range(0, 500);
  const lighthouse = { x: lighthouseX, y: terrainHeightAtSamples(heights, lighthouseX) };
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    clouds.push({
      x: rnd.range(0, length), y: rnd.range(150, 320),
      w: rnd.range(90, 220), h: rnd.range(22, 44), speed: rnd.range(1.5, 4),
    });
  }
  // Seagulls that drift across the sky.
  const gulls = [];
  for (let i = 0; i < 6; i++) {
    gulls.push({ x: rnd.range(0, length), y: rnd.range(90, 220), speed: rnd.range(6, 12), phase: rnd.range(0, Math.PI * 2) });
  }

  return {
    mission, missionIndex, length, heights, rings, runway,
    palms, houses, lighthouse, clouds, gulls, seed,
  };
}

function terrainHeightAtSamples(heights, x) {
  const f = Math.max(0, x) / SAMPLE_STEP;
  const i = Math.min(heights.length - 2, Math.floor(f));
  return lerpHeight(heights[i], heights[i + 1], f - i);
}

/** Ground height (metres above sea) at world x. */
export function terrainHeightAt(world, x) {
  return terrainHeightAtSamples(world.heights, x);
}

/** The next ring the pilot has to fly through, or null when all are taken. */
export function nextRing(world) {
  return world.rings.find((r) => !r.taken && !r.missed) ?? null;
}

/** True when world x is over the runway strip. */
export function overRunway(world, x) {
  return x >= world.runway.x0 && x <= world.runway.x1;
}
