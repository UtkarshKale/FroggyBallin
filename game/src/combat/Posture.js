// Sekiro-style posture helpers shared by bugs, bosses and the ghost.
export function initPosture(e, max) {
  e.postureMax = max;
  e.posture = 0;
  e.postureT = 0;
  e.broken = 0;
}

export function tickPosture(e, dt, regen = 14) {
  if (!e.postureMax) return;
  if (e.broken > 0) { e.broken = Math.max(0, e.broken - dt); return; }
  if (e.postureT > 0) { e.postureT -= dt; return; }
  e.posture = Math.max(0, e.posture - regen * dt);
}
