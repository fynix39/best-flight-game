// All the drawing: sky, sea, islands, runway, rings, the plane, the HUD,
// the lit instrument strip and the screens. One job: turn a game state into
// a frame. No rules live here — only pixels.

import { CANVAS, PANEL, SCALE } from './config.js';
import { nextRing, terrainHeightAt } from './world.js';

const PLANE_SCREEN_X = 420; // the plane sits a third across the frame

/** Where the plane draws on screen, for mouse steering and the camera. */
export function planeScreenPos(game) {
  return { x: PLANE_SCREEN_X, y: screenY(game, game.plane.alt) };
}

/** Camera: the altitude at the bottom of the play area (screen y = PANEL.y). */
function camAlt(game) {
  return Math.max(-8, game.plane.alt - 118);
}

/** World x (metres) at the left edge of the frame. */
function camX(game) {
  return Math.max(0, game.plane.x - PLANE_SCREEN_X / SCALE);
}

function screenX(game, wx) {
  return (wx - camX(game)) * SCALE;
}

function screenY(game, alt) {
  return PANEL.y - (alt - camAlt(game)) * SCALE;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, font, color, align = 'left', glow = null) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

/** The whole frame: world, plane, particles, HUD, panel, screens. */
export function drawGame(ctx, game, particles, time) {
  const { W, H } = CANVAS;
  const mission = game.mission;
  const sky = mission.sky;

  // Base fill for the whole frame (the strip's colour): the world only
  // covers the play area above PANEL.y, and the title screen skips the
  // strip, so without this the bottom band would be bare black.
  ctx.fillStyle = '#10161d';
  ctx.fillRect(0, 0, W, H);

  // --- Sky ---------------------------------------------------------------
  const grad = ctx.createLinearGradient(0, 0, 0, PANEL.y);
  grad.addColorStop(0, sky.top);
  grad.addColorStop(0.55, sky.mid);
  grad.addColorStop(1, sky.low);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, PANEL.y);

  // Sun or moon, with a halo.
  const sunX = 1020;
  const sunY = sky.night ? 110 : 120;
  ctx.save();
  ctx.globalAlpha = sky.night ? 0.9 : 0.85;
  const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 90);
  halo.addColorStop(0, sky.sun);
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
  ctx.fillStyle = sky.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sky.night ? 26 : 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Stars at night.
  if (sky.night) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      const sx = (i * 137.5 + 40) % W;
      const sy = (i * 89.3 + 30) % 300;
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7 + time * 0.8));
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // --- Far hills (parallax) ----------------------------------------------
  const offset = camX(game) * SCALE * 0.3;
  ctx.fillStyle = mission.hill;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(0, PANEL.y);
  for (let sx = 0; sx <= W; sx += 16) {
    const hy = 330 + 55 * Math.sin((sx + offset) / 260) + 28 * Math.sin((sx + offset) / 113 + 1.7);
    ctx.lineTo(sx, hy);
  }
  ctx.lineTo(W, PANEL.y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // --- Clouds (parallax, drifting) ----------------------------------------
  for (const c of game.world.clouds) {
    const cx = screenX(game, c.x + time * c.speed * 0.7) - 200;
    const cy = c.y * 0.9;
    if (cx < -260 || cx > W + 260) continue;
    ctx.fillStyle = sky.night ? 'rgba(190,200,230,0.20)' : 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + c.w * 0.28, cy + 6, c.w * 0.32, c.h * 0.36, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - c.w * 0.28, cy + 8, c.w * 0.3, c.h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Seagulls -------------------------------------------------------------
  ctx.strokeStyle = sky.night ? 'rgba(220,225,240,0.7)' : 'rgba(40,60,80,0.7)';
  ctx.lineWidth = 2;
  for (const g of game.world.gulls) {
    const gx = screenX(game, g.x + time * g.speed);
    const gy = g.y * 0.85 + Math.sin(time * 2 + g.phase) * 8;
    if (gx < -30 || gx > W + 30) continue;
    const flap = Math.sin(time * 6 + g.phase) * 5;
    ctx.beginPath();
    ctx.moveTo(gx - 9, gy + flap);
    ctx.quadraticCurveTo(gx, gy - 4, gx, gy);
    ctx.quadraticCurveTo(gx, gy - 4, gx + 9, gy + flap);
    ctx.stroke();
  }

  // --- Sea ------------------------------------------------------------------
  const seaY = screenY(game, 0);
  ctx.fillStyle = mission.sea;
  ctx.fillRect(0, Math.max(seaY, 0), W, PANEL.y - Math.max(seaY, 0));
  // Wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const wy = seaY + 14 + row * 26;
    if (wy > PANEL.y - 4) break;
    ctx.beginPath();
    for (let sx = 0; sx <= W; sx += 12) {
      const wave = Math.sin((sx + time * 30 + row * 90) / 46) * 3;
      if (sx === 0) ctx.moveTo(sx, wy + wave);
      else ctx.lineTo(sx, wy + wave);
    }
    ctx.stroke();
  }

  // --- Terrain ---------------------------------------------------------------
  ctx.beginPath();
  ctx.moveTo(0, PANEL.y);
  for (let sx = 0; sx <= W; sx += 8) {
    const wx = camX(game) + sx / SCALE;
    ctx.lineTo(sx, screenY(game, terrainHeightAt(game.world, wx)));
  }
  ctx.lineTo(W, PANEL.y);
  ctx.closePath();
  ctx.fillStyle = mission.grass;
  ctx.fill();
  // Sand where the ground meets the sea.
  ctx.beginPath();
  let started = false;
  for (let sx = 0; sx <= W; sx += 8) {
    const wx = camX(game) + sx / SCALE;
    const h = terrainHeightAt(game.world, wx);
    if (h <= 6) {
      if (!started) { ctx.moveTo(sx, screenY(game, h)); started = true; }
      ctx.lineTo(sx, screenY(game, h));
    } else if (started) {
      ctx.lineTo(sx, screenY(game, 0));
      started = false;
    }
  }
  if (started) ctx.lineTo(W, screenY(game, 0));
  ctx.closePath();
  ctx.fillStyle = '#e8d29a';
  ctx.fill();

  // --- Scenery: palms, houses, lighthouse -----------------------------------
  for (const p of game.world.palms) {
    const px = screenX(game, p.x);
    if (px < -40 || px > W + 40) continue;
    const py = screenY(game, p.y);
    const h = p.h * SCALE * 0.55;
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + p.lean * 30, py - h * 0.6, px + p.lean * 40, py - h);
    ctx.stroke();
    ctx.strokeStyle = '#2f7d33';
    ctx.lineWidth = 4;
    const topX = px + p.lean * 40;
    const topY = py - h;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.85 + (i / 4) * Math.PI * 0.7;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * 18, topY + Math.sin(a) * 14 + 8, topX + Math.cos(a) * 30, topY + Math.sin(a) * 22 + 12);
      ctx.stroke();
    }
  }
  for (const hs of game.world.houses) {
    const hx = screenX(game, hs.x);
    if (hx < -50 || hx > W + 50) continue;
    const hy = screenY(game, hs.y);
    const w = hs.w * 1.6;
    const h = hs.h * 1.6;
    ctx.fillStyle = hs.hue;
    ctx.fillRect(hx - w / 2, hy - h, w, h);
    ctx.fillStyle = '#8a4a2d';
    ctx.beginPath();
    ctx.moveTo(hx - w / 2 - 4, hy - h);
    ctx.lineTo(hx, hy - h - 12);
    ctx.lineTo(hx + w / 2 + 4, hy - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = sky.night ? '#ffd34d' : '#2c4a6e';
    ctx.fillRect(hx - w / 4, hy - h + 6, 8, 8);
    ctx.fillRect(hx + w / 8, hy - h + 6, 8, 8);
  }

  // Lighthouse with a rotating beam.
  {
    const lh = game.world.lighthouse;
    const lx = screenX(game, lh.x);
    if (lx > -80 && lx < W + 80) {
      const ly = screenY(game, lh.y);
      const th = 64;
      ctx.fillStyle = '#f2ead8';
      ctx.fillRect(lx - 9, ly - th, 18, th);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(lx - 9, ly - th + 14, 18, 10);
      ctx.fillRect(lx - 9, ly - th + 38, 18, 10);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(lx - 12, ly - th - 10, 24, 12);
      const beamA = time * 0.9;
      const beamLen = 260;
      ctx.save();
      ctx.globalAlpha = sky.night ? 0.5 : 0.16;
      ctx.fillStyle = '#fff8c0';
      ctx.beginPath();
      ctx.moveTo(lx, ly - th - 4);
      ctx.lineTo(lx + Math.cos(beamA) * beamLen, ly - th - 4 + Math.sin(beamA) * 60);
      ctx.lineTo(lx + Math.cos(beamA) * beamLen, ly - th - 4 + Math.sin(beamA) * 60 + 26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(lx, ly - th - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Runway -----------------------------------------------------------------
  {
    const rw = game.world.runway;
    const x0 = screenX(game, rw.x0);
    const x1 = screenX(game, rw.x1);
    const ry = screenY(game, rw.y);
    if (x1 > -50 && x0 < W + 50) {
      ctx.fillStyle = '#3a3f46';
      ctx.fillRect(x0, ry - 7, x1 - x0, 12);
      ctx.fillStyle = '#f5f5f5';
      for (let x = x0 + 14; x < x1 - 10; x += 46) ctx.fillRect(x, ry - 2, 24, 3);
      // Threshold bars and the "27" marker.
      ctx.fillRect(x0 + 4, ry - 6, 8, 10);
      ctx.fillRect(x0 + 16, ry - 6, 8, 10);
      text(ctx, '27', x0 + 60, ry + 5, 'bold 15px monospace', '#f5f5f5', 'left');
      // Edge lights, glowing.
      ctx.save();
      ctx.shadowColor = '#7dffb0';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#7dffb0';
      for (let x = x0; x <= x1; x += 60) {
        ctx.beginPath();
        ctx.arc(x, ry - 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // Windsock at the near end.
      const wx = x0 - 26;
      const wy = ry - 8;
      ctx.strokeStyle = '#d8d8d8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx, wy - 44);
      ctx.stroke();
      const gust = Math.sin(time * 1.3) * 0.2;
      ctx.fillStyle = '#ff7a3d';
      ctx.beginPath();
      ctx.moveTo(wx, wy - 44);
      ctx.lineTo(wx + 30, wy - 40 + gust * 20);
      ctx.lineTo(wx + 30, wy - 30 + gust * 20);
      ctx.lineTo(wx, wy - 34);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- Rings --------------------------------------------------------------------
  for (const ring of game.world.rings) {
    if (ring.taken) continue;
    const rx = screenX(game, ring.x);
    if (rx < -80 || rx > W + 80) continue;
    const ry = screenY(game, ring.y);
    const rr = ring.r * SCALE;
    const pulse = 1 + Math.sin(time * 3 + ring.phase) * 0.06;
    const isNext = ring === nextRing(game.world);
    ctx.save();
    if (ring.missed) {
      // A missed ring stays on the course, dimmed, as a reminder.
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#9aa5ad';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.shadowColor = isNext ? '#ffd34d' : '#ff9a3d';
    ctx.shadowBlur = isNext ? 22 : 10;
    ctx.strokeStyle = isNext ? '#ffd34d' : '#ffb03d';
    ctx.lineWidth = isNext ? 7 : 5;
    ctx.beginPath();
    ctx.arc(rx, ry, rr * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, rr * pulse * 0.82, -0.4, 0.9);
    ctx.stroke();
    ctx.restore();
  }
  // Arrow to the next ring when it is off-screen.
  {
    const ring = nextRing(game.world);
    if (ring && game.screen === 'playing') {
      const rx = screenX(game, ring.x);
      if (rx > W - 40 || rx < 40) {
        const ax = rx > W - 40 ? W - 60 : 60;
        const ay = Math.max(90, Math.min(520, screenY(game, ring.y)));
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath();
        ctx.moveTo(ax + (rx > W - 40 ? 18 : -18), ay);
        ctx.lineTo(ax, ay - 12);
        ctx.lineTo(ax, ay + 12);
        ctx.closePath();
        ctx.fill();
        text(ctx, `${Math.round(Math.abs(ring.x - game.plane.x))}m`, ax, ay + 30, 'bold 13px monospace', '#ffd34d', 'center');
      }
    }
  }

  // --- Particles ---------------------------------------------------------------
  for (const p of particles.list) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc((p.x - camX(game)) * SCALE, screenY(game, p.y), p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // --- The plane -----------------------------------------------------------------
  drawPlane(ctx, game, time);

  // --- Speed lines ---------------------------------------------------------------
  if (game.plane.vx > 46 && game.screen === 'playing') {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const ly = 90 + ((i * 97 + Math.floor(time * 240)) % 420);
      const lx = ((i * 311 + Math.floor(time * 900)) % 1100) + 60;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 60, ly);
      ctx.stroke();
    }
  }

  // --- HUD -----------------------------------------------------------------------
  if (game.screen !== 'title') drawHud(ctx, game, time);

  // --- Instrument strip -----------------------------------------------------------
  if (game.screen !== 'title') drawPanel(ctx, game, time);

  // --- Screens ----------------------------------------------------------------------
  if (game.screen === 'title') drawTitle(ctx, game, time);
  else if (game.screen === 'paused') drawPaused(ctx, game);
  else if (game.screen === 'complete') drawComplete(ctx, game);
  else if (game.screen === 'gameover') drawGameOver(ctx, game);
}

/** The bush plane, drawn as vector art, nose to the right, banking with pitch. */
function drawPlane(ctx, game, time) {
  const plane = game.plane;
  const pos = planeScreenPos(game);
  const ground = terrainHeightAt(game.world, plane.x);
  const altAbove = plane.alt - ground;

  // Soft shadow on the ground below.
  if (altAbove < 90) {
    const shY = screenY(game, ground);
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, 0.3 - altAbove * 0.003);
    ctx.fillStyle = '#1a2a1a';
    ctx.beginPath();
    ctx.ellipse(pos.x, shY + 4, 34, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(-plane.pitch);
  const shake = game.shake > 0 ? (Math.random() - 0.5) * game.shake * 14 : 0;
  ctx.translate(0, shake);

  // Wing (the low wing, seen edge-on from the side).
  ctx.fillStyle = '#c0392b';
  roundRect(ctx, -6, 2, 44, 7, 3);
  ctx.fill();
  // Tail fin.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-34, -2);
  ctx.lineTo(-44, -22);
  ctx.lineTo(-34, -20);
  ctx.lineTo(-26, -2);
  ctx.closePath();
  ctx.fill();
  // Tailplane.
  ctx.fillStyle = '#a93226';
  ctx.beginPath();
  ctx.moveTo(-36, 0);
  ctx.lineTo(-48, -8);
  ctx.lineTo(-40, -8);
  ctx.lineTo(-30, 2);
  ctx.closePath();
  ctx.fill();
  // Fuselage.
  ctx.fillStyle = '#f5f2ea';
  roundRect(ctx, -36, -12, 72, 20, 9);
  ctx.fill();
  // Red cheatline.
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-36, 0, 72, 4);
  // Cockpit window.
  ctx.fillStyle = '#9fd8ef';
  roundRect(ctx, 8, -10, 20, 9, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(11, -9, 6, 3);
  // Nose + spinner.
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath();
  ctx.arc(38, -2, 5, 0, Math.PI * 2);
  ctx.fill();
  // Propeller disc (spinning blur) + blades.
  const spin = time * 28;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = '#dfe6ea';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(40, -2, 4, 26, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#34495e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, -2);
  ctx.lineTo(40 + Math.cos(spin) * 24, -2 + Math.sin(spin) * 24);
  ctx.moveTo(40, -2);
  ctx.lineTo(40 - Math.cos(spin) * 24, -2 - Math.sin(spin) * 24);
  ctx.stroke();
  // Landing gear.
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 8);
  ctx.lineTo(-12, 20);
  ctx.moveTo(16, 8);
  ctx.lineTo(20, 20);
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-12, 22, 5, 0, Math.PI * 2);
  ctx.arc(20, 22, 5, 0, Math.PI * 2);
  ctx.fill();
  // Tail number.
  text(ctx, 'SC-1', -30, -14, 'bold 9px monospace', '#c0392b', 'left');
  ctx.restore();
}

/** Top HUD: altitude, speed, heading, fuel, hearts, score, rings, mission. */
function drawHud(ctx, game, time) {
  const plane = game.plane;
  const altFt = Math.round(plane.alt * 3.28084);
  const spdKt = Math.round(plane.vx * 1.94384);
  const hdg = 90 + Math.round(plane.pitch * 57.3 * 0.12 + Math.sin(time * 0.7) * 0.6);
  const mission = game.mission;

  // Left cluster: the three required readouts, big and lit.
  ctx.fillStyle = 'rgba(10,20,32,0.72)';
  roundRect(ctx, 16, 14, 400, 84, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125,255,176,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, 'ALT', 30, 34, 'bold 12px monospace', '#7dffb0', 'left');
  text(ctx, `${altFt}`, 30, 66, 'bold 30px monospace', '#eafcff', 'left', '#7dffb0');
  text(ctx, 'FT', 118, 66, 'bold 13px monospace', '#7dffb0', 'left');
  text(ctx, 'SPD', 168, 34, 'bold 12px monospace', '#7dffb0', 'left');
  text(ctx, `${spdKt}`, 168, 66, 'bold 30px monospace', '#eafcff', 'left', '#7dffb0');
  text(ctx, 'KT', 244, 66, 'bold 13px monospace', '#7dffb0', 'left');
  text(ctx, 'HDG', 296, 34, 'bold 12px monospace', '#7dffb0', 'left');
  text(ctx, `${String(hdg).padStart(3, '0')}°`, 296, 66, 'bold 30px monospace', '#eafcff', 'left', '#7dffb0');

  // Centre: mission + rings + score.
  text(ctx, mission.name.toUpperCase(), 640, 34, 'bold 17px monospace', '#ffffff', 'center', 'rgba(0,0,0,0.5)');
  const ringText = `◉ ${game.ringsTaken}/${mission.rings} RINGS`;
  text(ctx, ringText, 640, 58, 'bold 14px monospace', '#ffd34d', 'center');
  text(ctx, `SCORE ${game.score}`, 640, 84, 'bold 15px monospace', '#ffffff', 'center');

  // Right cluster: hearts, fuel, throttle.
  ctx.fillStyle = 'rgba(10,20,32,0.72)';
  roundRect(ctx, 1000, 14, 264, 84, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125,255,176,0.5)';
  ctx.stroke();
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += i < game.hearts ? '♥ ' : '♡ ';
  text(ctx, hearts, 1016, 40, 'bold 18px sans-serif', '#ff6b6b', 'left');
  text(ctx, 'FUEL', 1016, 62, 'bold 12px monospace', '#7dffb0', 'left');
  const fuelW = 150;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, 1064, 50, fuelW, 14, 7);
  ctx.fill();
  const fuelFrac = Math.max(0, game.fuel / 100);
  ctx.fillStyle = game.fuel < 18 ? '#ff5a4d' : '#ffd34d';
  if (fuelFrac > 0) {
    roundRect(ctx, 1064, 50, fuelW * fuelFrac, 14, 7);
    ctx.fill();
  }
  text(ctx, `${Math.round(game.fuel)}%`, 1224, 63, 'bold 12px monospace', '#ffffff', 'left');
  text(ctx, `THR ${Math.round(plane.throttle * 100)}%${plane.flaps ? ' · FLAPS' : ''}`, 1016, 88, 'bold 12px monospace', '#9fd8ef', 'left');

  // Flash banner (ring collected, hard landing, ...). Only during play:
  // the end screens carry their own titles at the same height.
  if (game.flashT > 0 && (game.screen === 'playing' || game.screen === 'paused')) {
    ctx.globalAlpha = Math.min(1, game.flashT);
    text(ctx, game.flash, 640, 150, 'bold 34px monospace', '#ffd34d', 'center', '#7a4d00');
    ctx.globalAlpha = 1;
  }
  // Message line (low fuel, engine out, ...).
  if (game.messageT > 0 && (game.screen === 'playing' || game.screen === 'paused')) {
    ctx.globalAlpha = Math.min(1, game.messageT);
    text(ctx, game.message, 640, 186, 'bold 19px monospace', '#ff8a7a', 'center', 'rgba(0,0,0,0.6)');
    ctx.globalAlpha = 1;
  }
  // Gust warning on the windy sortie.
  if (game.mission.wind > 0 && game.screen === 'playing') {
    text(ctx, '⚠ GUSTS', 640, 216, 'bold 14px monospace', '#ffb03d', 'center');
  }
}

/** The lit instrument strip along the bottom of the frame. */
function drawPanel(ctx, game, time) {
  const { W } = CANVAS;
  ctx.fillStyle = '#10161d';
  ctx.fillRect(0, PANEL.y, W, PANEL.h);
  ctx.fillStyle = '#1d2833';
  ctx.fillRect(0, PANEL.y, W, 3);

  const cy = PANEL.y + 57;
  // --- Attitude indicator ---------------------------------------------------
  const ax = 90;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, cy, 44, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#3d8fd1';
  ctx.fillRect(ax - 46, cy - 46, 92, 46 - game.plane.pitch * 40);
  ctx.fillStyle = '#8a6b3d';
  ctx.fillRect(ax - 46, cy - game.plane.pitch * 40, 92, 46 + game.plane.pitch * 40);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax - 46, cy - game.plane.pitch * 40);
  ctx.lineTo(ax + 46, cy - game.plane.pitch * 40);
  ctx.stroke();
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax - 22, cy);
  ctx.lineTo(ax + 22, cy);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#7dffb0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, cy, 44, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, 'ATT', ax, PANEL.y + 108, 'bold 11px monospace', '#7dffb0', 'center');

  // --- Altimeter tape ---------------------------------------------------------
  drawTape(ctx, 250, cy, 34, 88, game.plane.alt * 3.28084, 100, 'FT', '#eafcff');
  text(ctx, 'ALT', 250, PANEL.y + 108, 'bold 11px monospace', '#7dffb0', 'center');
  // --- Speed tape --------------------------------------------------------------
  drawTape(ctx, 340, cy, 34, 88, game.plane.vx * 1.94384, 10, 'KT', '#eafcff');
  text(ctx, 'SPD', 340, PANEL.y + 108, 'bold 11px monospace', '#7dffb0', 'center');

  // --- Compass strip ------------------------------------------------------------
  {
    const cx = 640;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, cx - 190, cy - 26, 380, 52, 8);
    ctx.fill();
    const hdg = 90 + game.plane.pitch * 57.3 * 0.12;
    for (let d = -60; d <= 60; d += 10) {
      const deg = Math.round(hdg + d);
      const x = cx + d * 3;
      const label = deg % 90 === 0 ? ['N', 'E', 'S', 'W'][(Math.round(deg / 90) % 4 + 4) % 4] : String(((deg % 360) + 360) % 360);
      ctx.strokeStyle = '#9fd8ef';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, cy - 12);
      ctx.lineTo(x, cy + 12);
      ctx.stroke();
      text(ctx, label, x, cy + 24, 'bold 11px monospace', '#eafcff', 'center');
    }
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 26);
    ctx.lineTo(cx - 6, cy - 36);
    ctx.lineTo(cx + 6, cy - 36);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'HDG', cx, PANEL.y + 108, 'bold 11px monospace', '#7dffb0', 'center');
  }

  // --- Fuel gauge ----------------------------------------------------------------
  {
    const fx = 900;
    text(ctx, 'FUEL', fx, cy - 30, 'bold 11px monospace', '#7dffb0', 'center');
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, fx - 12, cy - 22, 24, 84, 6);
    ctx.fill();
    const fh = 84 * Math.max(0, game.fuel / 100);
    ctx.fillStyle = game.fuel < 18 ? '#ff5a4d' : '#ffd34d';
    if (fh > 0) {
      roundRect(ctx, fx - 12, cy + 62 - fh, 24, fh, 6);
      ctx.fill();
    }
    text(ctx, `${Math.round(game.fuel)}`, fx, cy + 78, 'bold 11px monospace', '#ffffff', 'center');
  }

  // --- Throttle lever --------------------------------------------------------------
  {
    const tx = 1010;
    text(ctx, 'THR', tx, cy - 30, 'bold 11px monospace', '#7dffb0', 'center');
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, tx - 4, cy - 22, 8, 84, 4);
    ctx.fill();
    const leverY = cy + 62 - game.plane.throttle * 84;
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(tx, leverY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(tx, leverY, 4, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, `${Math.round(game.plane.throttle * 100)}%`, tx, cy + 78, 'bold 11px monospace', '#ffffff', 'center');
  }

  // --- Flaps + hints ------------------------------------------------------------------
  text(ctx, game.plane.flaps ? 'FLAPS DOWN' : 'FLAPS UP', 1150, cy - 6, 'bold 12px monospace', game.plane.flaps ? '#ffd34d' : '#9fd8ef', 'center');
  text(ctx, '↑↓ pitch · ←→ throttle', 1150, cy + 16, '11px monospace', '#8fa8bd', 'center');
  text(ctx, 'F flaps · P pause · M mute', 1150, cy + 34, '11px monospace', '#8fa8bd', 'center');
}

/** A vertical scrolling tape (altimeter / speed): value in the middle, ticks around it. */
function drawTape(ctx, x, cy, w, h, value, step, unit, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, x - w / 2, cy - h / 2, w, h, 6);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w / 2, cy - h / 2, w, h);
  ctx.clip();
  const pxPerUnit = h / (step * 4);
  const base = Math.floor(value / step) * step;
  for (let v = base - step * 2; v <= base + step * 2; v += step) {
    const y = cy + (value - v) * pxPerUnit;
    ctx.strokeStyle = 'rgba(234,252,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 3, y);
    ctx.lineTo(x + w / 2 - 3, y);
    ctx.stroke();
    text(ctx, String(Math.round(v)), x, y + 4, '10px monospace', color, 'center');
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(10,20,32,0.85)';
  roundRect(ctx, x - w / 2 - 6, cy - 11, w + 12, 22, 5);
  ctx.fill();
  ctx.strokeStyle = '#7dffb0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, String(Math.round(value)), x, cy + 5, 'bold 13px monospace', '#eafcff', 'center');
  text(ctx, unit, x, cy + h / 2 + 16, 'bold 10px monospace', '#7dffb0', 'center');
}

function dim(ctx) {
  ctx.fillStyle = 'rgba(6,12,20,0.55)';
  ctx.fillRect(0, 0, CANVAS.W, CANVAS.H);
}

function drawTitle(ctx, game, time) {
  dim(ctx);
  const { W } = CANVAS;
  text(ctx, 'SKY COURIER', W / 2, 190, 'bold 84px sans-serif', '#ffffff', 'center', 'rgba(0,0,0,0.7)');
  text(ctx, '— ISLAND RUN —', W / 2, 232, 'bold 24px monospace', '#ffd34d', 'center');
  text(ctx, 'Fly the mail between the islands. Thread the rings, mind the fuel,', W / 2, 286, '18px sans-serif', '#eafcff', 'center');
  text(ctx, 'and put her down gently on the strip at the far end.', W / 2, 312, '18px sans-serif', '#eafcff', 'center');

  // Mission cards.
  const cards = game.missionCards || [];
  const cw = 250;
  const gap = 30;
  const x0 = W / 2 - (cw * 3 + gap * 2) / 2;
  cards.forEach((card, i) => {
    const x = x0 + i * (cw + gap);
    const y = 350;
    ctx.fillStyle = i === game.missionIndex ? 'rgba(255,211,77,0.16)' : 'rgba(10,20,32,0.72)';
    roundRect(ctx, x, y, cw, 130, 12);
    ctx.fill();
    ctx.strokeStyle = i === game.missionIndex ? '#ffd34d' : 'rgba(125,255,176,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, `${i + 1}. ${card.name}`, x + 16, y + 32, 'bold 17px sans-serif', '#ffffff', 'left');
    text(ctx, card.sub, x + 16, y + 56, '13px sans-serif', '#9fd8ef', 'left');
    text(ctx, `◉ ${card.rings} rings · ${Math.round(card.length / 1000)} km`, x + 16, y + 82, '13px monospace', '#eafcff', 'left');
    text(ctx, card.stars > 0 ? '★'.repeat(card.stars) + '☆'.repeat(3 - card.stars) : 'not flown yet', x + 16, y + 110, 'bold 16px sans-serif', '#ffd34d', 'left');
  });

  const blink = 0.55 + 0.45 * Math.sin(time * 4);
  ctx.globalAlpha = blink;
  text(ctx, 'PRESS ENTER OR CLICK TO FLY', W / 2, 526, 'bold 22px monospace', '#ffffff', 'center');
  ctx.globalAlpha = 1;
  text(ctx, '↑ / ↓ pitch · ← / → throttle · F flaps · mouse steers · P pause · M mute', W / 2, 560, '15px monospace', '#cfe8f7', 'center');
  if (game.best > 0) text(ctx, `BEST SCORE ${game.best}`, W / 2, 606, 'bold 14px monospace', '#ffd34d', 'center');
}

function drawPaused(ctx, game) {
  dim(ctx);
  text(ctx, 'PAUSED', 640, 330, 'bold 56px sans-serif', '#ffffff', 'center', 'rgba(0,0,0,0.6)');
  text(ctx, 'Press P or click to keep flying', 640, 380, '18px sans-serif', '#cfe8f7', 'center');
}

function drawComplete(ctx, game) {
  dim(ctx);
  const b = game.breakdown || { rings: 0, landing: 0, fuel: 0, time: 0, total: game.score };
  const title = game.landed && game.stars >= 2 ? 'DELIVERY COMPLETE' : game.landed ? 'LANDED' : 'SORTIE OVER';
  text(ctx, title, 640, 210, 'bold 52px sans-serif', '#ffffff', 'center', 'rgba(0,0,0,0.6)');
  const stars = '★'.repeat(game.stars) + '☆'.repeat(3 - game.stars);
  text(ctx, stars, 640, 268, 'bold 44px sans-serif', '#ffd34d', 'center', '#7a4d00');
  const rows = [
    ['Mail rings', `+${b.rings}`],
    ['Landing', `+${b.landing}`],
    ['Fuel left', `+${b.fuel}`],
    ['Time bonus', `+${b.time}`],
  ];
  let y = 320;
  for (const [label, val] of rows) {
    text(ctx, label, 520, y, '18px monospace', '#cfe8f7', 'left');
    text(ctx, val, 760, y, 'bold 18px monospace', '#ffffff', 'right');
    y += 34;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(520, y - 8);
  ctx.lineTo(760, y - 8);
  ctx.stroke();
  text(ctx, 'TOTAL', 520, y + 22, 'bold 20px monospace', '#ffd34d', 'left');
  text(ctx, `${b.total}`, 760, y + 22, 'bold 24px monospace', '#ffd34d', 'right');
  const next = game.missionIndex + 1 < 3;
  text(ctx, next ? 'N — next sortie · R — fly again · ENTER — menu' : 'R — fly again · ENTER — menu', 640, y + 84, '17px monospace', '#ffffff', 'center');
}

function drawGameOver(ctx, game) {
  dim(ctx);
  text(ctx, 'MISSION FAILED', 640, 300, 'bold 52px sans-serif', '#ff8a7a', 'center', 'rgba(0,0,0,0.6)');
  text(ctx, game.message || 'The plane is down.', 640, 350, '20px sans-serif', '#eafcff', 'center');
  text(ctx, `Score ${game.score} · Rings ${game.ringsTaken}/${game.mission.rings}`, 640, 388, '18px monospace', '#cfe8f7', 'center');
  text(ctx, 'R — try again · ENTER — menu', 640, 440, '17px monospace', '#ffffff', 'center');
}
