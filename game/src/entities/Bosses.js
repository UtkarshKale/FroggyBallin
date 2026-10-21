import * as THREE from 'three';
import { blob, stdMat, collectFlash, setFlash } from '../core/Assets.js';
import { lerp, lerpAngle, angDiff, clamp, ease, TAU } from '../core/math.js';
import { CFG } from '../config.js';
import { initPosture, tickPosture } from '../combat/Posture.js';

class Boss {
  constructor(game, { name, title, hp, r, posture = 120 }) {
    this.g = game;
    this.team = 'bug';
    this.isBoss = true;
    this.name = name;
    this.title = title;
    this.hp = this.maxHp = hp;
    this.radius = r;
    this.dead = false;
    this.active = false;
    this.stunned = false;
    this.stunT = 0;
    this.phase = 1;
    this.flashT = 0;
    this.burn = 0;
    this.t = 0;
    this.yaw = 0;
    this.state = 'move';
    this.st = 0;
    this.cd = 1.5;
    this.marker = null;
    this.stagger = 0;
    this.edible = false;
    this.shell = false;
    this.big = true;
    initPosture(this, posture);
  }
  finishBuild(root) {
    this.root = root;
    this.flashList = collectFlash(root);
    this.g.world.scene.add(root);
  }
  onParried() { this.g.addPosture(this, 45); }
  onDamaged() {
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      this.g.hud.flash('PHASE 2', '#ff6666');
      this.g.sfx.play('boss');
      this.g.fx.addShake(14);
      this.g.fx.ring(this.x, this.y, 20, 0xff4444, 20, 400, 0.6);
    }
  }
  stun(t) {
    this.stunned = true;
    this.stunT = t;
    this.state = 'stunned';
    this.st = 0;
    this.clearMarker();
    this.g.hud.flash('STUNNED - ATTACK!', '#ffee55');
  }
  clearMarker() { if (this.marker) { this.marker.remove(); this.marker = null; } }
  flashSync() {
    if (this.flashT > 0) setFlash(this.flashList, 0xffffff);
    else if (this.stunned) setFlash(this.flashList, Math.floor(this.t * 12) % 2 ? 0xaaaa00 : 0x333300);
    else if (this.telegraph) setFlash(this.flashList, Math.floor(this.t * 18) % 2 ? 0xff3300 : 0x550000);
    else setFlash(this.flashList, null);
  }
  die() {
    if (this.dead) return;
    this.dead = true;
    this.clearMarker();
    const g = this.g;
    g.world.scene.remove(this.root);
    g.fx.burst(this.x, this.y, 60, 0xffcc33, 60, 420, 1.2, 6);
    g.fx.ring(this.x, this.y, 20, 0xffffff, 20, 600, 0.8);
    g.fx.addShake(20);
    g.sfx.play('boss');
    g.stats.kills++;
    g.onBossDead(this);
  }
  burnTick(dt) {
    tickPosture(this, dt, 10);
    if (this.burn > 0) {
      this.burn -= dt;
      this.hp -= 6 * dt;
      if (this.hp <= 0) this.die();
    }
  }
}

// ---------------------------------------------------------------- Hornet Queen
export class HornetQueen extends Boss {
  constructor(game, x, y) {
    super(game, { name: 'HORNET QUEEN', title: 'Sovereign of the Sting', hp: 600, r: 62, posture: 120 });
    this.x = x; this.y = y; this.z = 110;
    const g = new THREE.Group();
    g.add(blob(0xf2b705, 55, 1.5, 1, 0.9, 0, 0, 0));
    for (const i of [-1, 0, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(48 - Math.abs(i) * 8, 7, 8, 24), stdMat(0x222222));
      ring.rotation.y = Math.PI / 2;
      ring.position.x = i * 30 - 4;
      g.add(ring);
    }
    g.add(blob(0xd89000, 34, 1, 1, 1, 90, 0, 6));
    g.add(blob(0xff2200, 7, 1, 1, 1, 116, 16, 12));
    g.add(blob(0xff2200, 7, 1, 1, 1, 116, -16, 12));
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 6), stdMat(0xffd700, { metalness: 0.7 }));
      c.rotation.x = Math.PI / 2;
      const a = (i / 5) * Math.PI - Math.PI / 2;
      c.position.set(88, Math.sin(a) * 26 * -1, 44 + Math.cos(a) * 4);
      g.add(c);
    }
    const sting = new THREE.Mesh(new THREE.ConeGeometry(10, 50, 8), stdMat(0x222222));
    sting.rotation.z = Math.PI / 2;
    sting.position.x = -100;
    g.add(sting);
    this.wings = [];
    for (const s of [1, -1]) {
      const piv = new THREE.Group();
      piv.position.set(0, s * 30, 45);
      const w = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.55 }));
      w.scale.set(30, 70, 2);
      w.position.y = s * 65;
      piv.add(w);
      piv.userData.side = s;
      g.add(piv);
      this.wings.push(piv);
    }
    const root = new THREE.Group();
    root.add(g);
    root.scale.setScalar(1);
    this.finishBuild(root);
    this.sync();
  }

  entrance(p) {
    this.z = lerp(700, 110, ease(clamp(p, 0, 1)));
    this.yaw = p * 6;
    if (Math.random() < 0.3) this.g.fx.burst(this.x, this.y, this.z, 0xffd400, 2, 200, 0.5, 3, 0);
    this.t += 0.016;
    this.wings.forEach((w) => { w.rotation.x = w.userData.side * Math.sin(this.t * 60) * 0.6; });
    this.sync();
  }

  update(dt) {
    if (this.dead) return;
    const g = this.g, p = g.player;
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.burnTick(dt);
    if (this.dead) return;
    this.wings.forEach((w) => { w.rotation.x = w.userData.side * Math.sin(this.t * 60) * 0.6; });
    this.telegraph = false;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const ph2 = this.phase === 2;
    this.st += dt;

    switch (this.state) {
      case 'move': {
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-5 * dt));
        const want = 300;
        const sp = ph2 ? 220 : 170;
        if (d > want + 70) { this.x += Math.cos(ang) * sp * dt; this.y += Math.sin(ang) * sp * dt; }
        else if (d < want - 70) { this.x -= Math.cos(ang) * sp * dt; this.y -= Math.sin(ang) * sp * dt; }
        else { this.x += Math.cos(ang + Math.PI / 2) * 110 * dt * Math.sign(Math.sin(this.t * 0.5)); this.y += Math.sin(ang + Math.PI / 2) * 110 * dt * Math.sign(Math.sin(this.t * 0.5)); }
        this.z = lerp(this.z, 95 + Math.sin(this.t * 3) * 10, 1 - Math.exp(-4 * dt));
        this.cd -= dt;
        if (this.cd <= 0) this.pickAttack(d);
        break;
      }
      case 'volley': {
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-8 * dt));
        this.telegraph = this.st < 0.6;
        if (!this.fired && this.st >= 0.6) {
          this.fired = true;
          const n = ph2 ? 7 : 5;
          const spread = ph2 ? 1.1 : 0.9;
          for (let i = 0; i < n; i++) {
            const a = ang + (i / (n - 1) - 0.5) * spread;
            g.projectiles.spawn({ x: this.x + Math.cos(this.yaw) * 90, y: this.y + Math.sin(this.yaw) * 90, z: 60, angle: a, speed: ph2 ? 440 : 380, dmg: 14, team: 'bug', radius: 12, color: 0xffc400, owner: this, fromBoss: true });
          }
          g.sfx.play('shoot');
        }
        if (this.st >= 1.0) this.endAttack();
        break;
      }
      case 'diveMark': {
        this.z = lerp(this.z, 230, 1 - Math.exp(-6 * dt));
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-8 * dt));
        const lockAt = ph2 ? 0.6 : 0.8;
        if (!this.marker) this.marker = g.fx.marker(p.x, p.y, 130, 0xff2200);
        if (this.st < lockAt) { this.mx = p.x; this.my = p.y; this.marker.m.position.set(this.mx, this.my, 2); }
        this.telegraph = true;
        if (this.st >= lockAt + 0.35) { this.state = 'diveFall'; this.st = 0; this.sx = this.x; this.sy = this.y; this.sz = this.z; g.sfx.play('buzz'); }
        break;
      }
      case 'diveFall': {
        const k = clamp(this.st / 0.3, 0, 1);
        this.x = lerp(this.sx, this.mx, k);
        this.y = lerp(this.sy, this.my, k);
        this.z = lerp(this.sz, 30, k);
        if (k >= 1) this.impact();
        break;
      }
      case 'diveRecover': {
        this.z = lerp(this.z, 110, 1 - Math.exp(-5 * dt));
        if (this.st > 0.8) {
          if (ph2 && !this.doubled) { this.doubled = true; this.state = 'diveMark'; this.st = 0; }
          else this.endAttack();
        }
        break;
      }
      case 'summon': {
        this.telegraph = this.st < 0.8;
        this.z = lerp(this.z, 150, 1 - Math.exp(-4 * dt));
        if (!this.fired && this.st >= 0.8) {
          this.fired = true;
          g.sfx.play('buzz');
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            g.spawnEnemy('gnat', this.x + Math.cos(a) * 140, this.y + Math.sin(a) * 140);
          }
          g.spawnEnemy('juicebug', this.x - Math.cos(ang) * 200, this.y - Math.sin(ang) * 200);
          g.fx.ring(this.x, this.y, 20, 0xffd400, 20, 220, 0.5);
        }
        if (this.st >= 1.3) this.endAttack();
        break;
      }
      case 'stunned': {
        this.stunT -= dt;
        this.z = lerp(this.z, 28, 1 - Math.exp(-10 * dt));
        if (this.stunT <= 0) { this.stunned = false; this.state = 'move'; this.cd = 1.2; this.st = 0; }
        break;
      }
      default: break;
    }
    g.world.resolve(this);
    this.sync();
    this.flashSync();
  }

  pickAttack(d) {
    const g = this.g;
    this.st = 0; this.fired = false; this.doubled = false;
    const bugs = g.enemies.length;
    const r = Math.random();
    if (bugs < 6 && r < 0.25) { this.state = 'summon'; g.sfx.play('boss'); }
    else if (r < 0.65) { this.state = 'volley'; g.sfx.play('warn'); }
    else { this.state = 'diveMark'; g.sfx.play('warn'); }
  }

  endAttack() {
    this.clearMarker();
    this.state = 'move';
    this.st = 0;
    this.cd = this.phase === 2 ? 1.3 : 2.2;
  }

  impact() {
    const g = this.g, p = g.player;
    this.clearMarker();
    this.x = this.mx; this.y = this.my; this.z = 30;
    g.fx.ring(this.x, this.y, 5, 0xff5533, 20, 150, 0.4);
    g.fx.burst(this.x, this.y, 20, 0xffaa33, 20, 300, 0.5, 4);
    g.fx.addShake(12);
    g.sfx.play('slam');
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d < 130 + p.radius && p.z < 60) {
      const res = p.takeHit(24, this, { parryable: true });
      if (res === 'perfect') { this.stun(3); return; }
    }
    this.state = 'diveRecover';
    this.st = 0;
  }

  sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.z = this.yaw;
  }
}

// ---------------------------------------------------------------- Stag Beetle King
export class StagBeetleKing extends Boss {
  constructor(game, x, y) {
    super(game, { name: 'STAG BEETLE KING', title: 'Lord of the Hollow Log', hp: 900, r: 78, posture: 160 });
    this.x = x; this.y = y; this.z = 0;
    this.shell = true;
    const g = new THREE.Group();
    g.add(blob(0x4a1f12, 62, 1.35, 1, 0.8, -10, 0, 55));
    g.add(blob(0x6b2a17, 54, 1.25, 0.95, 0.6, -14, 0, 80));
    g.add(blob(0x2c1008, 34, 1, 1, 0.9, 80, 0, 50));
    g.add(blob(0xffdd00, 6, 1, 1, 1, 105, 16, 62));
    g.add(blob(0xffdd00, 6, 1, 1, 1, 105, -16, 62));
    // Mandibles
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(9, 90, 8), stdMat(0x8b3a1c, { metalness: 0.3 }));
      m.rotation.z = -Math.PI / 2 - s * 0.35;
      m.position.set(140, s * 32, 44);
      g.add(m);
    }
    // Crown shell plate on the front
    const plate = new THREE.Mesh(new THREE.BoxGeometry(10, 90, 70), stdMat(0xc9a227, { metalness: 0.8, roughness: 0.3 }));
    plate.position.set(60, 0, 62);
    g.add(plate);
    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 6), stdMat(0xffd700, { metalness: 0.8 }));
      spike.position.set(60, i * 18, 108);
      spike.rotation.x = Math.PI / 2;
      g.add(spike);
    }
    for (const lx of [-50, 0, 50]) for (const s of [1, -1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 60, 6), stdMat(0x2c1008));
      leg.position.set(lx, s * 62, 20);
      leg.rotation.x = Math.PI / 2 + s * 0.6;
      g.add(leg);
    }
    this.body = g;
    const root = new THREE.Group();
    root.add(g);
    this.finishBuild(root);
    this.rings = [];
    this.sync();
  }

  entrance(p) {
    const k = clamp(p, 0, 1);
    this.root.scale.setScalar(0.3 + 0.7 * ease(k));
    this.root.position.set(this.x, this.y, -80 * (1 - ease(k)));
    this.yaw = Math.PI * 0.75;
    this.root.rotation.z = this.yaw;
    if (Math.random() < 0.4) this.g.fx.burst(this.x + (Math.random() - 0.5) * 120, this.y + (Math.random() - 0.5) * 120, 5, 0x6d4c41, 3, 160, 0.6, 4);
    this.g.fx.addShake(2);
  }

  update(dt) {
    if (this.dead) return;
    const g = this.g, p = g.player;
    this.t += dt;
    this.root.scale.setScalar(1);
    this.flashT = Math.max(0, this.flashT - dt);
    this.burnTick(dt);
    if (this.dead) return;
    this.telegraph = false;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const ph2 = this.phase === 2;
    this.st += dt;
    this.updateRings(dt);

    switch (this.state) {
      case 'move': {
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-3.5 * dt));
        const sp = ph2 ? 130 : 95;
        if (d > 160) { this.x += Math.cos(this.yaw) * sp * dt; this.y += Math.sin(this.yaw) * sp * dt; }
        this.cd -= dt;
        if (this.cd <= 0) this.pickAttack(d);
        break;
      }
      case 'swipe': {
        this.telegraph = this.st < 0.5;
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-6 * dt));
        if (!this.fired && this.st >= 0.5) {
          this.fired = true;
          g.fx.slash(this.x, this.y, 18, this.yaw, 230, 1.0, 0xff6633);
          g.sfx.play('slash');
          const front = Math.abs(angDiff(this.yaw, ang)) < 1.1;
          if (d < 230 + p.radius && front) {
            const res = p.takeHit(22, this, { parryable: true });
            if (res === 'perfect') { this.hp -= 20; this.flashT = 0.15; this.stagger = 1.5; this.state = 'recover'; this.st = 0; return; }
          }
        }
        if (this.st >= 0.9) this.endAttack();
        break;
      }
      case 'chargeMark': {
        this.telegraph = true;
        if (this.st < 0.7) this.cAng = Math.atan2(p.y - this.y, p.x - this.x);
        this.yaw = lerpAngle(this.yaw, this.cAng, 1 - Math.exp(-14 * dt));
        if (!this.marker) this.marker = g.fx.marker(this.x, this.y, 40, 0xff2200);
        // Stretch the marker along the charge path.
        const len = 700;
        this.marker.m.position.set(this.x + Math.cos(this.cAng) * len / 2, this.y + Math.sin(this.cAng) * len / 2, 2);
        this.marker.m.scale.set(len / 2, 50, 1);
        this.marker.m.rotation.z = this.cAng;
        this.marker.s0 = this.marker.s1 = 1;
        if (this.st >= 0.95) { this.clearMarker(); this.state = 'charge'; this.st = 0; this.chit = false; g.sfx.play('boss'); }
        break;
      }
      case 'charge': {
        this.hitWall = false;
        this.x += Math.cos(this.cAng) * 860 * dt;
        this.y += Math.sin(this.cAng) * 860 * dt;
        g.world.resolve(this);
        if (Math.random() < 0.6) g.fx.burst(this.x, this.y, 8, 0x8d6e63, 1, 90, 0.4, 3);
        if (!this.chit && Math.hypot(p.x - this.x, p.y - this.y) < this.radius + p.radius) {
          this.chit = true;
          const res = p.takeHit(24, this, { parryable: true });
          if (res === 'perfect') { this.stun(4); return; }
        }
        if (this.hitWall) { g.fx.addShake(14); g.sfx.play('slam'); g.fx.ring(this.x, this.y, 5, 0xffffff, 20, 200, 0.4); this.stun(1.6); return; }
        if (this.st >= 0.8) {
          if (ph2) { this.state = 'slamWind'; this.st = 0; } else { this.state = 'recover'; this.st = 0; }
        }
        break;
      }
      case 'slamWind': {
        this.telegraph = true;
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-6 * dt));
        this.z = Math.sin(clamp(this.st / 0.7, 0, 1) * Math.PI) * 60;
        if (this.st >= 0.7) {
          this.z = 0;
          this.rings.push({ r: 40, hit: false });
          if (ph2) this.rings.push({ r: -80, hit: false });
          g.fx.addShake(16);
          g.sfx.play('slam');
          g.fx.burst(this.x, this.y, 5, 0x8d6e63, 20, 300, 0.6, 5);
          this.state = 'recover'; this.st = -0.3;
        }
        break;
      }
      case 'recover': {
        if (this.st >= 0.9) this.endAttack();
        break;
      }
      case 'stunned': {
        this.stunT -= dt;
        // flipped on its back
        this.body.rotation.x = lerp(this.body.rotation.x, Math.PI, 1 - Math.exp(-12 * dt));
        if (this.stunT <= 0) { this.stunned = false; this.state = 'move'; this.cd = 1.0; this.st = 0; }
        break;
      }
      default: break;
    }
    if (this.state !== 'stunned') this.body.rotation.x = lerp(this.body.rotation.x, 0, 1 - Math.exp(-12 * dt));
    if (this.state !== 'charge') g.world.resolve(this);
    this.sync();
    this.flashSync();
  }

  pickAttack(d) {
    const g = this.g;
    this.st = 0; this.fired = false;
    const r = Math.random();
    if (d < 230 && r < 0.5) { this.state = 'swipe'; g.sfx.play('warn'); }
    else if (r < 0.75) { this.state = 'chargeMark'; g.sfx.play('warn'); }
    else { this.state = 'slamWind'; g.sfx.play('warn'); }
  }

  endAttack() {
    this.clearMarker();
    this.state = 'move';
    this.st = 0;
    this.cd = this.phase === 2 ? 1.1 : 2.0;
  }

  updateRings(dt) {
    const g = this.g, p = g.player;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += 430 * dt;
      if (r.r < 0) continue;
      if (!r.vis) {
        r.vis = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 56), new THREE.MeshBasicMaterial({ color: 0xff7733, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
        g.world.scene.add(r.vis);
      }
      r.vis.position.set(this.x, this.y, 8);
      r.vis.scale.setScalar(r.r);
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (!r.hit && Math.abs(d - r.r) < 22 && p.z < 28) {
        r.hit = true;
        p.takeHit(18, this, { parryable: false });
      }
      if (r.r > 820) { g.world.scene.remove(r.vis); r.vis.geometry.dispose(); r.vis.material.dispose(); this.rings.splice(i, 1); }
    }
  }

  die() {
    for (const r of this.rings) if (r.vis) this.g.world.scene.remove(r.vis);
    this.rings.length = 0;
    super.die();
  }

  sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.z = this.yaw;
  }
}

export function makeBoss(type, game, x, y) {
  if (type === 'stag') return new StagBeetleKing(game, x, y);
  if (type === 'mantis') return new MantisDuelist(game, x, y);
  if (type === 'moth') return new ChronoMoth(game, x, y);
  return new HornetQueen(game, x, y);
}

// ---------------------------------------------------------------- Mantis Duelist
// A fencer: fast parryable scythe combos. Every perfect parry shaves a big chunk of its posture.
export class MantisDuelist extends Boss {
  constructor(game, x, y) {
    super(game, { name: 'MANTIS DUELIST', title: 'Blade of the Clockpond', hp: 700, r: 46, posture: 140 });
    this.x = x; this.y = y; this.z = 0;
    const g = new THREE.Group();
    g.add(blob(0x3fae4a, 28, 1.9, 0.8, 0.8, -10, 0, 74));
    g.add(blob(0x2c8a38, 24, 1.9, 0.8, 0.8, -62, 0, 64));
    g.add(blob(0x58c860, 20, 1, 1.1, 0.9, 42, 0, 98));
    g.add(blob(0xffee55, 6, 1, 1, 1, 56, 11, 102));
    g.add(blob(0xffee55, 6, 1, 1, 1, 56, -11, 102));
    for (const s of [1, -1]) {
      for (const lx of [-50, -10, 30]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3, 62, 6), stdMat(0x2c8a38));
        leg.position.set(lx, s * 24, 34);
        leg.rotation.x = Math.PI / 2 + s * 0.55;
        g.add(leg);
      }
    }
    this.arms = [];
    for (const s of [1, -1]) {
      const piv = new THREE.Group();
      piv.position.set(34, s * 24, 82);
      const a1 = new THREE.Mesh(new THREE.ConeGeometry(6, 70, 6), stdMat(0x4fcf5c));
      a1.rotation.z = -Math.PI / 2; a1.position.x = 35;
      const a2 = new THREE.Mesh(new THREE.ConeGeometry(5, 62, 6), stdMat(0xe8f4ff, { metalness: 0.7, roughness: 0.2 }));
      a2.rotation.z = -Math.PI / 2 - s * 0.5; a2.position.set(92, -s * 10, 0);
      piv.add(a1, a2);
      g.add(piv);
      this.arms.push(piv);
    }
    const root = new THREE.Group();
    root.add(g);
    this.body = g;
    this.finishBuild(root);
    this.cs = null;
    this.strikeT = 0;
    this.sync();
  }

  entrance(p) {
    const k = clamp(p, 0, 1);
    this.z = lerp(420, 0, ease(Math.min(1, k * 1.6)));
    this.yaw = Math.PI * 0.75 + k * 0.5;
    if (k > 0.55 && Math.random() < 0.2) this.g.fx.ring(this.x, this.y, 4, 0xffffff, 10, 90, 0.4);
    this.arms.forEach((a, i) => { a.rotation.y = -0.6 + Math.sin(k * 14 + i) * 0.4; });
    this.sync();
  }

  onParried() {
    this.g.addPosture(this, 45);
    if (this.state === 'combo') { this.state = 'recover'; this.st = -0.2; this.cs = null; }
  }

  update(dt) {
    if (this.dead) return;
    const g = this.g, p = g.player;
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.burnTick(dt);
    if (this.dead) return;
    this.telegraph = false;
    this.strikeT = Math.max(0, this.strikeT - dt);
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const ph2 = this.phase === 2;
    this.st += dt;

    switch (this.state) {
      case 'move': {
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-7 * dt));
        const sp = ph2 ? 270 : 210;
        if (d > 150) { this.x += Math.cos(this.yaw) * sp * dt; this.y += Math.sin(this.yaw) * sp * dt; }
        else { this.x += Math.cos(ang + Math.PI / 2) * 90 * dt * Math.sign(Math.sin(this.t)); this.y += Math.sin(ang + Math.PI / 2) * 90 * dt * Math.sign(Math.sin(this.t)); }
        this.cd -= dt;
        if (this.cd <= 0) this.pickAttack(d);
        break;
      }
      case 'combo': {
        const cs = this.cs, wt = ph2 ? 0.3 : 0.4, total = ph2 ? 4 : 3;
        cs.t += dt;
        if (cs.phase === 'wind') {
          this.telegraph = true;
          if (cs.t < wt * 0.6) this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-14 * dt));
          if (cs.t >= wt) {
            this.strikeT = 0.15;
            this.x += Math.cos(this.yaw) * 55; this.y += Math.sin(this.yaw) * 55;
            g.fx.slash(this.x, this.y, 18, this.yaw, 190, 1.0, 0xff7733);
            g.sfx.play('slash');
            const dd = Math.hypot(p.x - this.x, p.y - this.y);
            if (dd < 190 + p.radius && Math.abs(angDiff(this.yaw, Math.atan2(p.y - this.y, p.x - this.x))) < 1.0) {
              p.takeHit(15, this, { parryable: true });
              if (this.state !== 'combo') return;
            }
            cs.phase = 'gap'; cs.t = 0; cs.n++;
          }
        } else if (cs.t >= 0.22) {
          if (cs.n >= total) { this.state = 'recover'; this.st = 0; this.cs = null; } else { cs.phase = 'wind'; cs.t = 0; }
        }
        break;
      }
      case 'leapWind': {
        this.telegraph = true;
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-10 * dt));
        if (this.st >= 0.55) { this.state = 'leap'; this.st = 0; this.lx = p.x; this.ly = p.y; this.sx = this.x; this.sy = this.y; g.sfx.play('jump'); }
        break;
      }
      case 'leap': {
        const k = clamp(this.st / 0.5, 0, 1);
        this.x = lerp(this.sx, this.lx, k); this.y = lerp(this.sy, this.ly, k);
        this.z = Math.sin(k * Math.PI) * 130;
        if (k >= 1) {
          this.z = 0;
          g.fx.ring(this.x, this.y, 5, 0xff7733, 20, 130, 0.4);
          g.fx.addShake(10);
          g.sfx.play('slam');
          const dd = Math.hypot(p.x - this.x, p.y - this.y);
          if (dd < 110 + p.radius && p.z < 50) {
            const res = p.takeHit(22, this, { parryable: true });
            if (res === 'perfect') { this.stun(3); return; }
          }
          this.state = 'recover'; this.st = 0;
        }
        break;
      }
      case 'wave': {
        this.telegraph = this.st < 0.5;
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-10 * dt));
        if (!this.fired && this.st >= 0.5) {
          this.fired = true;
          this.strikeT = 0.15;
          const n = ph2 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            g.projectiles.spawn({ x: this.x + Math.cos(this.yaw) * 70, y: this.y + Math.sin(this.yaw) * 70, z: 40, angle: ang + (i - (n - 1) / 2) * 0.28, speed: 430, dmg: 14, team: 'bug', radius: 20, color: 0x88ffaa, owner: this, fromBoss: true });
          }
          g.sfx.play('slash');
        }
        if (this.st >= 0.9) this.endAttack();
        break;
      }
      case 'recover': {
        this.z = lerp(this.z, 0, 1 - Math.exp(-10 * dt));
        if (this.st >= 0.7) this.endAttack();
        break;
      }
      case 'stunned': {
        this.stunT -= dt;
        this.z = lerp(this.z, 0, 1 - Math.exp(-10 * dt));
        this.body.rotation.x = lerp(this.body.rotation.x, 0.5, 1 - Math.exp(-10 * dt));
        if (this.stunT <= 0) { this.stunned = false; this.state = 'move'; this.cd = 1.0; this.st = 0; }
        break;
      }
      default: break;
    }
    if (this.state !== 'stunned') this.body.rotation.x = lerp(this.body.rotation.x, 0, 1 - Math.exp(-10 * dt));
    // Arm pose: raised while telegraphing, thrust on strike
    this.arms.forEach((a, i) => {
      const raise = this.telegraph ? -1.0 : 0.15;
      const thrust = this.strikeT > 0 ? 0.9 : 0;
      a.rotation.y = lerp(a.rotation.y, raise + thrust, 1 - Math.exp(-25 * dt));
      a.rotation.z = Math.sin(this.t * 3 + i) * 0.1;
    });
    g.world.resolve(this);
    this.sync();
    this.flashSync();
  }

  pickAttack(d) {
    const g = this.g;
    this.st = 0; this.fired = false;
    const r = Math.random();
    if (d > 260 && r < 0.45) { this.state = 'wave'; g.sfx.play('warn'); }
    else if (d > 200 && r < 0.7) { this.state = 'leapWind'; g.sfx.play('warn'); }
    else { this.state = 'combo'; this.cs = { n: 0, phase: 'wind', t: 0 }; g.sfx.play('warn'); }
  }

  endAttack() {
    this.state = 'move'; this.st = 0; this.cs = null;
    this.cd = this.phase === 2 ? 0.9 : 1.5;
  }

  sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.z = this.yaw;
  }
}

// ---------------------------------------------------------------- Chrono Moth
// Final boss: heals by "rewinding" unless you slay its time-echoes.
export class ChronoMoth extends Boss {
  constructor(game, x, y) {
    super(game, { name: 'THE CHRONO MOTH', title: 'Devourer of Loops', hp: 800, r: 58, posture: 150 });
    this.x = x; this.y = y; this.z = 110;
    const g = new THREE.Group();
    g.add(blob(0x6a4fd8, 40, 1.5, 0.9, 0.9, 0, 0, 0));
    g.add(blob(0xb9a8ff, 26, 1, 1, 1, 68, 0, 8));
    g.add(blob(0xffee88, 6, 1, 1, 1, 88, 10, 14));
    g.add(blob(0xffee88, 6, 1, 1, 1, 88, -10, 14));
    for (const s of [1, -1]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 60, 5), stdMat(0xffd700));
      ant.position.set(86, s * 16, 46); ant.rotation.x = s * 0.5;
      g.add(ant);
    }
    this.wings = [];
    for (const s of [1, -1]) {
      const piv = new THREE.Group();
      piv.position.set(0, s * 30, 30);
      const w = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0x8a6cff, transparent: true, opacity: 0.6, emissive: 0x221166 }));
      w.scale.set(55, 95, 2);
      w.position.y = s * 80;
      const clock = new THREE.Mesh(new THREE.TorusGeometry(34, 3, 6, 24), stdMat(0xffd700, { metalness: 0.8 }));
      clock.position.y = s * 80;
      const hand = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), stdMat(0xffd700));
      hand.position.y = s * 80;
      piv.add(w, clock, hand);
      piv.userData.side = s; piv.userData.hand = hand;
      g.add(piv);
      this.wings.push(piv);
    }
    const root = new THREE.Group();
    root.add(g);
    this.finishBuild(root);
    this.sync();
  }

  entrance(p) {
    const k = clamp(p, 0, 1);
    this.z = lerp(800, 110, ease(k));
    this.yaw = k * 8;
    this.t += 0.016;
    if (Math.random() < 0.4) this.g.fx.burst(this.x, this.y, this.z, 0x8a6cff, 2, 220, 0.6, 3, 0);
    this.wings.forEach((w) => { w.rotation.x = w.userData.side * Math.sin(this.t * 30) * 0.5; });
    this.sync();
  }

  update(dt) {
    if (this.dead) return;
    const g = this.g, p = g.player;
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.burnTick(dt);
    if (this.dead) return;
    this.wings.forEach((w) => { w.rotation.x = w.userData.side * Math.sin(this.t * 30) * 0.5; w.userData.hand.rotation.z = this.t * 4; });
    this.telegraph = false;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const ph2 = this.phase === 2;
    this.st += dt;

    switch (this.state) {
      case 'move': {
        this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-5 * dt));
        const sp = ph2 ? 210 : 160;
        if (d > 400) { this.x += Math.cos(ang) * sp * dt; this.y += Math.sin(ang) * sp * dt; }
        else if (d < 260) { this.x -= Math.cos(ang) * sp * dt; this.y -= Math.sin(ang) * sp * dt; }
        else { const sgn = Math.sign(Math.sin(this.t * 0.5)); this.x += Math.cos(ang + Math.PI / 2) * 120 * dt * sgn; this.y += Math.sin(ang + Math.PI / 2) * 120 * dt * sgn; }
        this.z = lerp(this.z, 110 + Math.sin(this.t * 2.5) * 12, 1 - Math.exp(-4 * dt));
        this.cd -= dt;
        if (this.cd <= 0) this.pickAttack();
        break;
      }
      case 'ring': {
        this.telegraph = this.st < 0.7;
        if (!this.fired && this.st >= 0.7) { this.fired = true; this.fireRing(0); g.sfx.play('echo'); }
        if (ph2 && !this.fired2 && this.st >= 1.2) { this.fired2 = true; this.fireRing(Math.PI / 14); g.sfx.play('echo'); }
        if (this.st >= (ph2 ? 1.7 : 1.2)) this.endAttack();
        break;
      }
      case 'diveMark': {
        this.z = lerp(this.z, 230, 1 - Math.exp(-6 * dt));
        const lockAt = ph2 ? 0.6 : 0.8;
        if (!this.marker) this.marker = g.fx.marker(p.x, p.y, 130, 0xaa66ff);
        if (this.st < lockAt) { this.mx = p.x; this.my = p.y; this.marker.m.position.set(this.mx, this.my, 2); }
        this.telegraph = true;
        if (this.st >= lockAt + 0.35) { this.state = 'diveFall'; this.st = 0; this.sx = this.x; this.sy = this.y; this.sz = this.z; g.sfx.play('buzz'); }
        break;
      }
      case 'diveFall': {
        const k = clamp(this.st / 0.3, 0, 1);
        this.x = lerp(this.sx, this.mx, k); this.y = lerp(this.sy, this.my, k); this.z = lerp(this.sz, 30, k);
        if (k >= 1) this.impact();
        break;
      }
      case 'diveRecover': {
        this.z = lerp(this.z, 110, 1 - Math.exp(-5 * dt));
        if (this.st > 0.8) this.endAttack();
        break;
      }
      case 'rewind': {
        this.telegraph = this.st < 0.9;
        this.z = lerp(this.z, 150, 1 - Math.exp(-4 * dt));
        if (!this.fired && this.st >= 0.9) {
          this.fired = true;
          const n = ph2 ? 4 : 3;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + this.t;
            g.spawnEnemy('echo', this.x + Math.cos(a) * 170, this.y + Math.sin(a) * 170);
          }
          g.hud.flash('REWINDING! Kill the echoes!', '#ffd700');
          g.fx.ring(this.x, this.y, 20, 0xffd700, 20, 260, 0.6);
          g.sfx.play('rewind');
        }
        if (this.fired) {
          const alive = g.enemies.some((e) => e.type === 'echo' && !e.dead);
          if (alive) {
            this.hp = Math.min(this.maxHp, this.hp + 28 * dt);
            if (Math.random() < dt * 10) g.fx.burst(this.x, this.y, this.z, 0xffd700, 1, 80, 0.5, 3, -50);
          }
          if (!alive || this.st > 8) this.endAttack();
        }
        break;
      }
      case 'stunned': {
        this.stunT -= dt;
        this.z = lerp(this.z, 28, 1 - Math.exp(-10 * dt));
        if (this.stunT <= 0) { this.stunned = false; this.state = 'move'; this.cd = 1.2; this.st = 0; }
        break;
      }
      default: break;
    }
    g.world.resolve(this);
    this.sync();
    this.flashSync();
  }

  fireRing(off) {
    const g = this.g, n = this.phase === 2 ? 18 : 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + off;
      g.projectiles.spawn({ x: this.x, y: this.y, z: 60, angle: a, speed: 250, dmg: 10, team: 'bug', radius: 10, color: 0x66ddff, owner: this, fromBoss: true, life: 4 });
    }
  }

  pickAttack() {
    const g = this.g;
    this.st = 0; this.fired = false; this.fired2 = false;
    const echoes = g.enemies.some((e) => e.type === 'echo');
    const r = Math.random();
    if (!echoes && this.hp < this.maxHp * 0.85 && r < 0.3) this.state = 'rewind';
    else if (r < 0.65) this.state = 'ring';
    else this.state = 'diveMark';
    g.sfx.play('warn');
  }

  endAttack() {
    this.clearMarker();
    this.state = 'move'; this.st = 0;
    this.cd = this.phase === 2 ? 1.3 : 2.1;
  }

  impact() {
    const g = this.g, p = g.player;
    this.clearMarker();
    this.x = this.mx; this.y = this.my; this.z = 30;
    g.fx.ring(this.x, this.y, 5, 0xaa66ff, 20, 150, 0.4);
    g.fx.burst(this.x, this.y, 20, 0xaa88ff, 20, 300, 0.5, 4);
    g.fx.addShake(12);
    g.sfx.play('slam');
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d < 130 + p.radius && p.z < 60) {
      const res = p.takeHit(24, this, { parryable: true });
      if (res === 'perfect') { this.stun(3); return; }
    }
    this.state = 'diveRecover'; this.st = 0;
  }

  sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.z = this.yaw;
  }
}
