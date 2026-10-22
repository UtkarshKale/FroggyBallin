import { CFG } from '../config.js';
import { Settings } from './Settings.js';

// Rebindable actions. Codes are KeyboardEvent.code values or 'Mouse0' / 'Mouse1' / 'Mouse2' for mouse buttons.
export const ACTIONS = [
  ['forward', 'MOVE FORWARD'], ['back', 'MOVE BACK'], ['left', 'MOVE LEFT'], ['right', 'MOVE RIGHT'],
  ['jump', 'JUMP'], ['dodge', 'DODGE'], ['slash', 'SWORD / FIRE'], ['parry', 'PARRY / AIM'],
  ['shoot', 'QUICK SLASH'], ['tongue', 'TONGUE'], ['weapon', 'SWAP WEAPON'], ['sword', 'SWORD'], ['gun', 'GUN'],
  ['ult', 'ULTIMATE'], ['power', 'USE POWER-UP'], ['pause', 'PAUSE'], ['mute', 'MUTE'], ['restart', 'RESTART (STATS)'],
];

export const DEFAULT_KEYS = { ...CFG.KEYS };

export function keyName(code) {
  if (!code) return '-';
  if (code === 'Mouse0') return 'LMB';
  if (code === 'Mouse1') return 'MMB';
  if (code === 'Mouse2') return 'RMB';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace('ShiftLeft', 'L-SHIFT').replace('ShiftRight', 'R-SHIFT')
    .replace('ControlLeft', 'L-CTRL').replace('ControlRight', 'R-CTRL').replace('AltLeft', 'L-ALT').replace('Space', 'SPACE');
}

export const Keybinds = {
  apply() { Object.assign(CFG.KEYS, DEFAULT_KEYS, Settings.get('keys') || {}); },
  key(a) { return CFG.KEYS[a]; },
  // Binds a code; if another action already uses it, the two swap (returns the swapped action or null).
  bind(action, code) {
    const k = { ...(Settings.get('keys') || {}) };
    let swapped = null;
    for (const [a] of ACTIONS) {
      if (a !== action && CFG.KEYS[a] === code) { k[a] = CFG.KEYS[action]; swapped = a; }
    }
    k[action] = code;
    Settings.set('keys', k);
    this.apply();
    return swapped;
  },
  reset(action) { const k = { ...(Settings.get('keys') || {}) }; delete k[action]; Settings.set('keys', k); this.apply(); },
  resetAll() { Settings.set('keys', {}); this.apply(); },
  label(a) { return (ACTIONS.find((x) => x[0] === a) || [a, a])[1]; },
};
