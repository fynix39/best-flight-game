// Sky Courier — Island Run: tuning, missions and palette.
// One job: every number the game balances on lives here, so a fix is one edit.

// Canvas and the fixed simulation step (the game steps at 60 Hz, rendered each frame).
export const CANVAS = { W: 1280, H: 720 };
export const STEP = 1 / 60;
// World scale: 1 metre of sky is this many screen pixels.
export const SCALE = 3;

// The plane. Speeds are m/s, altitudes are metres above the sea.
export const PLANE = {
  // Forward speed the engine can hold at full throttle, level flight.
  maxSpeed: 58,
  // Below this the wing stops flying and the nose drops.
  stallSpeed: 17,
  // How hard the engine pushes (m/s^2 at full throttle).
  thrust: 26,
  // Quadratic drag, tuned so level cruise sits near 42 m/s at 70% throttle.
  drag: 0.0085,
  // How fast the nose answers the stick (rad/s).
  pitchRate: 1.5,
  maxPitch: 0.62,
  // How strongly the wing pulls the flight path toward where the nose points.
  liftRate: 2.4,
  // Flaps (F): slower, more lift, more drag — for the final approach.
  flapDrag: 0.016,
  flapLift: 3.4,
  flapMaxSpeed: 34,
  // Fuel burn at full throttle, per second; rings refund fuel.
  burnPerSecond: 0.85,
  ringFuel: 10,
};

// Landing: touch the strip this gently and you are down.
export const LANDING = {
  maxSink: 3.6, // m/s down
  minSpeed: 11, // m/s
  maxSpeed: 32, // m/s
  maxPitch: 0.26, // rad off level
};

// Scoring.
export const SCORE = {
  ring: 250,
  landingBase: 500,
  fuelBonusPerPoint: 10, // per fuel point left at touchdown
  timeBonusPerSecond: 5, // per second under the mission par time
};

// Three sorties. Each is one island hop: collect the mail rings, then land on
// the strip at the far end before the tank runs dry.
export const MISSIONS = [
  {
    name: 'First Light',
    sub: 'Dawn mail run · Calm air',
    rings: 5,
    length: 4600, // metres of island to cross
    fuel: 100,
    wind: 0, // gust strength, m/s
    parTime: 150, // seconds, for the time bonus
    sky: { top: '#5fb2ef', mid: '#a5d8f7', low: '#e8f6ff', sun: '#fff3b0', night: false },
    sea: '#2e7fb8',
    grass: '#5da24a',
    hill: '#3e7d3a',
  },
  {
    name: 'Crosswind',
    sub: 'Sunset mail run · Gusty air',
    rings: 7,
    length: 6200,
    fuel: 100,
    wind: 5.5,
    parTime: 200,
    sky: { top: '#5a4a8f', mid: '#ff9a5c', low: '#ffd9a0', sun: '#ffdf8a', night: false },
    sea: '#3d5a8f',
    grass: '#7a8a3f',
    hill: '#5c6e33',
  },
  {
    name: 'Night Mail',
    sub: 'Night mail run · Lighthouse beacon',
    rings: 6,
    length: 6200,
    fuel: 95,
    wind: 2.5,
    parTime: 210,
    sky: { top: '#060b24', mid: '#16224d', low: '#2c3d6e', sun: '#f4f1de', night: true },
    sea: '#16294d',
    grass: '#2f5233',
    hill: '#223d28',
  },
];

// The ring line: how the mail rings are laid out along a sortie.
export const RING = { radius: 13, minAlt: 50, maxAlt: 170 };

// Screen-space layout of the cockpit instruments (bottom strip).
export const PANEL = { y: 578, h: 142 };
