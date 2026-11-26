// The flight rules: the plane, the sortie, the score.
// One job: a pure state machine — createGame, stepGame, nothing here touches
// the DOM, so the same code runs in the browser and in Node logic tests.

import { LANDING, MISSIONS, PLANE, SCORE, STEP } from './config.js';
import { createWorld, nextRing, overRunway, terrainHeightAt } from './world.js';

// Game screens.
export const SCREENS = ['title', 'playing', 'paused', 'complete', 'gameover'];

/** A fresh sortie. `seed` fixes the islands; `missionIndex` picks the sortie. */
export function createGame(seed, missionIndex = 0) {
  const world = createWorld(seed, missionIndex);
  return {
    seed,
    missionIndex,
    mission: MISSIONS[missionIndex],
    world,
    screen: 'title',
    // Plane state: x and alt in metres, speeds in m/s, pitch in radians.
    plane: { x: 120, alt: 110, vx: 34, vy: 0, pitch: 0, throttle: 0.62, flaps: false },
    fuel: world.mission.fuel,
    hearts: 3,
    score: 0,
    ringsTaken: 0,
    time: 0,
    elapsed: 0, // seconds since takeoff, for the time bonus
    shake: 0, // screen-shake timer, seconds
    flash: '', // one-line event banner ("RING +250", "LOW FUEL", ...)
    flashT: 0,
    message: '',
    messageT: 0,
    best: 0,
    stars: 0,
    missionCards: buildMissionCards([0, 0, 0]),
    breakdown: null, // { rings, landing, fuel, time, total } once landed
    landed: false,
    crashed: false,
    windPhase: 0,
    // Where a crash sends the plane back to: the last ring, or the start.
    checkpoint: { x: 120, alt: 110 },
  };
}

/** Start (or restart) a sortie from its title screen. */
export function startMission(game, missionIndex = game.missionIndex) {
  const fresh = createGame(game.seed, missionIndex);
  fresh.best = game.best;
  fresh.screen = 'playing';
  return fresh;
}

function setFlash(game, text, seconds = 1.6) {
  game.flash = text;
  game.flashT = seconds;
}

function setMessage(game, text, seconds = 2.5) {
  game.message = text;
  game.messageT = seconds;
}

/** The wind gust right now (m/s of vertical push), for the gusty sortie. */
export function currentGust(game) {
  const w = game.mission.wind;
  if (w <= 0) return 0;
  return Math.sin(game.windPhase * 0.9) * w * 0.6 + Math.sin(game.windPhase * 2.3) * w * 0.4;
}

function collectRing(game, ring) {
  ring.taken = true;
  game.ringsTaken += 1;
  game.score += SCORE.ring;
  game.fuel = Math.min(100, game.fuel + PLANE.ringFuel);
  game.checkpoint = { x: ring.x, alt: ring.y };
  setFlash(game, `RING +${SCORE.ring}`);
}

function crashPlane(game, reason) {
  game.hearts -= 1;
  game.crashed = true;
  game.shake = 0.6;
  if (game.hearts <= 0) {
    game.screen = 'gameover';
    setMessage(game, reason);
    return;
  }
  // Back to the last ring with a topped-up tank; the sortie continues.
  setFlash(game, `${reason} — HEART LOST`);
  const cp = game.checkpoint;
  game.plane.x = cp.x;
  game.plane.alt = Math.max(cp.alt, terrainHeightAt(game.world, cp.x) + 55);
  game.plane.vx = 30;
  game.plane.vy = 0;
  game.plane.pitch = 0;
  game.plane.throttle = 0.62;
  game.fuel = Math.max(game.fuel, 55);
}

function landPlane(game) {
  const plane = game.plane;
  game.landed = true;
  const ringScore = game.ringsTaken * SCORE.ring;
  const fuelBonus = Math.round(game.fuel) * SCORE.fuelBonusPerPoint;
  const timeBonus = Math.max(0, Math.round(game.mission.parTime - game.elapsed)) * SCORE.timeBonusPerSecond;
  game.score += SCORE.landingBase + fuelBonus + timeBonus;
  game.breakdown = {
    rings: ringScore, landing: SCORE.landingBase, fuel: fuelBonus, time: timeBonus,
    total: game.score,
  };
  const allRings = game.ringsTaken === game.mission.rings;
  game.stars = 1 + (allRings ? 1 : 0) + (allRings && game.fuel >= 40 ? 1 : 0);
  game.screen = 'complete';
  setMessage(game, allRings ? 'DELIVERY COMPLETE' : 'LANDED — SOME MAIL MISSED');
}

/**
 * One fixed step of the sortie. `action` is { pitchUp, pitchDown,
 * throttleUp, throttleDown, flaps, pause, confirm } — from the keyboard, the
 * mouse, or the autopilot. Pure: no input reading, no drawing.
 */
export function stepGame(game, action, dt = STEP) {
  if (game.screen !== 'playing') return;
  const plane = game.plane;
  const world = game.world;
  game.time += dt;
  game.elapsed += dt;
  game.windPhase += dt;
  if (game.flashT > 0) game.flashT -= dt;
  if (game.messageT > 0) game.messageT -= dt;
  if (game.shake > 0) game.shake -= dt;

  // --- Throttle lever and flaps -------------------------------------------
  if (action.throttleUp) plane.throttle = Math.min(1, plane.throttle + 0.9 * dt);
  if (action.throttleDown) plane.throttle = Math.max(0, plane.throttle - 0.9 * dt);
  plane.flaps = !!action.flaps;

  // --- Pitch --------------------------------------------------------------
  if (action.pitchUp) plane.pitch = Math.min(PLANE.maxPitch, plane.pitch + PLANE.pitchRate * dt);
  if (action.pitchDown) plane.pitch = Math.max(-PLANE.maxPitch, plane.pitch - PLANE.pitchRate * dt);
  // No stick input: the nose eases back toward level.
  if (!action.pitchUp && !action.pitchDown) plane.pitch *= Math.max(0, 1 - 1.1 * dt);

  // --- Forces -------------------------------------------------------------
  const gust = currentGust(game);
  const drag = plane.flaps ? PLANE.flapDrag : PLANE.drag;
  const liftRate = plane.flaps ? PLANE.flapLift : PLANE.liftRate;
  const thrust = game.fuel > 0 ? plane.throttle * PLANE.thrust : 0;
  const topSpeed = plane.flaps ? Math.min(PLANE.maxSpeed, PLANE.flapMaxSpeed) : PLANE.maxSpeed;
  plane.vx += (thrust - drag * plane.vx * plane.vx) * dt;
  plane.vx = Math.max(0, Math.min(topSpeed, plane.vx));
  // The wing pulls the flight path toward the nose; below stall speed the
  // nose drops and the plane sinks.
  const climbTarget = plane.vx * Math.sin(plane.pitch) * 0.92;
  plane.vy += (climbTarget - plane.vy) * Math.min(1, liftRate * dt);
  if (plane.vx < PLANE.stallSpeed) {
    plane.vy -= (PLANE.stallSpeed - plane.vx) * 1.4 * dt;
    plane.pitch -= 0.25 * dt;
  }
  // The stall can push the nose down past the stops; clamp it back.
  plane.pitch = Math.max(-PLANE.maxPitch, Math.min(PLANE.maxPitch, plane.pitch));
  plane.vy += gust * dt;

  // --- Motion ---------------------------------------------------------------
  plane.x += plane.vx * dt;
  plane.alt += plane.vy * dt;
  if (plane.alt > 320) { plane.alt = 320; plane.vy = Math.min(0, plane.vy); }

  // --- Fuel -----------------------------------------------------------------
  if (game.fuel > 0) {
    game.fuel = Math.max(0, game.fuel - plane.throttle * PLANE.burnPerSecond * dt);
    if (game.fuel === 0) setMessage(game, 'ENGINE OUT — GLIDE TO THE STRIP');
    else if (game.fuel < 18 && game.messageT <= 0) setMessage(game, 'LOW FUEL');
  }

  // --- Rings ----------------------------------------------------------------
  const ring = nextRing(world);
  if (ring) {
    const dx = plane.x - ring.x;
    const dy = plane.alt - ring.y;
    if (dx * dx + dy * dy < ring.r * ring.r) collectRing(game, ring);
    // Flown past it: the ring is missed, the sortie moves on to the next one.
    else if (dx > 30) {
      ring.missed = true;
      setFlash(game, 'RING MISSED');
    }
  }

  // --- Ground ----------------------------------------------------------------
  const ground = terrainHeightAt(world, plane.x);
  const clearance = plane.alt - ground;
  const onStrip = overRunway(world, plane.x);
  if (clearance <= 1.5) {
    const gentle = plane.vy > -LANDING.maxSink
      && plane.vx >= LANDING.minSpeed && plane.vx <= LANDING.maxSpeed
      && Math.abs(plane.pitch) <= LANDING.maxPitch;
    if (onStrip) {
      if (gentle) {
        plane.alt = world.runway.y + 1.5;
        landPlane(game);
        return;
      }
      // A hard touchdown on the strip: bounce, lose a heart.
      if (plane.vy < -1) {
        plane.vy = -plane.vy * 0.3;
        plane.alt = world.runway.y + 2;
        game.shake = 0.35;
        setFlash(game, 'HARD LANDING');
        game.hearts -= 1;
        if (game.hearts <= 0) {
          game.screen = 'gameover';
          setMessage(game, 'AIRFRAME GAVE OUT');
        }
        return;
      }
    }
    // Past the strip, the far field is flat grass: a gentle touchdown there
    // is a field landing — the mail never arrives, so no landing bonus.
    if (!onStrip && plane.x > world.runway.x1 + 60 && gentle) {
      plane.alt = ground + 1.5;
      game.landed = true;
      game.stars = game.ringsTaken === game.mission.rings ? 1 : 0;
      game.score += Math.round(game.fuel) * 2;
      game.breakdown = {
        rings: game.ringsTaken * SCORE.ring, landing: 0,
        fuel: Math.round(game.fuel) * 2, time: 0, total: game.score,
      };
      game.screen = 'complete';
      setMessage(game, 'FIELD LANDING — THE MAIL NEVER ARRIVED');
      return;
    }
    // Anything else at ground level is a crash.
    crashPlane(game, ground <= 5 ? 'DITCHED IN THE SEA' : 'TERRAIN STRIKE');
    return;
  }
}

/** Stars earned for a finished sortie, from its final numbers. */
export function starsFor(game) {
  return game.stars;
}

/** Mission cards for the title screen, with stars earned so far. */
export function buildMissionCards(starsByMission) {
  return MISSIONS.map((m, i) => ({
    name: m.name, sub: m.sub, rings: m.rings, length: m.length,
    stars: starsByMission[i] || 0,
  }));
}
