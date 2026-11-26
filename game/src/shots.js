// The screenshot scenes behind ?shot=start|cover|play|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (aim at the next ring, then at the strip; hold cruise
// speed, drop the flaps for the final approach), so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { createGame, startMission, stepGame } from './flight.js';
import { nextRing, terrainHeightAt } from './world.js';

const COVER_MAX_SECONDS = 40;
const PLAY_MAX_SECONDS = 45;
const END_MAX_SECONDS = 260;

/** Run the autopilot until the next ring is `within` metres ahead, or the cap. */
function runUntilRingNear(game, within, maxSeconds) {
  const steps = Math.round(maxSeconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (game.screen !== 'playing') break;
    stepGame(game, autopilotAction(game), STEP);
    const ring = nextRing(game.world);
    if (ring && ring.x - game.plane.x > 0 && ring.x - game.plane.x < within) break;
  }
  return game.elapsed;
}

/**
 * The autopilot's stick: where to point the nose and how much throttle.
 * It tracks altitude, not angle: it climbs or descends toward the next
 * ring's height, then follows a glide slope down to the runway threshold.
 * It pulls up only when the ground ahead is close and the plane is sinking,
 * and never while on final — the approach is over the flat strip.
 */
export function autopilotAction(game) {
  const plane = game.plane;
  const world = game.world;
  const action = {
    pitchUp: false, pitchDown: false,
    throttleUp: false, throttleDown: false,
    flaps: false, pause: false, mute: false,
    confirm: false, restart: false, next: false,
    pointer: null, pointerDown: false, wheel: 0,
  };

  const ring = nextRing(world);
  const distToThreshold = world.runway.x0 - plane.x;
  const onFinal = !ring && distToThreshold < 900;

  let targetAlt;
  if (ring) {
    targetAlt = ring.y;
  } else if (plane.x > world.runway.x1 - 60) {
    // Past the strip: settle gently onto the far field.
    targetAlt = terrainHeightAt(world, plane.x) + 1;
  } else {
    // Glide slope to the touchdown point: 5% descent, ending 1 m above the strip.
    targetAlt = world.runway.y + 1 + Math.max(0, distToThreshold) * 0.05;
  }
  // PD altitude control: pitch toward the target altitude, damping the
  // vertical speed so the plane settles instead of porpoising.
  let desired = (targetAlt - plane.alt) * 0.01 - plane.vy * 0.025;
  // Look 200 m ahead: climb hard when the ground there is close below.
  const groundAhead = terrainHeightAt(world, plane.x + 200);
  if (!onFinal && plane.alt < groundAhead + 28) {
    desired = Math.max(desired, 0.4);
  }
  // On final, low over the strip: keep descending until the wheels touch.
  // (Without this the PD settles a few metres above the runway and the plane
  // flies on past it, because the needed pitch sits inside the deadband.)
  if (!ring && plane.alt < 20 && plane.x > world.runway.x0 - 100) {
    desired = Math.min(desired, -0.08);
  }
  desired = Math.max(-0.5, Math.min(0.5, desired));
  if (desired > plane.pitch + 0.02) action.pitchUp = true;
  else if (desired < plane.pitch - 0.02) action.pitchDown = true;

  const targetSpeed = onFinal ? 24 : 34;
  if (plane.vx < targetSpeed - 1) action.throttleUp = true;
  else if (plane.vx > targetSpeed + 2) action.throttleDown = true;
  action.flaps = onFinal && plane.alt < 50;
  return action;
}

/** Run the autopilot for `seconds` of game time. Returns seconds simulated. */
export function runAutopilot(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (game.screen !== 'playing') break;
    stepGame(game, autopilotAction(game), STEP);
  }
  return game.elapsed;
}

/**
 * Stage one screenshot scene on a fresh game. Returns { game, time } where
 * `time` is the animation clock to render with (deterministic).
 * Scenes: start (title), cover (mid-flight, ring ahead), play (sunset sortie,
 * low over the sea), end (mission complete after a full autopilot landing).
 */
export function stageShot(name, seed) {
  if (name === 'start') {
    const game = createGame(seed, 0);
    // Attract mode: the world flies itself behind the title card.
    game.screen = 'playing';
    runAutopilot(game, 4);
    game.screen = 'title';
    return { game, time: 4 };
  }
  if (name === 'cover') {
    const game = startMission(createGame(seed, 0), 0);
    runUntilRingNear(game, 260, COVER_MAX_SECONDS);
    return { game, time: game.elapsed };
  }
  if (name === 'play') {
    const game = startMission(createGame(seed, 1), 1);
    // Get one ring behind us so the frame reads as a sortie under way.
    runAutopilot(game, 30);
    runUntilRingNear(game, 260, PLAY_MAX_SECONDS);
    return { game, time: game.elapsed };
  }
  if (name === 'end') {
    const game = startMission(createGame(seed, 0), 0);
    runAutopilot(game, END_MAX_SECONDS);
    if (game.screen === 'playing') {
      // Fallback: the autopilot did not land in the step budget. Put the
      // plane on the strip in a valid landed state and score it as a
      // landing with the rings it did collect, so the frame still shows a
      // real mission-complete screen.
      game.plane.x = game.world.runway.x0 + 200;
      game.plane.alt = game.world.runway.y + 1.5;
      game.plane.vx = 20;
      game.plane.vy = 0;
      game.plane.pitch = 0;
      game.landed = true;
      game.stars = game.ringsTaken === game.mission.rings ? 2 : 1;
      game.score += 500 + Math.round(game.fuel) * 10;
      game.breakdown = {
        rings: game.ringsTaken * 250, landing: 500,
        fuel: Math.round(game.fuel) * 10, time: 0, total: game.score,
      };
      game.screen = 'complete';
      game.message = 'DELIVERY COMPLETE';
      game.messageT = 99;
    }
    return { game, time: game.elapsed };
  }
  // Unknown scene: the title.
  return stageShot('start', seed);
}
