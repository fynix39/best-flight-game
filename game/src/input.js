// Keyboard and mouse input. One job: read the devices and hand the game a
// plain action object each frame — the rules never see a key event.

/** The action the game reads: all false until a key or the mouse says so. */
export function emptyAction() {
  return {
    pitchUp: false, pitchDown: false,
    throttleUp: false, throttleDown: false,
    flaps: false, pause: false, mute: false,
    confirm: false, restart: false, next: false,
    // Mouse steering: the pointer's screen position, or null.
    pointer: null, pointerDown: false,
    wheel: 0, // mouse wheel delta this frame (throttle)
  };
}

/**
 * Attach listeners to `target` (the window). Returns the live action object
 * plus helpers; call `endFrame(action)` after each step to clear edge events.
 */
export function attachInput(target, canvas) {
  const action = emptyAction();
  const keys = new Set();
  const pressed = new Set(); // keys pressed since the last frame (edges)
  let pointer = null;
  let pointerDown = false;

  function keyName(e) {
    const k = e.key.toLowerCase();
    if (k === ' ') return 'space';
    return k;
  }

  target.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  target.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  target.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  });
  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    const r = canvas.getBoundingClientRect();
    pointer = { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  });
  target.addEventListener('pointerup', () => { pointerDown = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    action.wheel += e.deltaY < 0 ? 1 : -1;
  }, { passive: false });

  return {
    action,
    /** Fill the action from this frame's device state. */
    readAction() {
      action.pitchUp = keys.has('arrowup') || keys.has('w');
      action.pitchDown = keys.has('arrowdown') || keys.has('s');
      action.throttleUp = keys.has('arrowright') || keys.has('d');
      action.throttleDown = keys.has('arrowleft') || keys.has('a');
      action.flaps = keys.has('f');
      action.pause = pressed.has('p') || pressed.has('escape');
      action.mute = pressed.has('m');
      action.confirm = pressed.has('enter') || pressed.has('space');
      action.restart = pressed.has('r');
      action.next = pressed.has('n');
      action.pointer = pointer;
      action.pointerDown = pointerDown;
      if (action.wheel > 0) { action.throttleUp = true; action.wheel = 0; }
      if (action.wheel < 0) { action.throttleDown = true; action.wheel = 0; }
      return action;
    },
    /** Clear the edge presses; call once per frame after the step. */
    endFrame() {
      pressed.clear();
      action.wheel = 0;
    },
  };
}

/**
 * Mouse steering: turn the pointer position into a pitch action. The plane
 * climbs toward a pointer above it and descends toward one below it; the
 * further the pointer, the harder the stick. Returns { pitchUp, pitchDown }.
 */
export function pointerSteering(pointer, planeScreenY) {
  if (!pointer) return { pitchUp: false, pitchDown: false };
  const dy = pointer.y - planeScreenY;
  if (dy < -24) return { pitchUp: true, pitchDown: false };
  if (dy > 24) return { pitchUp: false, pitchDown: true };
  return { pitchUp: false, pitchDown: false };
}
