import { Storage } from './Storage.js';

// Player options (persisted). Read with Settings.get('key'); write with Settings.set('key', v).
const DEFAULTS = {
  crt: false, crtStrength: 0.3, reduce: false, ui3d: true, hud3d: true,
  sens: 1, aimSens: 0.55, ySens: 1, fov: 55, camDist: 270, invertY: false,
  dmgNums: true, aimAssist: 1,
  hudScale: 1, hudOpacity: 1, hudCorner: 'bottom', lowQ: false,
  master: 0.6, sfx: 1, music: 1,
  keys: {},
};

let cache = null;
function load() {
  if (cache) return cache;
  cache = { ...DEFAULTS, ...(Storage.get('settings', {}) || {}) };
  // migrate the first settings toggles
  const oc = Storage.get('set.crt', null), orr = Storage.get('set.reduce', null);
  if (oc != null && Storage.get('settings', null) == null) cache.crt = oc;
  if (orr != null && Storage.get('settings', null) == null) cache.reduce = orr;
  return cache;
}

export const Settings = {
  get(k) { return load()[k]; },
  set(k, v) { load()[k] = v; Storage.set('settings', cache); },
  all() { return load(); },
  DEFAULTS,
};
