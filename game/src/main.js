// Sky Courier — Island Run: the game loop, screens and wiring.
// One job: own the frame — read input, step the rules, play the sounds,
// draw the frame. The rules live in flight.js, the pixels in render.js.

import { CANVAS, STEP } from './config.js';
import { buildMissionCards, createGame, startMission, stepGame } from './flight.js';
import { attachInput, pointerSteering } from './input.js';
import { drawGame, planeScreenPos } from './render.js';
import { stageShot, autopilotAction } from './shots.js';
import {
  ensureAudio, isMuted, setEngine, sfxClick, sfxCrash, sfxLand, sfxRing, sfxWarn, toggleMute,
} from './audio.js';
import { burstCrash, burstRing, createParticles, puffExhaust, puffSmoke, stepParticles } from './particles.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '7') || 7;

const BEST_KEY = 'sky-courier-best';
const STARS_KEY = 'sky-courier-stars';

function loadBest() {
  try { return Number(window.localStorage.getItem(BEST_KEY) || '0') || 0; }
  catch { return 0; }
}
function loadStars() {
  try { return JSON.parse(window.localStorage.getItem(STARS_KEY) || '[0,0,0]'); }
  catch { return [0, 0, 0]; }
}
function saveBest(best, stars) {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
    window.localStorage.setItem(STARS_KEY, JSON.stringify(stars));
  } catch { /* private mode: the game still plays */ }
}

let best = loadBest();
let starsByMission = loadStars();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

if (shotName) {
  // Deterministic screenshot scene: stage it, draw it once, and keep drawing
  // the same frozen frame (the animation clock is fixed, so the image is
  // identical every time the page loads).
  const { game, time } = stageShot(shotName, seed);
  game.best = best;
  game.missionCards = buildMissionCards(starsByMission);
  const particles = createParticles();
  drawGame(ctx, game, particles, time);
  announce(`Sky Courier screenshot: ${shotName}`);
} else {
  const input = attachInput(window, canvas);
  let game = createGame(seed, 0);
  game.best = best;
  game.missionCards = buildMissionCards(starsByMission);
  const particles = createParticles();
  // The world flying itself behind the title card.
  let attract = startMission(createGame(seed, 0), 0);
  attract.best = best;
  attract.missionCards = buildMissionCards(starsByMission);

  let last = performance.now();
  let acc = 0;
  let prevHearts = 3;
  let prevScreen = 'title';
  let warnedLowFuel = false;
  let exhaustT = 0;

  function refreshCards() {
    game.missionCards = buildMissionCards(starsByMission);
    game.best = best;
  }

  function recordResult() {
    if (game.score > best) best = game.score;
    if (game.screen === 'complete' && game.stars > (starsByMission[game.missionIndex] || 0)) {
      starsByMission[game.missionIndex] = game.stars;
    }
    saveBest(best, starsByMission);
    refreshCards();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    const action = input.readAction();

    // First gesture wakes the audio graph.
    if (action.confirm || action.pointerDown || action.pitchUp || action.throttleUp) ensureAudio();
    if (action.mute) toggleMute();

    if (game.screen === 'title') {
      // Attract mode: the world flies itself behind the title card.
      acc += dt;
      while (acc >= STEP) {
        stepGame(attract, autopilotAction(attract), STEP);
        acc -= STEP;
        if (attract.screen !== 'playing') attract = startMission(createGame(seed, attract.missionIndex), attract.missionIndex);
      }
      // Clicking a mission card selects it; anywhere else (or Enter) starts.
      if (action.pointerDown && action.pointer) {
        const p = action.pointer;
        const cw = 250;
        const gap = 30;
        const x0 = CANVAS.W / 2 - (cw * 3 + gap * 2) / 2;
        let hitCard = -1;
        for (let i = 0; i < 3; i++) {
          const x = x0 + i * (cw + gap);
          if (p.x >= x && p.x <= x + cw && p.y >= 350 && p.y <= 480) hitCard = i;
        }
        if (hitCard >= 0) {
          sfxClick();
          game = createGame(seed, hitCard);
          game.best = best;
          refreshCards();
          attract = startMission(createGame(seed, hitCard), hitCard);
        } else {
          ensureAudio();
          sfxClick();
          game = startMission(game, game.missionIndex);
          game.best = best;
          refreshCards();
          prevHearts = 3;
          warnedLowFuel = false;
          announce(`${game.mission.name} — fly the mail, land on the strip`);
        }
      } else if (action.confirm) {
        ensureAudio();
        sfxClick();
        game = startMission(game, game.missionIndex);
        game.best = best;
        refreshCards();
        prevHearts = 3;
        warnedLowFuel = false;
        announce(`${game.mission.name} — fly the mail, land on the strip`);
      }
    } else if (game.screen === 'playing') {
      if (action.pause) {
        game.screen = 'paused';
        announce('Paused');
      } else {
        // Mouse steering: hold the button and the plane follows the pointer.
        if (action.pointerDown && action.pointer) {
          const steer = pointerSteering(action.pointer, planeScreenPos(game).y);
          action.pitchUp = action.pitchUp || steer.pitchUp;
          action.pitchDown = action.pitchDown || steer.pitchDown;
        }
        const wasRings = game.ringsTaken;
        const wasHearts = game.hearts;
        const wasFuel = game.fuel;
        acc += dt;
        while (acc >= STEP) {
          stepGame(game, action, STEP);
          acc -= STEP;
          if (game.screen !== 'playing') break;
        }
        // Event cues: ring chime, crash, landing, low fuel.
        if (game.ringsTaken > wasRings) {
          sfxRing();
          const ring = game.world.rings[game.ringsTaken - 1];
          if (ring) burstRing(particles, ring.x, ring.y);
        }
        if (game.hearts < wasHearts) {
          sfxCrash();
          burstCrash(particles, game.plane.x, game.plane.alt);
        }
        if (game.screen === 'complete' && prevScreen === 'playing') {
          sfxLand();
          puffSmoke(particles, game.plane.x, game.plane.alt);
          recordResult();
        }
        if (game.screen === 'gameover' && prevScreen === 'playing') {
          sfxCrash();
          burstCrash(particles, game.plane.x, game.plane.alt);
          recordResult();
        }
        if (game.fuel < 18 && wasFuel >= 18 && !warnedLowFuel) {
          sfxWarn();
          warnedLowFuel = true;
        }
        if (game.fuel >= 18) warnedLowFuel = false;
        // Exhaust puffs while the engine works.
        exhaustT += dt;
        if (game.plane.throttle > 0.3 && game.fuel > 0 && exhaustT > 0.06) {
          exhaustT = 0;
          const pos = planeScreenPos(game);
          puffExhaust(particles, game.plane.x - 2, game.plane.alt, game.plane.vx * 3);
          void pos;
        }
        setEngine(game.plane.throttle, game.fuel > 0 && game.screen === 'playing');
      }
    } else if (game.screen === 'paused') {
      if (action.pause || action.confirm || action.pointerDown) {
        game.screen = 'playing';
        announce('Resumed');
      }
    } else if (game.screen === 'complete') {
      if (action.next && game.missionIndex + 1 < 3) {
        sfxClick();
        game = startMission(game, game.missionIndex + 1);
        game.best = best;
        refreshCards();
        prevHearts = 3;
        warnedLowFuel = false;
      } else if (action.restart || action.confirm) {
        if (action.restart) {
          sfxClick();
          game = startMission(game, game.missionIndex);
          game.best = best;
          refreshCards();
          prevHearts = 3;
          warnedLowFuel = false;
        } else if (action.confirm) {
          // Enter on the results screen goes back to the menu.
          game = createGame(seed, game.missionIndex);
          game.best = best;
          refreshCards();
        }
      }
    } else if (game.screen === 'gameover') {
      if (action.restart) {
        sfxClick();
        game = startMission(game, game.missionIndex);
        game.best = best;
        refreshCards();
        prevHearts = 3;
        warnedLowFuel = false;
      } else if (action.confirm) {
        game = createGame(seed, game.missionIndex);
        game.best = best;
        refreshCards();
      }
    }

    prevScreen = game.screen;
    prevHearts = game.hearts;
    stepParticles(particles, dt);

    // Draw, with a whole-frame shake while the airframe is rattling.
    ctx.save();
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake * 16, (Math.random() - 0.5) * game.shake * 16);
    }
    // On the title screen the attract world flies behind the title card.
    let drawTarget = game;
    if (game.screen === 'title') {
      drawTarget = attract;
      attract.screen = 'title';
      attract.missionCards = game.missionCards;
      attract.best = best;
    }
    drawGame(ctx, drawTarget, particles, now / 1000);
    if (drawTarget === attract) attract.screen = 'playing';
    ctx.restore();
    if (isMuted()) {
      ctx.fillStyle = 'rgba(10,20,32,0.6)';
      ctx.fillRect(1200, 690, 70, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MUTED', 1235, 705);
    }
    input.endFrame();
  }
  requestAnimationFrame(frame);
}
