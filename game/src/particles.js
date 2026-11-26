// Particles: ring bursts, exhaust puffs, landing smoke, crash fire.
// One job: a tiny pool of short-lived sparks the renderer draws. Pure data
// plus an update step; no DOM, no canvas calls in here.

/** A fresh, empty particle pool. */
export function createParticles() {
  return { list: [] };
}

function add(pool, p) {
  if (pool.list.length < 400) pool.list.push(p);
}

/** A gold burst where a mail ring was collected. */
export function burstRing(pool, x, y) {
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
    const sp = 40 + Math.random() * 130;
    add(pool, {
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.7, maxLife: 0.7, size: 2 + Math.random() * 3.5,
      color: ['#ffd34d', '#fff3b0', '#ff9a3d'][i % 3], gravity: 30, drag: 0.94,
    });
  }
}

/** Grey exhaust puffs trailing the plane while the engine works. */
export function puffExhaust(pool, x, y, vx) {
  add(pool, {
    x, y: y + (Math.random() - 0.5) * 6, vx: vx * 0.2 - 30, vy: 8 + Math.random() * 10,
    life: 0.9, maxLife: 0.9, size: 3 + Math.random() * 4,
    color: 'rgba(200,210,220,0.55)', gravity: -6, drag: 0.96,
  });
}

/** White smoke puffs kicked up by a touchdown. */
export function puffSmoke(pool, x, y) {
  for (let i = 0; i < 8; i++) {
    add(pool, {
      x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 6,
      vx: (Math.random() - 0.5) * 40, vy: -12 - Math.random() * 22,
      life: 0.8, maxLife: 0.8, size: 4 + Math.random() * 6,
      color: 'rgba(235,235,230,0.6)', gravity: -14, drag: 0.93,
    });
  }
}

/** Fire and smoke for a crash. */
export function burstCrash(pool, x, y) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 220;
    add(pool, {
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
      life: 0.9, maxLife: 0.9, size: 3 + Math.random() * 6,
      color: ['#ff7a2d', '#ffb03d', '#5a5a5a', '#ff3d2d'][i % 4], gravity: 120, drag: 0.92,
    });
  }
}

/** Step every particle forward; dead ones leave the pool. */
export function stepParticles(pool, dt) {
  for (const p of pool.list) {
    p.life -= dt;
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  pool.list = pool.list.filter((p) => p.life > 0);
}
