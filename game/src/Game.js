import * as THREE from 'three';
import { CFG, POWERUPS, DIFFICULTY } from './config.js';
import { World } from './world/World.js';
import { Fx } from './fx/Fx.js';
import { Input } from './core/Input.js';
import { Storage } from './core/Storage.js';
import { Rng } from './core/Rng.js';
import { preload } from './core/Assets.js';
import { clamp, angDiff, ease } from './core/math.js';
import { Sfx } from './audio/Sfx.js';
import { Projectiles } from './combat/Projectiles.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { Pickups } from './entities/Pickups.js';
import { makeBoss } from './entities/Bosses.js';
import { Recorder } from './loop/Recorder.js';
import { Ghost } from './loop/Ghost.js';
import { Webs } from './world/Webs.js';
import { PerilFx } from './fx/Peril.js';
import { Guide } from './world/Guide.js';
import { LEVELS, SURVIVAL_LEVEL, BOSSRUSH_LEVEL } from './levels/levels.js';
import { Hud } from './ui/Hud.js';
import { Screens } from './ui/Screens.js';
import { Menu3D } from './ui/Menu3D.js';
import { Hud3D } from './ui/Hud3D.js';
import { Settings } from './core/Settings.js';
import { Cosmetics, unlock, ACH } from './entities/Cosmetics.js';
import { Keybinds, keyName as keyNameOf } from './core/Keybinds.js';
import { Meta } from './core/Meta.js';
import { INTRO_PANELS, GHOST_PANELS } from './ui/comics.js';

const newStats = () => ({ kills: 0, ghostKills: 0, eaten: 0, perfectParries: 0, shots: 0, hits: 0, damageTaken: 0, ghostKilledAt: null, maxCombo: 0, bestRank: 'D' });
const newStyle = () => ({ pts: 0, idle: 0, combo: 0, comboT: 0, rank: 0 });
const newUlt = () => ({ meter: 0, t: 0 });

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.sfx = Sfx;
    this.state = 'LOADING';
    this.enemies = [];
    this.boss = null;
    this.ghost = null;
    this.stats = newStats();
    this.style = newStyle();
    this.ult = newUlt();
    this.bossUlt = null;
    this.simT = 0;
    this.score = 0;
    this.mode = 'timeloop';
    this.loopNo = 1;
    this.pb = null;
    this.snailT = 0;
    this.slowT = 0;
    this.hitstopT = 0;
    this.freezeGap = 0;
    this.punchT = 0; this.punchAmt = 0; this.baseFov = CFG.CAMERA.fov;
    this.diffKey = DIFFICULTY[Storage.get('difficulty', 'normal')] ? Storage.get('difficulty', 'normal') : 'normal';
    this.atkRng = new Rng(1);
    this._perilSlowAt = -9;
    this.survBest = Storage.get('surv.best', 0);
    this.clock = new THREE.Clock();
  }

  async init() {
    const bp = document.querySelector('#boot .bp i'), bs = document.querySelector('#boot small');
    await preload(['tode', 'enemy', 'small_house'], (f, n) => { if (bp) bp.style.width = `${Math.round(f * 85)}%`; if (bs) bs.textContent = `LOADING ${n.toUpperCase()}...`; });
    this.world = new World(this.canvas);
    this.fx = new Fx(this.world.scene);
    this.fx.tagger = (o, k) => this.world.tag(o, k);
    this.input = new Input(this.canvas);
    this.projectiles = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.webs = new Webs(this);
    this.perilFx = new PerilFx(this);
    this.guide = new Guide(this);
    this.recorder = new Recorder();
    this.hud = new Hud(this.uiRoot);
    this.screens = new Screens(this.uiRoot, this);
    this.menu3d = new Menu3D(this);
    this.hud3d = new Hud3D(this);
    this.applySettings();
    this.deathVig = document.createElement('div'); this.deathVig.className = 'deathvig'; this.uiRoot.appendChild(this.deathVig);
    this.world.buildLevel(LEVELS[0]);
    this.player = new Player(this);
    this.player.reset(LEVELS[0].start.x, LEVELS[0].start.y);

    this.input.onLockChange = (locked) => { if (!locked && this.state === 'PLAYING') this.pause(); };
    const wake = () => this.sfx.init();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    this.canvas.addEventListener('mousedown', () => {
      if (this.state === 'PLAYING' && !this.input.locked) this.input.requestLock();
    });
    this.toMenu();
    this.world.renderer.setAnimationLoop(() => this.frame());
    const boot = document.getElementById('boot');
    if (boot) { if (bp) bp.style.width = '100%'; setTimeout(() => { boot.classList.add('done'); setTimeout(() => boot.remove(), 500); }, 200); }
  }

  // ------------------------------------------------------------ flow
  toMenu() {
    this.cleanup();
    this.state = 'MENU';
    this.hud.show(false);
    this.input.exitLock();
    this.sfx.intensity = 0;
    this.deathVig.classList.remove('on');
    const lv = LEVELS[0];
    this.levelCfg = lv;
    this.world.buildLevel(lv);
    this.player.reset(lv.start.x, lv.start.y);
    this.world.cam.pitch = 0.35;
    this.world.cam.dist = 330;
    this.world.cam.shoulder = 0;
    this.world.cam.roll = 0;
    this.world.camera.fov = CFG.CAMERA.fov; this.world.camera.updateProjectionMatrix();
    this.world.snapCamera();
    if (Settings.get('ui3d')) { this.screens.hide(); this.menu3d.open('main'); }
    else { this.menu3d.close(); this.screens.showMenu(); }
  }

  // Apply persisted options (Settings) to camera, input, audio, HUD and effects.
  applySettings() {
    const S = Settings.all();
    Keybinds.apply();
    this.hud.refreshHelp && this.hud.refreshHelp();
    CFG.CAMERA.fov = S.fov; CFG.CAMERA.gunFov = S.fov - 5; CFG.CAMERA.aimFov = S.fov - 15;
    CFG.CAMERA.dist = S.camDist; CFG.CAMERA.gunDist = S.camDist * 1.1; CFG.CAMERA.aimDist = S.camDist * 0.87;
    this.sfx.setVolumes({ master: S.master, sfx: S.sfx, music: S.music });
    const pr = S.lowQ ? 1 : Math.min(window.devicePixelRatio, 2);
    if (this.world.renderer.getPixelRatio() !== pr) { this.world.renderer.setPixelRatio(pr); this.world.ascii.resize(); }
    this.screens.applySettings();
    this.hud.root.classList.toggle('worldnums', !!S.hud3d);
    this.hud.root.style.setProperty('--hud-scale', S.hudScale);
    this.hud.root.style.setProperty('--hud-op', S.hudOpacity);
    this.hud.el.cluster.classList.toggle('top', S.hudCorner === 'top');
  }

  achieve(key) {
    if (unlock(key)) { this.hud.flash(`UNLOCKED: ${ACH[key]} - new wardrobe items!`, '#ffd23f'); this.sfx.play('power'); }
  }

  showDmg(t, dmg, kind) {
    if (!Settings.get('dmgNums')) return;
    const z = (t.z || 0) + (t.radius || 20) * 2 + 20;
    if (Settings.get('hud3d')) this.hud3d.dmgNum(t.x, t.y, z, dmg, kind);
    else this.hud.dmgNum(this.world.camera, t.x, t.y, z, dmg, kind);
  }

  cleanup() {
    for (const e of this.enemies) { this.world.scene.remove(e.root); e.overhead && e.overhead.remove(); }
    this.enemies = [];
    this.waves = [];
    if (this.boss) { this.boss.clearMarker?.(); this.boss.clearAll?.(); this.world.scene.remove(this.boss.root); this.boss.rings?.forEach((r) => r.vis && this.world.scene.remove(r.vis)); }
    this.boss = null;
    if (this.ghost) this.world.scene.remove(this.ghost.root);
    this.ghost = null;
    this.projectiles.clear();
    this.pickups.clear();
    this.webs.clear();
    this.perilFx.clear();
    this.fx.clear();
    this.hud.setBoss(null);
    this.snailT = 0;
    this.freezeT = 0;
    this.powerSlots = [];
    if (this.runEarn && (this.runEarn.gf || this.runEarn.croak)) this.flushEarnings(); // quitting mid-run keeps what you earned
    this.bossUlt = null;
    if (this.ult) this.ult.t = 0;
    const a = this.world.ascii;
    a.set(false); a.amount = 0; a.kickT = 0; a.extra = 0;
  }

  startRun(mode, levelId) {
    this.sfx.init();
    this.sfx.startMusic();
    this.menu3d.close();
    this.cleanup();
    this.mode = mode;
    const level = mode === 'survival' ? SURVIVAL_LEVEL : mode === 'bossrush' ? BOSSRUSH_LEVEL : LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    this.levelCfg = level;
    this.world.buildLevel(level);
    this.stats = newStats();
    this.style = newStyle();
    this.ult = newUlt();
    this.simT = 0;
    this.score = 0;
    this.bossDead = mode === 'bossrush' ? false : !level.boss;
    this.rush = { i: 0, t: 1.2, done: false };
    this.bossStarted = false;
    this.zoneDone = (level.zones || []).map(() => false);
    this._goalOpen = null;
    this.surv = { t: 0, spawnT: 1.5, ammoT: 20 };
    this.atkRng = new Rng(level.seed * 13 + 7);
    this._perilSlowAt = -9;
    this._incAt = -9;
    this.slowT = 0; this.hitstopT = 0; this.freezeGap = 0; this.punchT = 0; this.baseFov = CFG.CAMERA.fov;
    this.sfx.intensity = 0;
    this.deathVig.classList.remove('on');

    this.player.applyCosmetics();
    this.player.reset(level.start.x, level.start.y);
    this.runEarn = { gf: 0, croak: 0 }; this._srankPaid = false;
    // one-shot consumables bought in the Toad Shop
    const cons = Meta.takeConsumables();
    this._consUsed = Object.keys(cons);
    if (cons.ammopack) this.player.ammo = Math.min(this.player.maxAmmo, this.player.ammo + 6 * cons.ammopack);
    if (cons.shield) this.player.pu.shell += cons.shield;
    if (cons.secondwind) this.player.secondWind = 1;
    this._startPower = cons.startpower ? ['firefly', 'dragon', 'shell', 'bigmouth', 'over', 'ricochet', 'thorn', 'magnet', 'timeshard'] : null;
    for (const [wx, wy, wr] of level.webs || []) this.webs.add(wx, wy, wr, Infinity);
    this.recorder.reset();
    const cam = this.world.cam;
    cam.yaw = Math.atan2(-level.start.y || 0.01, -level.start.x || 0.01);
    cam.pitch = 0.55; cam.dist = CFG.CAMERA.dist; cam.shoulder = 0; cam.roll = 0;
    this.world.camera.fov = CFG.CAMERA.fov; this.world.camera.updateProjectionMatrix();
    this.world.snapCamera();
    this.player.yaw = cam.yaw;

    this.ghost = null;
    this.pb = null;
    this.loopNo = 1;
    if (mode === 'bossrush') {
      const pbObj = Storage.get(this.sk('pb', level.id), null);
      this.pb = pbObj ? pbObj.best : null;
    }
    if (mode === 'timeloop') {
      const pbObj = Storage.get(this.sk('pb', level.id), null);
      this.pb = pbObj ? pbObj.best : null;
      this.loopNo = (pbObj ? pbObj.wins : 0) + 1;
      const run = Storage.get(this.sk('ghost', level.id), null);
      if (run && run.samples && run.samples.length > 2) {
        this.ghost = new Ghost(this, run, this.loopNo);
        this.ghost.hp = this.ghost.maxHp = Math.round(CFG.GHOST.hp * this.D.ghostHp);
      }
    }

    const queue = [];
    if (mode === 'timeloop' && !Storage.get('seen.intro', false)) queue.push([INTRO_PANELS, 'seen.intro']);
    if (this.ghost && !Storage.get('seen.ghost', false)) queue.push([GHOST_PANELS, 'seen.ghost']);
    const begin = () => this.begin();
    this.state = 'CUTSCENE';
    this.screens.hide();
    this.hud.show(false);
    const next = () => {
      const q = queue.shift();
      if (!q) { begin(); return; }
      Storage.set(q[1], true);
      this.screens.cutscene(q[0], next);
    };
    next();
  }

  begin() {
    this.state = 'PLAYING';
    if (this._startPower) { const pool = this._startPower; this._startPower = null; this.powerSlots.push(pool[Math.floor(Math.random() * pool.length)]); }
    this.hud.resetTransient();
    this.hud.show(true);
    this.screens.hide();
    this.input.clear();
    this.input.requestLock();
    this.clock.getDelta();
    if (this.mode === 'survival') this.hud.banner('SURVIVE', 'Slash, parry, eat. How long can you last?', '#7dff7d');
    else if (this.mode === 'bossrush') this.hud.banner('BOSS RUSH', 'Five bosses. No loops. Break their posture!', '#ff7a7a', 3);
    else if (this.ghost) this.hud.banner(`ITERATION ${this.loopNo}`, 'Kill your past self, beat the boss, reach the goal first!', '#66ddff', 2.4);
    else this.hud.banner('FIRST RUN', 'Clear the level to record your ghost', '#7dff7d', 2.2);
    this.sfx.play('ui');
  }

  pause() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.input.exitLock();
    this.screens.showPause();
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.screens.hide();
    this.state = 'PLAYING';
    this.input.clear();
    this.input.requestLock();
    this.clock.getDelta();
  }

  restart() {
    this.startRun(this.mode, this.levelCfg && this.levelCfg.id);
  }

  // ------------------------------------------------------------ difficulty
  get D() { return DIFFICULTY[this.diffKey]; }
  setDifficulty(k) { if (DIFFICULTY[k]) { this.diffKey = k; Storage.set('difficulty', k); } }
  // Storage key per difficulty; NORMAL keeps the original keys so existing records survive.
  sk(kind, id) { return this.diffKey === 'normal' ? `${kind}.${id}` : `${kind}.${this.diffKey}.${id}`; }

  // Attack type for a regular bug melee attack (seeded per run, so replays of a level stay consistent).
  rollEnemyType() {
    const D = this.D, r = this.atkRng;
    if (r.next() >= D.perilMix * 0.5) return 'normal';
    return r.next() < 0.5 ? 'dodge' : 'counter';
  }

  // Perilous telegraph: glyph above the attacker, sting, brief slow-down (rate limited).
  perilTelegraph(ent, type, dur = CFG.PERIL.glyphTime) {
    if (type === 'normal') return;
    this.perilFx.show(ent, type, dur, ent.isBoss ? ent.radius * 2 + 70 : 60);
    this.sfx.play(type === 'dodge' ? 'peril' : 'perilC');
    this.hud.perilFlash(type);
    if (this.simT - (this._incAt ?? -9) > 1.2) { this._incAt = this.simT; this.hud.incoming(type); }
    if (ent.isBoss && type === 'dodge' && this.simT - (this._perilInkAt || -9) > 2.5) { this._perilInkAt = this.simT; this.hud.ink('PERILOUS', 'peril'); }
    if (this.simT - this._perilSlowAt > 1.5) { this._perilSlowAt = this.simT; this.slowmo(CFG.PERIL.slow); }
  }

  // ------------------------------------------------------------ run end
  objective() {
    if (this.mode === 'survival') return 'Survive!';
    if (this.mode === 'bossrush') return this.boss && !this.boss.dead ? `Defeat the ${this.boss.name} (${this.rush.i + 1}/${this.levelCfg.rush.length})` : 'Next boss incoming...';
    const o = [];
    if (!this.bossDead) o.push(this.bossStarted && this.boss ? `Defeat the ${this.boss.name}` : 'Fight toward the boss');
    if (this.ghost && !this.ghost.dead) o.push('Destroy your past self');
    if (!o.length) o.push('Reach the goal!');
    return o.join('  +  ');
  }

  goalOpen() { return this.bossDead && (!this.ghost || this.ghost.dead); }

  endRun(reason) {
    if (this.state !== 'PLAYING') return;
    this.state = 'STATS';
    this.input.exitLock();
    this.hud.setBoss(null);
    const s = this.stats;
    if (reason === 'win') this.earn(CFG.META.gf.clear, CFG.META.croak.clear);
    this.flushEarnings(s);
    const meta = Meta.get();
    const d = { ...s, rank: meta.rank, gfTotal: meta.gf, upgrades: Meta.totalLevels(), diff: this.D.label, mode: this.mode, time: this.simT, score: this.score, loopNo: this.loopNo, hadGhost: !!this.ghost, ghostWon: reason === 'ghost', pb: this.pb };
    let delay = 0;
    if (this.mode === 'survival') {
      this.survBest = Math.max(this.survBest, this.score);
      Storage.set('surv.best', this.survBest);
      Object.assign(d, { win: false, title: 'GAME OVER', why: 'The swarm got you.' });
      this.sfx.play('lose'); delay = 2400;
      this.hud.ink('YOU DIED', 'death');
      this.deathVig.classList.add('on');
    } else if (reason === 'win') {
      const id = this.levelCfg.id;
      if (this.mode === 'timeloop') Storage.set(this.sk('ghost', id), { ...this.recorder.finish(this.simT, this.player), cos: this.player.cos });
      if (this.mode === 'bossrush') this.achieve('allbosses');
      if (this.diffKey === 'torture') this.achieve('torture');
      const old = Storage.get(this.sk('pb', id), null);
      const best = old ? Math.min(old.best, this.simT) : this.simT;
      d.newPB = !old || this.simT < old.best;
      Storage.set(this.sk('pb', id), { best, wins: (old ? old.wins : 0) + 1 });
      d.pb = best;
      this.pb = best;
      Object.assign(d, this.mode === 'bossrush'
        ? { win: true, title: 'BOSS RUSH CLEARED', why: 'All five bosses defeated.' }
        : { win: true, title: 'ITERATION CLEARED', why: this.ghost ? 'You beat your past self.' : 'Run recorded. Your ghost awaits in the next iteration.' });
      this.sfx.play('win');
      this.hud.ink(this.mode === 'bossrush' ? 'RUSH CLEARED' : 'ITERATION CLEARED', 'clear');
      delay = 1500;
    } else if (reason === 'ghost') {
      Object.assign(d, { win: false, title: 'THE PAST WAS FASTER', why: 'Your ghost reached the goal first.' });
      this.sfx.play('lose');
    } else {
      Object.assign(d, { win: false, title: 'FROG DOWN', why: this.ghost && !this.ghost.dead ? 'Your past self got you.' : 'The bugs got you.' });
      this.sfx.play('lose'); delay = 2400;
      this.hud.ink('YOU DIED', 'death');
      this.deathVig.classList.add('on');
    }
    this.sfx.intensity = 0;
    setTimeout(() => {
      if (this.state !== 'STATS') return;
      this.hud.show(false); this.deathVig.classList.remove('on');
      // Stats as a 3D moment around the frog (classic DOM card if 3D menus are off)
      if (Settings.get('ui3d')) this.menu3d.openStats(d, this.screens.statsRows(d));
      else this.screens.showStats(d);
    }, delay);
  }

  onBossDead(b) {
    if (this.mode === 'bossrush') {
      this.endBossUlt();
      this.achieve('boss');
      const r = this.rush;
      this.hud.setBoss(null);
      this.sfx.intensity = 0;
      r.i++;
      this.boss = null;
      if (r.i >= this.levelCfg.rush.length) { r.done = true; this.endRun('win'); return; }
      this.player.heal(40);
      this.player.ammo = Math.min(this.player.maxAmmo, this.player.ammo + 4);
      this.hud.banner('BOSS DEFEATED', 'Patched up. The next boss approaches...', '#ffd23f', 3);
      for (let i = 0; i < 4; i++) this.pickups.spawn('droplet', b.x, b.y);
      r.t = 3.5;
      return;
    }
    this.endBossUlt();
    this.achieve('boss');
    this.bossDead = true;
    this.sfx.intensity = 0;
    this.hud.setBoss(null);
    this.hud.banner('BOSS DEFEATED', this.ghost && !this.ghost.dead ? 'Now finish off your past self' : 'The goal is open!', '#ffd23f', 3);
    for (let i = 0; i < 6; i++) this.pickups.spawn('droplet', b.x, b.y);
    this.pickups.spawn('ammo', b.x + 40, b.y);
    const pu = ['firefly', 'dragon', 'shell', 'snail', 'bigmouth', 'over', 'ricochet', 'thorn', 'magnet', 'timeshard'];
    this.pickups.spawn(pu[Math.floor(Math.random() * pu.length)], b.x - 40, b.y);
  }

  onGhostDead() {
    this.hud.banner('GHOST SHATTERED', this.bossDead ? 'Reach the goal!' : 'Now finish the level', '#66ddff', 2.5);
  }

  onGhostArrived() {
    if (this.ghost && !this.ghost.dead) this.endRun('ghost');
  }

  // ------------------------------------------------------------ helpers
  slowmo(t) { this.slowT = Math.max(this.slowT, t); }
  hitstop(t) {
    if (!(this.hitstopT > 0)) this._hsStart = performance.now();
    this.hitstopT = Math.min(CFG.PARRY.maxHitstop, Math.max(this.hitstopT || 0, t));
  }
  // Style meter: points for aggression and skill, combo counter for chained hits.
  addStyle(kind) {
    const S = CFG.STYLE, st = this.style;
    if (!st || this.state !== 'PLAYING') return;
    const v = S[kind] || 0;
    st.pts = clamp(st.pts + v, 0, S.max);
    if (v > 0) {
      st.idle = 0;
      if (kind === 'parry') this.ultGain(CFG.ULT.parryGain);
      if (kind !== 'eat') { st.combo++; st.comboT = S.comboWindow; this.stats.maxCombo = Math.max(this.stats.maxCombo, st.combo); }
    } else { st.combo = 0; st.comboT = 0; }
    this._rankCheck();
  }

  _rankCheck() {
    const R = CFG.STYLE.ranks, st = this.style;
    let r = 0;
    for (let i = 0; i < R.length; i++) if (st.pts >= R[i][0]) r = i;
    if (r > st.rank) {
      this.hud.rankUp(R[r][1], R[r][2]);
      this.sfx.play('rank');
      this.fx.addShake(6 + r * 2);
      if (R[r][1] === CFG.FEEL.flourishRank) { this.hud.flourish(); this.sfx.play('ult'); this.achieve('srank'); if (!this._srankPaid) { this._srankPaid = true; this.earn(CFG.META.gf.srank, 0); } }
      if (r > (st.best || 0)) { st.best = r; this.stats.bestRank = R[r][1]; }
    }
    st.rank = r;
  }

  updateStyle(dt) {
    const S = CFG.STYLE, st = this.style;
    st.idle += dt;
    if (st.idle > S.idle) st.pts = Math.max(0, st.pts - S.decay * dt);
    if (st.comboT > 0) { st.comboT -= dt; if (st.comboT <= 0) st.combo = 0; }
    this._rankCheck();
  }

  // Ult meter: kills fill it (elites / bosses more); kills during an active ult extend it a little.
  ultGain(amount) {
    const u = this.ult;
    if (!u) return;
    if (u.t > 0) return;
    const was = u.meter;
    u.meter = Math.min(100, u.meter + amount * this.D.ult * this.player.up.ultGain);
    if (was < 100 && u.meter >= 100) { this.hud.flash('ULTIMATE READY', '#66ffcc'); this.sfx.play('rank'); }
  }

  onKillUlt(t) {
    const U = CFG.ULT, u = this.ult;
    if (u.t > 0) { u.t = Math.min(U.maxTime + this.player.up.ultDur, u.t + U.killExtend); return; }
    this.ultGain(t.isBoss ? U.bossKill : t.elite ? U.eliteKill : U.perKill);
  }

  ultDur() { return CFG.ULT.duration + (this.player.up ? this.player.up.ultDur : 0); }

  // Toad Shop earnings for this run (flushed to the meta save when the run ends)
  earn(gf, croak, x, y) {
    const r = this.runEarn || (this.runEarn = { gf: 0, croak: 0 });
    r.gf += gf; r.croak += croak;
    if (gf > 0 && x != null) this.hud.worldLabel({ x, y, z: 0, radius: 10, dead: true }, `+${gf} GF`, '#ffd23f', 0.8);
  }

  flushEarnings(stats) {
    const r = this.runEarn;
    this.runEarn = { gf: 0, croak: 0 };
    if (!r || (!r.gf && !r.croak)) return r;
    const msgs = Meta.earn(r.gf, r.croak);
    for (const m of msgs) this.hud.flash(m, '#7dff7d');
    if (stats) { stats.gfEarned = r.gf; stats.croakEarned = r.croak; }
    return r;
  }

  // ------------------------------------------------------------ ultimates (ASCII mode)
  get playerUlt() { return this.ult && this.ult.t > 0; }
  bossUltOn(fx) { const u = this.bossUlt; return !!u && u.phase === 'active' && (!fx || u.fx === fx); }

  startUlt() {
    const u = this.ult;
    if (u.t > 0) {
      // pressing the ult key again ends it early (ignored right after activation to avoid double-presses)
      if (this.simT - (u.startedAt || 0) < CFG.ULT.toggleGuard) return;
      const refund = 100 * CFG.ULT.offRefund * (u.t / this.ultDur());
      this.endUlt(refund);
      this.hud.flash('ULT OFF', '#66ffcc');
      return;
    }
    if (u.meter < 100) { this.hud.flash('Ultimate not ready', '#99a'); return; }
    if (this.bossUlt) { this.hud.flash('Boss ult in progress!', '#ff5566'); return; }
    u.t = this.ultDur();
    u.startedAt = this.simT;
    this.player.ultPoseT = 0.5;
    this.world.ascii.set(true, CFG.ULT.playerTint);
    this.hud.cutIn('ULTIMATE', `Stronger, faster. ${keyNameOf(CFG.KEYS.ult)} again to end it.`, 'player');
    this.sfx.play('ult');
    this.fx.ring(this.player.x, this.player.y, 10, 0x66ffcc, 20, 400, 0.6);
    this.fx.addShake(14);
    this.fovPunch(10);
  }

  endUlt(refund = 0) {
    this.ult.t = 0; this.ult.meter = Math.min(99, refund);
    const a = this.world.ascii;
    a.set(false); a.kick(0.6);
    this.hud.screenFlash();
    this.sfx.play('ultEnd');
  }

  updateUlt(dt) {
    const u = this.ult, p = this.player;
    if (u.t > 0) {
      u.t -= dt;
      u.meter = Math.max(0, Math.min(100, 100 * u.t / this.ultDur()));
      if (u.t <= 0) this.endUlt();
    }
    const b = this.boss;
    const bu = this.bossUlt;
    if (!b || !b.active || b.dead) { if (bu) this.endBossUlt(); return; }
    if (!bu) {
      if (b.ultDone === b.phase || b.stunned) return;
      if (b.ultT == null) { const [lo, hi] = CFG.ULT.bossDelay; b.ultT = (lo + Math.random() * (hi - lo)) / this.D.bossUlt; }
      b.ultT -= dt;
      if (b.ultT <= 0 && u.t <= 0 && b.state === 'move') this.startBossUlt(b);
      return;
    }
    bu.t -= dt;
    if (bu.phase === 'wind') {
      b.telegraph = true; b.flashSync();
      this.fx.addShake(3);
      if (bu.t <= 0) {
        bu.phase = 'active'; bu.t = CFG.ULT.bossDuration; bu.tick = 0;
        this.world.ascii.set(true, CFG.ULT.bossTint);
        if (bu.fx === 'shift') this.world.ascii.extra = 0.3;
        this.hud.cutIn(`${b.name} ULT`, { noRegen: 'Your posture will not recover', reverse: 'Controls half-reversed', tightParry: 'Parry window halved', shift: 'Reality glitch: attacks drift', webs: 'Webs spin under your feet' }[bu.fx] || '', 'boss');
        this.sfx.play('ult');
        this.fx.ring(b.x, b.y, 10, 0xff3344, 20, 500, 0.6);
        this.fx.addShake(16);
      }
    } else {
      bu.tick -= dt;
      if (bu.fx === 'webs' && bu.tick <= 0) { bu.tick = 1.6; this.webs.add(p.x + p.vx * 0.5, p.y + p.vy * 0.5, CFG.WEB.r, 5); }
      if (bu.t <= 0) this.endBossUlt();
    }
  }

  startBossUlt(b) {
    b.ultDone = b.phase; b.ultT = null;
    this.bossUlt = { b, phase: 'wind', t: CFG.ULT.bossWindup, fx: CFG.ULT.bossEffects[b.kind] || 'noRegen' };
    this.hud.banner('ULT INCOMING', b.name, '#ff3344', 1.3);
    this.sfx.play('ultWarn');
    this.fx.ring(b.x, b.y, 10, 0xff3344, 160, 20, 1.0);
  }

  endBossUlt(reason) {
    if (!this.bossUlt) return;
    const was = this.bossUlt.phase === 'active';
    if (this.D.repeat && this.bossUlt.b) this.bossUlt.b.ultDone = null; // Torture: bosses ult again and again
    this.bossUlt = null;
    const a = this.world.ascii;
    a.extra = 0;
    if (was) { a.set(false); a.kick(0.6); this.sfx.play('ultEnd'); }
    if (reason === 'broken') { this.hud.banner('ULT BROKEN!', 'The boss staggers', '#ffd23f', 2); this.hud.screenFlash(); }
  }

  // Free-aim point under the crosshair (screen centre): nearest target near the view ray, else the bullet plane.
  updateAim() {
    const cam = this.world.camera;
    this._ray = this._ray || new THREE.Ray();
    this._ray.origin.copy(cam.position);
    cam.getWorldDirection(this._ray.direction);
    const r = this._ray, z = CFG.GUN.bulletZ;
    const pt = this.aimPoint || (this.aimPoint = new THREE.Vector3());
    let best = null, bd = Infinity;
    const tv = new THREE.Vector3();
    const cands = [...this.enemies];
    if (this.boss && this.boss.active && !this.boss.dead) cands.push(this.boss);
    if (this.ghost && !this.ghost.dead) cands.push(this.ghost);
    for (const t of cands) {
      if (t.dead) continue;
      tv.set(t.x, t.y, (t.z || 0) + Math.min(40, t.radius));
      const along = tv.clone().sub(r.origin).dot(r.direction);
      if (along < 60) continue;
      const d = r.distanceToPoint(tv);
      if (d < t.radius * 1.2 + 8 && along < bd) { bd = along; best = t; }
    }
    if (best) { pt.set(best.x, best.y, z); this.aimTarget = best; return; }
    this.aimTarget = null;
    // No target: aim along the camera's heading from the frog; camera pitch sets the distance (clamped).
    const p = this.player, G = CFG.GUN;
    const dz = r.direction.z;
    const t = Math.abs(dz) > 1e-4 ? (z - r.origin.z) / dz : -1;
    let dist = G.aimMax;
    if (t > 0) { const hx = r.origin.x + r.direction.x * t, hy = r.origin.y + r.direction.y * t; dist = Math.hypot(hx - p.x, hy - p.y); }
    dist = clamp(dist, G.aimMin, G.aimMax);
    const h = Math.hypot(r.direction.x, r.direction.y) || 1;
    pt.set(p.x + (r.direction.x / h) * dist, p.y + (r.direction.y / h) * dist, z);
  }

  fovPunch(a) { this.punchAmt = a; this.punchT = CFG.PARRY.punchTime; }

  // Perfect parry juice at the contact point: sparks, speed lines, shockwave, zoom punch, edge dim, layered clang.
  parryFx(p, src, proj, big, streak) {
    const PA = CFG.PARRY, fx = this.fx;
    const sx = proj ? proj.x : src && src.x != null ? src.x : p.x + Math.cos(p.yaw) * 40;
    const sy = proj ? proj.y : src && src.y != null ? src.y : p.y + Math.sin(p.yaw) * 40;
    const ang = Math.atan2(sy - p.y, sx - p.x);
    const cx = p.x + Math.cos(ang) * 34, cy = p.y + Math.sin(ang) * 34, cz = proj ? proj.z : 28;
    const pc = p.parryColor ?? 0xffffff;
    fx.burst(cx, cy, cz, pc, big ? 34 : 18, 380, 0.35, 2.2, 60);
    fx.burst(cx, cy, cz, 0xffe066, big ? 22 : 10, 300, 0.45, 1.8, 140);
    fx.streaks(cx, cy, cz, pc, big ? 18 : 10, big ? 170 : 95, big ? 0.3 : 0.22);
    fx.disc(cx, cy, cz, 0xffffff, 6, big ? 70 : 36, 0.12, 0.9);
    fx.ring(cx, cy, cz, pc, 8, big ? 260 : 140, 0.35);
    fx.ring(p.x, p.y, 3, 0xbfe9ff, 20, big ? 340 : 180, 0.45, 0.7);
    fx.addShake(big ? 22 : 10);
    this.fovPunch(big ? PA.fovPunch * 1.6 : PA.fovPunch);
    this.hud.parryDim(big ? 0.65 : PA.dimTime);
    this.hud.parryStreak(streak);
    this.sfx.parry(streak, big);
    this.addStyle('parry');
    this.earn(0, CFG.META.croak.parry);
    if (src && !proj && src.team !== 'player') {
      src.flashT = 0.18;
      if (!src.isBoss && src.knock) src.knock(ang, PA.knock);
    }
  }

  // Camera distance / shoulder / FOV easing, including the parry zoom punch. Runs during hitstop too.
  camFov(raw) {
    const C = CFG.CAMERA, kd = 1 - Math.exp(-10 * raw);
    const pl = this.player, cam = this.world.cam, cm = this.world.camera;
    const gun = pl.weapon === 'gun';
    cam.dist += ((pl.aiming ? C.aimDist : gun ? C.gunDist : C.dist) - cam.dist) * kd;
    cam.shoulder += ((gun ? C.shoulder : 0) - cam.shoulder) * kd;
    cam.lift = (cam.lift || 0) + ((gun ? C.gunLift : 0) - (cam.lift || 0)) * kd;
    this.baseFov += ((pl.aiming ? C.aimFov : gun ? C.gunFov : C.fov) - this.baseFov) * kd;
    let dip = 0;
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - raw);
      dip = this.punchAmt * ease(this.punchT / CFG.PARRY.punchTime);
    }
    cm.fov = this.baseFov - dip;
    cm.updateProjectionMatrix();
  }

  bigFreeze() { if (this.freezeGap > 0) return false; this.hitstop(CFG.PARRY.bigHitstop); this.freezeGap = 1.5; return true; }

  spawnEnemy(type, x, y) {
    const half = (this.levelCfg.half || CFG.ARENA_HALF) - 40;
    const e = new Enemy(this, type, clamp(x, -half, half), clamp(y, -half, half));
    this.world.resolve(e);
    this.enemies.push(e);
    return e;
  }

  maybeDrop(x, y) {
    if (Math.random() > CFG.POWERUP.dropChance * this.D.heal) return;
    const types = ['firefly', 'dragon', 'shell', 'snail', 'bigmouth', 'ammo', 'golden', 'over', 'ricochet', 'thorn', 'magnet', 'timeshard'];
    this.pickups.spawn(types[Math.floor(Math.random() * types.length)], x, y);
  }

  // Pickups: droplets / bullets / ammo apply at once; power-ups go into hold slots, used with the power key.
  collect(type) {
    const p = this.player;
    if (type === 'droplet' || type === 'bullet' || type === 'ammo' || Settings.get('autoPower')) { this.activatePower(type); return; }
    const slots = this.powerSlots || (this.powerSlots = []);
    if (slots.length >= this.player.up.slots) this.activatePower(slots.shift()); // full: the oldest one fires so nothing is lost
    slots.push(type);
    const def = POWERUPS[type];
    this.hud.flash(`${def.label} stored - press ${keyNameOf(CFG.KEYS.power)} to use`, '#' + def.color.toString(16).padStart(6, '0'));
    this.sfx.play('pickup');
    this.fx.ring(p.x, p.y, 20, def.color, 10, 60, 0.3);
  }

  usePower() {
    const slots = this.powerSlots;
    if (!slots || !slots.length) { this.hud.flash('No power-up stored', '#99a'); return; }
    this.activatePower(slots.shift());
  }

  activatePower(type) {
    const p = this.player;
    const P = CFG.POWERUP;
    switch (type) {
      case 'droplet': p.heal(6); this.sfx.play('heal'); return;
      case 'bullet': p.ammo = Math.min(p.maxAmmo, p.ammo + 2 + p.up.ammoDrop); this.sfx.play('pickup'); return;
      case 'ammo': p.ammo = Math.min(p.maxAmmo, p.ammo + 6 + 2 * p.up.ammoDrop); break;
      case 'firefly': p.pu.fire = P.duration; break;
      case 'dragon': p.pu.dragon = P.duration; break;
      case 'bigmouth': p.pu.big = P.duration; break;
      case 'shell': p.pu.shell = 3; break;
      case 'snail': this.snailT = P.snail; break;
      case 'golden': p.rewind(); break;
      case 'over': p.pu.over = 8; break;
      case 'ricochet': p.pu.rico = P.duration; break;
      case 'thorn': p.pu.thorn = P.duration; break;
      case 'magnet': p.pu.mag = P.duration; break;
      case 'timeshard': this.freezeT = P.shard; this.fx.ring(p.x, p.y, 10, 0x99ccff, 20, 900, 0.8); this.world.ascii.kick(0.25); break;
      default: break;
    }
    const def = POWERUPS[type];
    this.hud.flash(`${def.label}: ${def.desc}`, '#' + def.color.toString(16).padStart(6, '0'));
    this.sfx.play('power');
    this.fx.ring(p.x, p.y, 20, def.color, 10, 80, 0.4);
    this.fx.burst(p.x, p.y, 30, def.color, 16, 260, 0.5, 2.5, 120);
    this.fx.streaks(p.x, p.y, 30, def.color, 8, 80, 0.25);
  }

  damageTarget(t, dmg, o = {}) {
    if (t.dead) return;
    if (t.stunned) dmg *= 1.5;
    const mine = o.team === 'player';
    if (t.broken > 0) { dmg *= CFG.POSTURE.deathblow; this.fx.addShake(8); if (mine) this.addStyle('deathblow'); }
    if (mine) this.addStyle('hit');
    t.hp -= dmg;
    t.flashT = 0.1;
    if (mine || o.team === 'ghost') {
      const big = t.broken > 0 || dmg >= 60;
      this.showDmg(t, dmg, big ? 'big' : o.crit ? 'crit' : '');
      if (mine) this.hud.hitConfirm(big || o.crit);
    }
    const wasBroken = t.broken > 0;
    if (o.burn) t.burn = 3;
    if (o.knock && t.knock && !t.isBoss) t.knock(o.ang, CFG.SWORD.knock);
    this.fx.burst(t.x, t.y, 30, 0xffffff, 5, 150, 0.25, 2);
    this.fx.spark(t.x, t.y, (t.z || 0) + Math.min(40, (t.radius || 20) * 1.2), o.crit || t.broken > 0 ? 0xffd23f : 0xffffff, o.crit ? 46 : 30);
    this.sfx.play(o.crit ? 'crit' : 'hit');
    if (mine && t.isBoss && !t.dead) this.ultGain(dmg * CFG.ULT.bossDmgGain);
    if (t.hp <= 0) {
      // Big ink banner only for boss deathblows; regular bugs get a small label over their head.
      if (wasBroken && mine) { if (t.isBoss) this.hud.ink('DEATHBLOW'); else this.hud.worldLabel(t, 'DEATHBLOW', '#ffcc33'); }
      t.die(o.team);
      if (mine) {
        this.addStyle('kill'); this.onKillUlt(t);
        const M = CFG.META, k = t.isBoss ? 'boss' : t.elite ? 'elite' : 'bug';
        this.earn(M.gf[k] + (k === 'bug' && t.big ? 1 : 0), M.croak[k] + (wasBroken ? M.croak.deathblow : 0), t.x, t.y);
      }
    }
    else if (t.onDamaged) t.onDamaged(dmg);
  }

  // Posture (stance-break): fill the bar to break the target (stun + deathblow window).
  addPosture(t, amt) {
    if (!t || t.dead || !t.postureMax || t.broken > 0 || t.stunned) return;
    t.posture += amt;
    t.postureT = CFG.POSTURE.delay;
    this.fx.ring(t.x, t.y, 30, 0xffffff, 6, 30, 0.2, 0.7);
    if (t.posture >= t.postureMax) {
      t.posture = 0;
      this.breakPosture(t);
    }
  }

  breakPosture(t) {
    this.sfx.play('break');
    this.fx.ring(t.x, t.y, 25, 0xffaa33, 10, t.big ? 220 : 120, 0.5);
    this.fx.burst(t.x, t.y, 30, 0xffcc44, 20, 280, 0.5, 3);
    this.fx.addShake(t.big ? 16 : 8);
    this.hitstop(t.big ? CFG.PARRY.bigBreakHitstop : CFG.PARRY.breakHitstop);
    // Crucial moments (a boss open for a deathblow) get the big banner + slash; everything else a label over its head.
    if (t.isBoss) { this.hud.ink('POSTURE BROKEN', '', 'DEATHBLOW READY'); this.hud.postureSlash(); }
    else this.hud.worldLabel(t, 'POSTURE BROKEN', '#ffaa33');
    if (t.isBoss && this.bossUlt && this.bossUlt.b === t) { this.endBossUlt('broken'); t.stun(CFG.POSTURE.bossStun * 1.6); this.fx.addShake(22); }
    else if (t.isBoss) t.stun(CFG.POSTURE.bossStun);
    else if (t.stun) t.stun(3);
    else { t.broken = CFG.POSTURE.brokenTime; t.stagger = t.broken; t.atk = null; }
  }

  swordStrike({ team, x, y, yaw, step, src, mult = 1 }) {
    const S = CFG.SWORD;
    const range = S.range[step], half = S.halfArc[step];
    let dmg = S.dmg[step] * mult * (team === 'player' && this.playerUlt ? CFG.ULT.mult : 1) * (team === 'player' && src.up ? src.up.sword : 1);
    const crit = team === 'player' && src.counterT > 0;
    const rip = crit && src.riposteT > 0;
    if (crit) {
      dmg *= S.critMult;
      src.counterT = 0;
      if (rip) { src.riposteT = 0; this.hud.flash('RIPOSTE!', '#ff9a1a'); this.addStyle('riposte'); this.fx.addShake(14); this.fovPunch(8); this.hitstop(CFG.PARRY.hitstop); }
      else this.hud.flash('COUNTER!', '#ffee55');
      this.addStyle('counter');
    }
    const col = crit ? 0xffee55 : team === 'ghost' ? 0x66ddff : 0xffffff;
    this.fx.slash(x, y, 16, yaw, range, half, col);
    if (step === 2) {
      this.fx.ring(x + Math.cos(yaw) * 60, y + Math.sin(yaw) * 60, 6, col, 10, 90, 0.3);
      this.fx.burst(x + Math.cos(yaw) * 70, y + Math.sin(yaw) * 70, 8, 0xcccccc, 8, 160, 0.4, 3);
    }
    const targets = team === 'player' ? [...this.enemies] : [...this.enemies, this.player];
    if (this.boss && this.boss.active) targets.push(this.boss);
    if (team === 'player' && this.ghost) targets.push(this.ghost);
    let hits = 0;
    for (const t of targets) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d - t.radius > range) continue;
      const a = Math.atan2(t.y - y, t.x - x);
      if (d > t.radius + 30 && Math.abs(angDiff(yaw, a)) > half) continue;
      if (t === this.player) {
        this.player.takeHit(dmg, src, { parryable: true });
        hits++;
      } else {
        const wasBug = t.team === 'bug';
        this.damageTarget(t, dmg, { team, knock: true, ang: a, crit });
        if (team === 'player' && !t.dead) this.addPosture(t, CFG.POSTURE.sword[step] * (crit ? CFG.POSTURE.critMult : 1) * (rip ? CFG.PERIL.ripostePosture : 1) * (this.playerUlt ? CFG.ULT.postureMult : 1));
        hits++;
        if (crit && wasBug && t.dead) this.pickups.spawn('bullet', t.x, t.y);
      }
    }
    if (hits && team === 'player') {
      this.hitstop(step === 2 ? 0.08 : 0.05);
      this.fx.addShake(step === 2 ? 10 : 4);
    }
  }

  triggerZone(i) {
    const lv = this.levelCfg;
    const z = lv.zones[i];
    this.zoneDone[i] = true;
    const rng = new Rng(lv.seed * 7 + i);
    // Interleave types so each wave is a mix, then send them in quick waves.
    const list = [];
    const left = z.spawns.map(([t, n]) => [t, n]);
    while (left.some((s) => s[1] > 0)) for (const s of left) if (s[1] > 0) { list.push(s[0]); s[1]--; }
    const first = Math.ceil(list.length * CFG.ZONE.firstWave);
    this.spawnWave(z, list.slice(0, first), rng);
    if (list.length > first) this.waves.push({ z, list: list.slice(first), rng, t: CFG.ZONE.waveGap });
    for (const [t, dx, dy] of z.pickups || []) this.pickups.spawn(t, z.x + dx, z.y + dy);
    this.hud.flash('Swarm incoming!', '#ffdd55');
    this.sfx.play('buzz');
  }

  spawnWave(z, types, rng) {
    for (const type of types) {
      let x = z.x, y = z.y;
      for (let tries = 0; tries < 10; tries++) {
        const a = rng.range(0, Math.PI * 2), r = rng.range(80, z.r * 0.85);
        x = z.x + Math.cos(a) * r; y = z.y + Math.sin(a) * r;
        if (!this.world.blocked(x, y, 30) && Math.hypot(x - this.player.x, y - this.player.y) > 260) break;
      }
      this.spawnEnemy(type, x, y);
    }
  }

  updateWaves(dt) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.t -= dt;
      if (w.t <= 0 || this.enemies.length <= CFG.ZONE.clearLeft) {
        this.waves.splice(i, 1);
        this.spawnWave(w.z, w.list, w.rng);
        this.hud.flash('Next wave!', '#ffdd55');
        this.sfx.play('buzz');
      }
    }
  }

  startPrelude(type, bx, by) {
    this.bossStarted = true;
    this.boss = makeBoss(type, this, bx, by);
    this.boss.kind = type;
    this.boss.hp = this.boss.maxHp = Math.round(this.boss.maxHp * this.D.bossHp);
    this.state = 'PRELUDE';
    this.hud.show(false);
    this.pre = { t: 0, dur: CFG.BOSS.preludeDur, a0: Math.atan2(this.player.y - by, this.player.x - bx) };
    this.sfx.play('boss');
    this.screens.preludeStart(this.boss, () => {
      this.boss.active = true;
      this.boss.entrance(1);
      this.hud.show(true);
      this.hud.setBoss(this.boss);
      this.sfx.intensity = 1;
      this.state = 'PLAYING';
      this.input.clear();
      this.clock.getDelta();
    });
  }

  separate() {
    const items = [this.player, ...this.enemies.filter((e) => !e.latched)];
    if (this.boss && this.boss.active && !this.boss.dead) items.push(this.boss);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a === this.player && this.player.dashT > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.9;
        const d = Math.hypot(dx, dy);
        if (d >= min || d < 0.001) continue;
        const push = min - d;
        const nx = dx / d, ny = dy / d;
        const aw = a.isBoss ? 0 : b.isBoss ? 1 : 0.5;
        const bw = b.isBoss ? 0 : a.isBoss ? 1 : 0.5;
        if (a === this.player) { a.x -= nx * push * aw; a.y -= ny * push * aw; b.x += nx * push * bw; b.y += ny * push * bw; }
        else { a.x -= nx * push * aw; a.y -= ny * push * aw; b.x += nx * push * bw; b.y += ny * push * bw; }
      }
    }
    this.world.resolve(this.player);
    for (const e of this.enemies) if (!e.latched) this.world.resolve(e);
  }

  // Leeches latched on the frog slow it down.
  leechSlow() {
    let n = 0;
    for (const e of this.enemies) if (e.latched) n++;
    return n ? Math.max(CFG.LEECH.minSlow, 1 - CFG.LEECH.slowEach * n) : 1;
  }

  // ------------------------------------------------------------ main loop
  frame() {
    const raw = clamp(this.clock.getDelta(), 0, 0.05);
    const inp = this.input;
    if (inp.pressed(CFG.KEYS.mute)) this.sfx.toggleMute();
    switch (this.state) {
      case 'PLAYING':
        // A throw inside the animation-loop callback would stop the loop for good (looks like a freeze): contain it.
        try { this.step(raw); } catch (e) { if (!this._errShown) { this._errShown = true; console.error('step failed', e); } this.hitstopT = 0; this.slowT = 0; }
        break;
      case 'PRELUDE': this.preludeStep(raw); break;
      case 'MENU':
      case 'STATS':
      case 'CUTSCENE':
        this.fx.update(raw);
        if (this.menu3d.active && this.state !== 'CUTSCENE') this.menu3d.update(raw);
        else {
          this.world.cam.yaw += raw * 0.25;
          this.player.yaw += raw * 0.4;
          if (this.state === 'MENU') this.player.sync();
          this.world.followCamera(this.player, raw, 0);
        }
        this.player.animTick(raw);
        if (this.state === 'STATS' && inp.pressed(CFG.KEYS.restart)) this.restart();
        break;
      default: break;
    }
    this.hud3d.setOn(!!Settings.get('hud3d') && (this.state === 'PLAYING' || this.state === 'PAUSED'));
    this.hud3d.update(raw);
    this.guide.update(raw);
    this.world.updateAmbient(raw);
    this.world.ascii.center.set(this.player.x, this.player.y);
    this.world.render(raw);
    if (!this._holdInput) inp.endFrame();
    this._holdInput = false;
  }

  preludeStep(raw) {
    const pre = this.pre, b = this.boss;
    pre.t += raw;
    const p = clamp(pre.t / pre.dur, 0, 1);
    b.entrance(p);
    this.fx.update(raw);
    const a = pre.a0 + p * 1.3;
    const dist = 560 - 100 * p;
    const cam = this.world.camera;
    cam.position.set(b.x + Math.cos(a) * dist, b.y + Math.sin(a) * dist, 170 + 120 * Math.sin(p * Math.PI));
    cam.lookAt(b.x, b.y, (b.z || 0) * 0.7 + 50);
    if (p >= 1 && this.screens.prel) this.screens.prel.skip();
  }

  step(raw) {
    const inp = this.input, K = CFG.KEYS;
    const cam = this.world.cam;
    // Camera input
    const [mdx, mdy] = inp.takeMouse();
    const pl0 = this.player;
    // Mouse sensitivity, separate aim (ADS) multiplier and vertical multiplier from Settings
    const sens = Settings.get('sens') * (pl0.aiming ? Settings.get('aimSens') : 1);
    cam.yaw -= mdx * 0.0024 * sens;
    cam.pitch = clamp(cam.pitch + mdy * 0.002 * sens * Settings.get('ySens') * (Settings.get('invertY') ? -1 : 1), 0.15, 1.25);
    if (inp.down('ArrowLeft')) cam.yaw += 2.2 * raw;
    if (inp.down('ArrowRight')) cam.yaw -= 2.2 * raw;
    if (inp.down('ArrowUp')) cam.pitch = clamp(cam.pitch - 1.2 * raw, 0.15, 1.25);
    if (inp.down('ArrowDown')) cam.pitch = clamp(cam.pitch + 1.2 * raw, 0.15, 1.25);

    if (inp.pressed(K.pause)) { this.pause(); return; }

    if (!isFinite(this.hitstopT)) this.hitstopT = 0;
    if (!isFinite(this.slowT)) this.slowT = 0;
    if (this.freezeGap > 0 && !(this.hitstopT > 0)) this.freezeGap -= raw;
    if (this.hitstopT > 0) {
      this.hitstopT -= raw;
      // Hard wall-clock cap so a hitstop can never hang the game.
      if (performance.now() - (this._hsStart || 0) > CFG.PARRY.maxHitstop * 1000) this.hitstopT = 0;
      this._holdInput = true; // don't swallow key presses made during the freeze
      // Only gameplay pauses: camera, particles, glyphs and HUD keep animating.
      this.camFov(raw);
      this.fx.update(raw * 0.35);
      this.perilFx.update(raw);
      this.world.followCamera(this.player, raw, this.fx.shake);
      this.hud.update(this, raw);
      return;
    }
    const slow = this.slowT > 0 ? 0.25 : 1;
    this.slowT = Math.max(0, this.slowT - raw);
    const dt = raw * slow;
    // Time Snail slows, Time Shard freezes bugs (bosses crawl at 20%)
    this.freezeT = Math.max(0, (this.freezeT || 0) - dt);
    const frozen = this.freezeT > 0;
    const es = frozen ? 0 : this.snailT > 0 ? 0.5 : 1;
    this.snailT = Math.max(0, this.snailT - dt);
    this.simT += dt;
    this.recorder.t = this.simT;

    const pl = this.player;
    this.camFov(raw);
    this.updateAim();
    pl.update(dt, inp, cam);
    if (this.state !== 'PLAYING') return;
    // Camera roll leaning into dodges
    const rollT = pl.dashT > 0 ? -pl.dashLat * CFG.DODGE.roll : 0;
    cam.roll = (cam.roll || 0) + (rollT - (cam.roll || 0)) * (1 - Math.exp(-14 * raw));
    this.updateStyle(dt);

    const lv = this.levelCfg;
    // Zone triggers
    (lv.zones || []).forEach((z, i) => {
      if (!this.zoneDone[i] && Math.hypot(pl.x - z.x, pl.y - z.y) < z.r * 0.7) this.triggerZone(i);
    });
    if (lv.boss && !this.bossStarted && Math.hypot(pl.x - lv.bossZone.x, pl.y - lv.bossZone.y) < lv.bossZone.r * 0.7) {
      this.startPrelude(lv.boss.type, lv.boss.x, lv.boss.y);
      return;
    }
    this.updateWaves(dt);
    if (inp.pressed(K.ult)) this.startUlt();
    if (inp.pressed(K.power)) this.usePower();
    this.updateUlt(dt);
    if (this.mode === 'survival') this.survivalUpdate(dt);
    if (this.mode === 'bossrush') this.rushUpdate(dt);

    const ds = this.D.speed;
    for (const e of this.enemies) e.update(dt * es * ds);
    const bu = this.bossUlt;
    if (this.boss && this.boss.active && !(bu && bu.phase === 'wind')) this.boss.update(dt * (frozen ? 0.2 : es) * ds * (bu ? CFG.ULT.bossSpeed : 1));
    if (this.ghost && !this.ghost.dead) this.ghost.update(dt * es);
    if (this.state !== 'PLAYING') return;
    this.projectiles.update(dt, es);
    this.pickups.update(dt);
    this.webs.update(dt);
    this.perilFx.update(dt);
    this.separate();
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.fx.update(dt);
    this.recorder.sample(this.simT, pl);

    // Goal
    if (this.mode === 'timeloop') {
      const open = this.goalOpen();
      if (open !== this._goalOpen) { this._goalOpen = open; this.world.setGoalOpen(open); if (open) this.hud.flash('GOAL OPEN!', '#33ff77'); }
      if (Math.hypot(pl.x - lv.goal.x, pl.y - lv.goal.y) < 80) {
        if (open) { this.endRun('win'); return; }
        this._hintT = (this._hintT || 0) - dt;
        if (this._hintT <= 0) { this._hintT = 2; this.hud.flash('Goal sealed: ' + this.objective(), '#ff7a7a'); }
      }
    }

    this.world.followCamera(pl, raw, this.fx.shake);
    this.hud.update(this, raw);
  }

  rushUpdate(dt) {
    const r = this.rush;
    if (this.boss || r.done) return;
    r.t -= dt;
    if (r.t <= 0) {
      const b = this.levelCfg.rush[r.i];
      this.startPrelude(b.type, b.x, b.y);
    }
  }

  survivalUpdate(dt) {
    const s = this.surv, pl = this.player;
    s.t += dt;
    this.score += dt * 0.5;
    s.spawnT -= dt;
    if (s.spawnT <= 0 && this.enemies.length < 26) {
      s.spawnT = Math.max(0.45, 2.4 - s.t * 0.012);
      const pool = ['gnat', 'gnat', 'ant'];
      if (s.t > 25) pool.push('juicebug');
      if (s.t > 35) pool.push('leech', 'spiderling');
      if (s.t > 55) pool.push('bomber');
      if (s.t > 40) pool.push('wasp');
      if (s.t > 70) pool.push('shellback');
      if (s.t > 100) pool.push('wasp', 'ant');
      const a = Math.random() * Math.PI * 2;
      const r = 650 + Math.random() * 200;
      this.spawnEnemy(pool[Math.floor(Math.random() * pool.length)], pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r);
    }
    s.ammoT -= dt;
    if (s.ammoT <= 0) {
      s.ammoT = 22;
      const half = this.levelCfg.half - 120;
      this.pickups.spawn('ammo', (Math.random() * 2 - 1) * half, (Math.random() * 2 - 1) * half);
    }
  }
}
