import * as THREE from 'three';
import { CFG, POWERUPS } from './config.js';
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
import { LEVELS, SURVIVAL_LEVEL } from './levels/levels.js';
import { Hud } from './ui/Hud.js';
import { Screens } from './ui/Screens.js';
import { INTRO_PANELS, GHOST_PANELS } from './ui/comics.js';

const newStats = () => ({ kills: 0, ghostKills: 0, eaten: 0, perfectParries: 0, shots: 0, hits: 0, damageTaken: 0, ghostKilledAt: null });

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
    this.simT = 0;
    this.score = 0;
    this.mode = 'timeloop';
    this.loopNo = 1;
    this.pb = null;
    this.snailT = 0;
    this.slowT = 0;
    this.hitstopT = 0;
    this.survBest = Storage.get('surv.best', 0);
    this.clock = new THREE.Clock();
  }

  async init() {
    await preload(['tode', 'enemy', 'small_house']);
    this.world = new World(this.canvas);
    this.fx = new Fx(this.world.scene);
    this.input = new Input(this.canvas);
    this.projectiles = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.recorder = new Recorder();
    this.hud = new Hud(this.uiRoot);
    this.screens = new Screens(this.uiRoot, this);
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
  }

  // ------------------------------------------------------------ flow
  toMenu() {
    this.cleanup();
    this.state = 'MENU';
    this.hud.show(false);
    this.input.exitLock();
    this.sfx.intensity = 0;
    const lv = LEVELS[0];
    this.levelCfg = lv;
    this.world.buildLevel(lv);
    this.player.reset(lv.start.x, lv.start.y);
    this.world.cam.pitch = 0.35;
    this.world.cam.dist = 330;
    this.world.snapCamera();
    this.screens.showMenu();
  }

  cleanup() {
    for (const e of this.enemies) this.world.scene.remove(e.root);
    this.enemies = [];
    if (this.boss) { this.boss.clearMarker?.(); this.world.scene.remove(this.boss.root); this.boss.rings?.forEach((r) => r.vis && this.world.scene.remove(r.vis)); }
    this.boss = null;
    if (this.ghost) this.world.scene.remove(this.ghost.root);
    this.ghost = null;
    this.projectiles.clear();
    this.pickups.clear();
    this.fx.clear();
    this.hud.setBoss(null);
    this.snailT = 0;
  }

  startRun(mode, levelId) {
    this.sfx.init();
    this.sfx.startMusic();
    this.cleanup();
    this.mode = mode;
    const level = mode === 'survival' ? SURVIVAL_LEVEL : LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    this.levelCfg = level;
    this.world.buildLevel(level);
    this.stats = newStats();
    this.simT = 0;
    this.score = 0;
    this.bossDead = !level.boss;
    this.bossStarted = false;
    this.zoneDone = (level.zones || []).map(() => false);
    this._goalOpen = null;
    this.surv = { t: 0, spawnT: 1.5, ammoT: 20 };
    this.slowT = 0; this.hitstopT = 0;
    this.sfx.intensity = 0;

    this.player.reset(level.start.x, level.start.y);
    this.recorder.reset();
    const cam = this.world.cam;
    cam.yaw = Math.atan2(-level.start.y || 0.01, -level.start.x || 0.01);
    cam.pitch = 0.55; cam.dist = 270;
    this.world.snapCamera();
    this.player.yaw = cam.yaw;

    this.ghost = null;
    this.pb = null;
    this.loopNo = 1;
    if (mode === 'timeloop') {
      const pbObj = Storage.get(`pb.${level.id}`, null);
      this.pb = pbObj ? pbObj.best : null;
      this.loopNo = (pbObj ? pbObj.wins : 0) + 1;
      const run = Storage.get(`ghost.${level.id}`, null);
      if (run && run.samples && run.samples.length > 2) this.ghost = new Ghost(this, run, this.loopNo);
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
    this.hud.show(true);
    this.screens.hide();
    this.input.clear();
    this.input.requestLock();
    this.clock.getDelta();
    if (this.mode === 'survival') this.hud.banner('SURVIVE', 'Slash, parry, eat. How long can you last?', '#7dff7d');
    else if (this.ghost) this.hud.banner(`LOOP ${this.loopNo}`, 'Kill your past self, beat the boss, reach the goal first!', '#66ddff', 3.2);
    else this.hud.banner('FIRST RUN', 'Clear the level to record your ghost', '#7dff7d', 3);
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

  // ------------------------------------------------------------ run end
  objective() {
    if (this.mode === 'survival') return 'Survive!';
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
    const d = { ...s, mode: this.mode, time: this.simT, score: this.score, loopNo: this.loopNo, hadGhost: !!this.ghost, ghostWon: reason === 'ghost', pb: this.pb };
    let delay = 0;
    if (this.mode === 'survival') {
      this.survBest = Math.max(this.survBest, this.score);
      Storage.set('surv.best', this.survBest);
      Object.assign(d, { win: false, title: 'GAME OVER', why: 'The swarm got you.' });
      this.sfx.play('lose'); delay = 900;
    } else if (reason === 'win') {
      const id = this.levelCfg.id;
      const run = this.recorder.finish(this.simT, this.player);
      Storage.set(`ghost.${id}`, run);
      const old = Storage.get(`pb.${id}`, null);
      const best = old ? Math.min(old.best, this.simT) : this.simT;
      d.newPB = !old || this.simT < old.best;
      Storage.set(`pb.${id}`, { best, wins: (old ? old.wins : 0) + 1 });
      d.pb = best;
      this.pb = best;
      Object.assign(d, { win: true, title: 'LOOP CLEARED', why: this.ghost ? 'You beat your past self.' : 'Run recorded. Your ghost awaits in the next loop.' });
      this.sfx.play('win');
    } else if (reason === 'ghost') {
      Object.assign(d, { win: false, title: 'THE PAST WAS FASTER', why: 'Your ghost reached the goal first.' });
      this.sfx.play('lose');
    } else {
      Object.assign(d, { win: false, title: 'FROG DOWN', why: this.ghost && !this.ghost.dead ? 'Your past self got you.' : 'The bugs got you.' });
      this.sfx.play('lose'); delay = 900;
    }
    this.sfx.intensity = 0;
    setTimeout(() => { if (this.state === 'STATS') { this.hud.show(false); this.screens.showStats(d); } }, delay);
  }

  onBossDead(b) {
    this.bossDead = true;
    this.sfx.intensity = 0;
    this.hud.setBoss(null);
    this.hud.banner('BOSS DEFEATED', this.ghost && !this.ghost.dead ? 'Now finish off your past self' : 'The goal is open!', '#ffd23f', 3);
    for (let i = 0; i < 6; i++) this.pickups.spawn('droplet', b.x, b.y);
    this.pickups.spawn('ammo', b.x + 40, b.y);
    const pu = ['firefly', 'dragon', 'shell', 'snail', 'bigmouth'];
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
  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }

  spawnEnemy(type, x, y) {
    const half = (this.levelCfg.half || CFG.ARENA_HALF) - 40;
    const e = new Enemy(this, type, clamp(x, -half, half), clamp(y, -half, half));
    this.world.resolve(e);
    this.enemies.push(e);
    return e;
  }

  maybeDrop(x, y) {
    if (Math.random() > CFG.POWERUP.dropChance) return;
    const types = ['firefly', 'dragon', 'shell', 'snail', 'bigmouth', 'ammo'];
    this.pickups.spawn(types[Math.floor(Math.random() * types.length)], x, y);
  }

  collect(type) {
    const p = this.player;
    const P = CFG.POWERUP;
    switch (type) {
      case 'droplet': p.heal(6); this.sfx.play('heal'); return;
      case 'bullet': p.ammo = Math.min(CFG.PLAYER.maxAmmo, p.ammo + 2); this.sfx.play('pickup'); return;
      case 'ammo': p.ammo = Math.min(CFG.PLAYER.maxAmmo, p.ammo + 6); break;
      case 'firefly': p.pu.fire = P.duration; break;
      case 'dragon': p.pu.dragon = P.duration; break;
      case 'bigmouth': p.pu.big = P.duration; break;
      case 'shell': p.pu.shell = 3; break;
      case 'snail': this.snailT = P.snail; break;
      default: break;
    }
    const def = POWERUPS[type];
    this.hud.flash(`${def.label}: ${def.desc}`, '#' + def.color.toString(16).padStart(6, '0'));
    this.sfx.play('power');
    this.fx.ring(p.x, p.y, 20, def.color, 10, 80, 0.4);
  }

  damageTarget(t, dmg, o = {}) {
    if (t.dead) return;
    if (t.stunned) dmg *= 1.5;
    t.hp -= dmg;
    t.flashT = 0.1;
    if (o.burn) t.burn = 3;
    if (o.knock && t.knock && !t.isBoss) t.knock(o.ang, CFG.SWORD.knock);
    this.fx.burst(t.x, t.y, 30, 0xffffff, 5, 150, 0.25, 2);
    this.sfx.play(o.crit ? 'crit' : 'hit');
    if (t.hp <= 0) t.die(o.team);
    else if (t.onDamaged) t.onDamaged(dmg);
  }

  swordStrike({ team, x, y, yaw, step, src }) {
    const S = CFG.SWORD;
    const range = S.range[step], half = S.halfArc[step];
    let dmg = S.dmg[step];
    const crit = team === 'player' && src.counterT > 0;
    if (crit) {
      dmg *= S.critMult;
      src.counterT = 0;
      this.hud.flash('COUNTER!', '#ffee55');
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
    for (const [type, n] of z.spawns) {
      for (let k = 0; k < n; k++) {
        let x = z.x, y = z.y;
        for (let tries = 0; tries < 10; tries++) {
          const a = rng.range(0, Math.PI * 2), r = rng.range(80, z.r * 0.85);
          x = z.x + Math.cos(a) * r; y = z.y + Math.sin(a) * r;
          if (!this.world.blocked(x, y, 30) && Math.hypot(x - this.player.x, y - this.player.y) > 260) break;
        }
        this.spawnEnemy(type, x, y);
      }
    }
    for (const [t, dx, dy] of z.pickups || []) this.pickups.spawn(t, z.x + dx, z.y + dy);
    this.hud.flash('Swarm incoming!', '#ffdd55');
    this.sfx.play('buzz');
  }

  startPrelude() {
    const lv = this.levelCfg;
    this.bossStarted = true;
    this.boss = makeBoss(lv.boss.type, this, lv.boss.x, lv.boss.y);
    this.state = 'PRELUDE';
    this.pre = { t: 0, dur: 5.2, a0: Math.atan2(this.player.y - lv.boss.y, this.player.x - lv.boss.x) };
    this.sfx.play('boss');
    this.screens.preludeStart(this.boss, () => {
      this.boss.active = true;
      this.boss.entrance(1);
      this.hud.setBoss(this.boss);
      this.sfx.intensity = 1;
      this.state = 'PLAYING';
      this.input.clear();
      this.clock.getDelta();
    });
  }

  separate() {
    const items = [this.player, ...this.enemies];
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
    for (const e of this.enemies) this.world.resolve(e);
  }

  // ------------------------------------------------------------ main loop
  frame() {
    const raw = clamp(this.clock.getDelta(), 0, 0.05);
    const inp = this.input;
    if (inp.pressed(CFG.KEYS.mute)) this.sfx.toggleMute();
    switch (this.state) {
      case 'PLAYING': this.step(raw); break;
      case 'PRELUDE': this.preludeStep(raw); break;
      case 'MENU':
      case 'STATS':
      case 'CUTSCENE':
        this.fx.update(raw);
        this.world.cam.yaw += raw * 0.25;
        this.player.yaw += raw * 0.4;
        if (this.state === 'MENU') this.player.sync();
        this.world.followCamera(this.player, raw, 0);
        if (this.state === 'STATS' && inp.pressed('KeyR')) this.restart();
        break;
      default: break;
    }
    this.world.render();
    inp.endFrame();
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
    cam.yaw -= mdx * 0.0024;
    cam.pitch = clamp(cam.pitch + mdy * 0.002, 0.15, 1.25);
    if (inp.down('ArrowLeft')) cam.yaw += 2.2 * raw;
    if (inp.down('ArrowRight')) cam.yaw -= 2.2 * raw;
    if (inp.down('ArrowUp')) cam.pitch = clamp(cam.pitch - 1.2 * raw, 0.15, 1.25);
    if (inp.down('ArrowDown')) cam.pitch = clamp(cam.pitch + 1.2 * raw, 0.15, 1.25);

    if (inp.pressed(K.pause)) { this.pause(); return; }

    if (this.hitstopT > 0) {
      this.hitstopT -= raw;
      this.world.followCamera(this.player, raw, this.fx.shake);
      this.hud.update(this, raw);
      return;
    }
    const slow = this.slowT > 0 ? 0.25 : 1;
    this.slowT = Math.max(0, this.slowT - raw);
    const dt = raw * slow;
    const es = this.snailT > 0 ? 0.5 : 1;
    this.snailT = Math.max(0, this.snailT - dt);
    this.simT += dt;
    this.recorder.t = this.simT;

    const pl = this.player;
    pl.update(dt, inp, cam);
    if (this.state !== 'PLAYING') return;

    const lv = this.levelCfg;
    // Zone triggers
    (lv.zones || []).forEach((z, i) => {
      if (!this.zoneDone[i] && Math.hypot(pl.x - z.x, pl.y - z.y) < z.r * 0.7) this.triggerZone(i);
    });
    if (lv.boss && !this.bossStarted && Math.hypot(pl.x - lv.bossZone.x, pl.y - lv.bossZone.y) < lv.bossZone.r * 0.7) {
      this.startPrelude();
      return;
    }
    if (this.mode === 'survival') this.survivalUpdate(dt);

    for (const e of this.enemies) e.update(dt * es);
    if (this.boss && this.boss.active) this.boss.update(dt * es);
    if (this.ghost && !this.ghost.dead) this.ghost.update(dt * es);
    if (this.state !== 'PLAYING') return;
    this.projectiles.update(dt, es);
    this.pickups.update(dt);
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

  survivalUpdate(dt) {
    const s = this.surv, pl = this.player;
    s.t += dt;
    this.score += dt * 0.5;
    s.spawnT -= dt;
    if (s.spawnT <= 0 && this.enemies.length < 26) {
      s.spawnT = Math.max(0.45, 2.4 - s.t * 0.012);
      const pool = ['gnat', 'gnat', 'ant'];
      if (s.t > 25) pool.push('juicebug');
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
