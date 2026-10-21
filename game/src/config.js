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
    dur: [0.22, 0.22, 0.34],
    hitAt: 0.45,
    cancelAt: 0.7, // a buffered slash may start the next combo step after this fraction of the swing
    comboWindow: 0.45,
    critMult: 3,
    knock: 46,
  },
  PARRY: { perfect: 0.15, block: 0.35, cooldown: 0.7, blockReduce: 0.3, counterWindow: 1.0, slowmo: 0.12,
    // Perfect-parry feel: camera zoom punch, edge dim, streak counter, refunds, attacker knockback.
    fovPunch: 6, punchTime: 0.25, dimTime: 0.35, streakWindow: 3, staminaRefund: 15, knock: 70, blockPush: 140 },
  GUN: { dmg: 15, speed: 720, cooldown: 0.22, radius: 8, assistCone: 0.14, aimMult: 1.5, aimSpeedMult: 1.2, aimCone: 0.06 },
  // Sekiro-style posture: filling an enemy's bar breaks it (stunned, deathblow x3). Player has one too.
  POSTURE: { regen: 14, delay: 1.6, brokenTime: 2.5, deathblow: 3, sword: [8, 8, 16], critMult: 2, parryMin: 25, parryFrac: 0.5, reflectHit: 25, bossStun: 3.5 },
  PLAYER_POSTURE: { max: 100, regen: 18, delay: 1.0, blockMult: 1.6, blockAdd: 4, hitMult: 0.6, perfectRelief: 25, brokenTime: 1.4 },
  CAMERA: { dist: 270, gunDist: 230, aimDist: 185, fov: 55, gunFov: 50, aimFov: 40, shoulder: 38 },
  TONGUE: { range: 200, cost: 25, regen: 35, regenDelay: 0.4, dur: 0.3, resolveAt: 0.12, halfArc: 0.45 },
  DODGE: { dur: 0.22, speedMult: 3.2, iframes: 0.3, cooldown: 0.55, roll: 0.07 },
  // Zones spawn in quick waves: the next wave arrives after waveGap s or when few bugs are left.
  ZONE: { firstWave: 0.6, waveGap: 3.5, clearLeft: 3 },
  // Phase 2 bosses run their attack timers faster; all boss cooldowns are scaled by cdMult.
  BOSS: { ph2Speed: 1.3, cdMult: 0.8, preludeDur: 4.2 },
  GHOST: { hp: 150, echoEvery: 4, echoRange: 900, echoDmg: 10 },
  POWERUP: { duration: 12, snail: 6, dropChance: 0.12 },
  SAMPLE_DT: 0.05,

  KEYS: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    jump: 'Space', dodge: 'ShiftLeft', shoot: 'KeyF', tongue: 'KeyE', pause: 'KeyP', mute: 'KeyM',
    weapon: 'KeyQ', sword: 'Digit1', gun: 'Digit2',
  },
};

export const POWERUPS = {
  firefly:  { color: 0xff9922, label: 'Firefly',      desc: 'Flaming bullets' },
  dragon:   { color: 0x44ddff, label: 'Dragonfly',    desc: 'Speed + double jump' },
  shell:    { color: 0x8899ff, label: 'Beetle Shell', desc: 'Blocks 3 hits' },
  snail:    { color: 0xcc88ff, label: 'Time Snail',   desc: 'Slows ghost + bugs' },
  bigmouth: { color: 0xff6688, label: 'Big Mouth',    desc: 'Long tongue' },
  ammo:     { color: 0xffee44, label: 'Ammo Moth',    desc: '+6 ammo' },
  golden:   { color: 0xffd700, label: 'Golden Fly',   desc: 'Rewind 3 seconds' },
  over:     { color: 0xff5555, label: 'Overclock',    desc: 'Parry window x2' },
};
