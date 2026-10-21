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
  PARRY: { perfect: 0.15, block: 0.35, cooldown: 0.7, blockReduce: 0.3, counterWindow: 1.0, slowmo: 0.06,
    // Perfect-parry feel: camera zoom punch, edge dim, streak counter, refunds, attacker knockback.
    // Hitstops are short punches (wall-clock capped by maxHitstop); big parries punch then slow-mo.
    hitstop: 0.06, bigHitstop: 0.18, bigSlow: 0.3, breakHitstop: 0.08, bigBreakHitstop: 0.12, maxHitstop: 0.25, overlayMax: 0.6,
    fovPunch: 6, punchTime: 0.25, dimTime: 0.35, streakWindow: 3, staminaRefund: 15, knock: 70, blockPush: 140 },
  GUN: { dmg: 15, speed: 720, cooldown: 0.22, radius: 8, assistCone: 0.14, aimMult: 1.5, aimSpeedMult: 1.2, aimCone: 0.06,
    turnRate: 18, armTurn: 22, aimMin: 320, aimMax: 900, recoil: 7, spread: 0.05, aimSpread: 0.008, equipTime: 0.28, bulletZ: 30 },
  // F: quick sword flurry from any weapon (auto-draws the sword in gun mode, then returns to the gun).
  FLURRY: { hits: 3, gap: 0.1, dmg: 0.7, cooldown: 1.1, speedMult: 0.75 },
  // Sekiro-style posture: filling an enemy's bar breaks it (stunned, deathblow x3). Player has one too.
  POSTURE: { regen: 14, delay: 1.6, brokenTime: 2.5, deathblow: 3, sword: [8, 8, 16], critMult: 2, parryMin: 25, parryFrac: 0.5, reflectHit: 25, bossStun: 3.5 },
  PLAYER_POSTURE: { max: 100, regen: 18, delay: 1.0, blockMult: 1.6, blockAdd: 4, hitMult: 0.6, perfectRelief: 25, brokenTime: 1.4 },
  CAMERA: { dist: 270, gunDist: 300, aimDist: 235, fov: 55, gunFov: 52, aimFov: 42, shoulder: 70, gunLift: 22, gunPitchMin: 0.3 },
  TONGUE: { range: 200, cost: 25, regen: 35, regenDelay: 0.4, dur: 0.3, resolveAt: 0.12, halfArc: 0.45 },
  DODGE: { dur: 0.22, speedMult: 3.2, iframes: 0.3, cooldown: 0.55, roll: 0.07 },
  // Zones spawn in quick waves: the next wave arrives after waveGap s or when few bugs are left.
  ZONE: { firstWave: 0.6, waveGap: 3.5, clearLeft: 3 },
  // Phase 2 bosses run their attack timers faster; all boss cooldowns are scaled by cdMult.
  BOSS: { ph2Speed: 1.3, cdMult: 0.8, preludeDur: 4.2 },
  GHOST: { hp: 150, echoEvery: 4, echoRange: 900, echoDmg: 10 },
  POWERUP: { duration: 12, snail: 6, dropChance: 0.12 },
  // Style meter (D..S): rewards hits, kills, parries, deathblows; decays when idle, drops when hurt.
  STYLE: { hit: 4, kill: 12, parry: 30, deathblow: 35, counter: 20, eat: 10, perilDodge: 25, riposte: 40, hurt: -60, decay: 16, idle: 2.0, comboWindow: 2.5, max: 460,
    ranks: [[0, 'D', '#9aa'], [50, 'C', '#7dff7d'], [120, 'B', '#66ddff'], [220, 'A', '#ffd23f'], [340, 'S', '#ff5a8a']] },
  // New bugs + Mirewood hazards
  BOMBER: { fuse: 1.0, hopSpeed: 420, hopTime: 0.4, radius: 120, dmg: 18, launchSpeed: 640, launchTime: 0.5, bugDmg: 45 },
  LEECH: { drain: 3, slowEach: 0.2, minSlow: 0.5, latchDmg: 4 },
  WEB: { r: 95, life: 9, slow: 0.45, shotSlow: 0.6, shotSlowTime: 1.2 },
  // Ultimate (ASCII mode). Player ult: G when the meter is full. Every stat x mult; move/attack speed use their own
  // multipliers (3x speed was unplayable in testing, tune here). Bosses ult once per phase; never overlaps the player's.
  ULT: { cell: 9, glitchTime: 0.35, fadeNear: 380, fadeFar: 900, black: 0.42, cutoff: 0.07, actorMin: 0.65, gain: 0.25, duration: 10, mult: 3, moveMult: 2, atkSpeed: 2.2,
    bossWindup: 1.0, bossDuration: 8, bossDelay: [5, 10], bossSpeed: 1.5, bossDmg: 2.5,
    playerTint: 0x66ffcc, bossTint: 0xff3344,
    bossEffects: { hornet: 'noRegen', stag: 'reverse', mantis: 'tightParry', moth: 'shift', spider: 'webs' } },
  // Perilous attacks. 'dodge': can't be parried, dodge (or jump sweeps); hits hard. 'counter': dodge it to open a RIPOSTE.
  PERIL: { dmgMult: 1.3, postureMult: 1.2, dodgeRelief: 20, riposte: 0.6, ripostePosture: 3, riposteLunge: 110, slow: 0.12, glyphTime: 0.9 },
  // Art/feel pass: floating damage numbers, kill flash, CRT overlay hit fringe.
  FEEL: { dmgNumbers: 24, hitFringe: 0.09, flourishRank: 'S' },
  // Animation blending (seconds per cross-fade) and pose amounts.
  ANIM: {
    blend: { loco: 0.16, air: 0.12, dodge: 0.06, attack: 0.08, parry: 0.08, hit: 0.07, broken: 0.15, tongue: 0.1, ult: 0.1, death: 0.12,
      idle: 0.2, move: 0.15, wind: 0.08, strike: 0.06, stagger: 0.08 },
    leanFwd: 0.14, leanSide: 0.18, walkFreq: 9, runFreq: 14, walkHop: 2.5, runHop: 6, breath: 0.025,
    flinch: 0.32, recoil: 0.012, mixFade: 0.15, bossLean: 8,
  },
  SAMPLE_DT: 0.05,

  KEYS: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    jump: 'Space', dodge: 'ShiftLeft', shoot: 'KeyF', tongue: 'KeyE', pause: 'KeyP', mute: 'KeyM',
    weapon: 'KeyQ', sword: 'Digit1', gun: 'Digit2', ult: 'KeyG',
    slash: 'Mouse0', parry: 'Mouse2', restart: 'KeyR', // mouse buttons are bindable as 'MouseN'
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

// Difficulty tiers. hp/bossHp/ghostHp: health; dmg: damage taken; speed: enemy + boss time scale; parry: parry window;
// posture: posture gained by the frog; heal: drop rate; ult: ult meter gain; bossUlt: boss ult frequency (repeat: re-arm
// after each ult); tele: telegraph length; perilMix: share of perilous attacks; fakeOut: chance of a delayed wind-up;
// random: attack types are rolled at random every attack (only the glyph colour tells you).
export const DIFFICULTY = {
  baby: { label: 'BABY', hp: 0.9, bossHp: 0.9, ghostHp: 0.85, dmg: 0.7, speed: 0.9, parry: 1.35, posture: 0.8, heal: 1.3, ult: 1.3, bossUlt: 0.6, tele: 1.45, perilMix: 0.1, fakeOut: 0, random: false, repeat: false,
    desc: 'For anyone who just wants to hop around and eat bugs. Gentle bugs, a wider parry window and long, clear warnings, but bugs still bite.' },
  normal: { label: 'NORMAL', hp: 1, bossHp: 1, ghostHp: 1, dmg: 1, speed: 1, parry: 1, posture: 1, heal: 1, ult: 1, bossUlt: 1, tele: 1, perilMix: 0.3, fakeOut: 0, random: false, repeat: false,
    desc: 'The intended way to play.' },
  mayhem: { label: 'MAYHEM', hp: 1.2, bossHp: 1.2, ghostHp: 1.2, dmg: 1.4, speed: 1.15, parry: 0.8, posture: 1.2, heal: 0.8, ult: 0.9, bossUlt: 1.6, tele: 0.8, perilMix: 0.55, fakeOut: 0.3, random: false, repeat: false,
    desc: 'Faster, meaner bugs, tight parries, more perilous attacks and fake-outs. You asked for it.' },
  torture: { label: 'TORTURE', hp: 1.4, bossHp: 1.4, ghostHp: 1.4, dmg: 2, speed: 1.25, parry: 0.65, posture: 1.4, heal: 0.6, ult: 0.8, bossUlt: 2.5, tele: 0.6, perilMix: 0.6, fakeOut: 0.35, random: true, repeat: true,
    desc: 'Only for people who love challenges. Bugs hit hard, bosses ult constantly, attack types are random and only the glyph colour warns you.' },
};
