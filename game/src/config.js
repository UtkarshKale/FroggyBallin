// All gameplay tunables live here. Distances are world units (Tode is ~46 tall).
export const CFG = {
  ARENA_HALF: 1000,
  // Course models face a different way than our +X "forward"; tweak if Tode walks sideways.
  MODEL_FACING: Math.PI / 2,

  PLAYER: { height: 46, radius: 16, speed: 250, hp: 100, maxAmmo: 12, startAmmo: 8, jumpV: 340, gravity: 950, accel: 14 },
  SWORD: {
    dmg: [18, 18, 35],
    range: [105, 105, 125],
    halfArc: [1.2, 1.2, 1.7],
    dur: [0.26, 0.26, 0.4],
    hitAt: 0.45,
    comboWindow: 0.45,
    critMult: 3,
    knock: 46,
  },
  PARRY: { perfect: 0.15, block: 0.35, cooldown: 0.7, blockReduce: 0.3, counterWindow: 1.0, slowmo: 0.12 },
  GUN: { dmg: 15, speed: 720, cooldown: 0.22, radius: 8, assistCone: 0.14 },
  TONGUE: { range: 200, cost: 25, regen: 35, regenDelay: 0.4, dur: 0.3, resolveAt: 0.12, halfArc: 0.45 },
  DODGE: { dur: 0.22, speedMult: 3.2, iframes: 0.3, cooldown: 0.8 },
  GHOST: { hp: 150, echoEvery: 4, echoRange: 900, echoDmg: 10 },
  POWERUP: { duration: 12, snail: 6, dropChance: 0.12 },
  SAMPLE_DT: 0.05,

  KEYS: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    jump: 'Space', dodge: 'ShiftLeft', shoot: 'KeyF', tongue: 'KeyE', pause: 'KeyP', mute: 'KeyM',
  },
};

export const POWERUPS = {
  firefly:  { color: 0xff9922, label: 'Firefly',      desc: 'Flaming bullets' },
  dragon:   { color: 0x44ddff, label: 'Dragonfly',    desc: 'Speed + double jump' },
  shell:    { color: 0x8899ff, label: 'Beetle Shell', desc: 'Blocks 3 hits' },
  snail:    { color: 0xcc88ff, label: 'Time Snail',   desc: 'Slows ghost + bugs' },
  bigmouth: { color: 0xff6688, label: 'Big Mouth',    desc: 'Long tongue' },
  ammo:     { color: 0xffee44, label: 'Ammo Moth',    desc: '+6 ammo' },
};
