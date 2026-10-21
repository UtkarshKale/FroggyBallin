import * as THREE from 'three';
import { makeModel, blob, stdMat, collectFlash, setFlash } from '../core/Assets.js';
import { angDiff, lerpAngle, TAU } from '../core/math.js';
import { CFG } from '../config.js';
import { initPosture, tickPosture } from '../combat/Posture.js';
import { Overhead } from '../fx/Overhead.js';

export const ENEMY_TYPES = {
  gnat:      { hp: 10, r: 12, speed: 200, fly: true,  edible: true,  heal: 8,  posture: 16 },
  juicebug:  { hp: 24, r: 18, speed: 95,  fly: false, edible: true,  heal: 25, posture: 24 },
  wasp:      { hp: 32, r: 16, speed: 130, fly: true,  edible: false, heal: 10, posture: 36 },
  shellback: { hp: 64, r: 24, speed: 80,  fly: false, edible: false, heal: 15, posture: 80, shell: true, big: true },
  ant:       { hp: 28, r: 20, speed: 120, fly: false, edible: false, heal: 12, posture: 40 },
  echo:      { hp: 18, r: 12, speed: 190, fly: true,  edible: false, heal: 5,  posture: 12 },
};

function wing(color, size, x, y, z) {
  const piv = new THREE.Group();
  piv.position.set(x, y, z);
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, roughness: 0.3 }));
  m.scale.set(size * 0.5, size, 0.6);
  m.position.y = Math.sign(y) * size;
  piv.add(m);
  piv.userData.side = Math.sign(y);
  return piv;
}

function buildBug(type) {
  const g = new THREE.Group();
  const wings = [];
  switch (type) {
    case 'echo':
    case 'gnat':
      g.add(blob(type === 'echo' ? 0x66ddff : 0x2b2b3a, 8, 1.3, 0.8, 0.8, 0, 0, 0));
      g.add(blob(0x111118, 5, 1, 1, 1, 9, 0, 1));
      g.add(blob(0xff4455, 1.8, 1, 1, 1, 12, 3, 3));
      g.add(blob(0xff4455, 1.8, 1, 1, 1, 12, -3, 3));
      wings.push(wing(0xccddff, 9, 0, 4, 5), wing(0xccddff, 9, 0, -4, 5));
      break;
    case 'juicebug':
      g.add(blob(0x7dff6a, 17, 1.1, 1, 0.95, 0, 0, 17));
      g.add(blob(0xd8ffcf, 8, 1, 1, 1, 6, 0, 22));
      g.add(blob(0x111111, 2.4, 1, 1, 1, 17, 6, 22));
      g.add(blob(0x111111, 2.4, 1, 1, 1, 17, -6, 22));
      break;
    case 'wasp':
      g.add(blob(0xffd400, 11, 1.5, 0.9, 0.9, -4, 0, 0));
      for (const x of [-10, -2]) {
        const s = blob(0x222222, 9.5, 0.22, 0.95, 0.95, x, 0, 0);
        g.add(s);
      }
      g.add(blob(0xffa000, 8, 1, 1, 1, 14, 0, 2));
      g.add(blob(0xff2200, 2, 1, 1, 1, 20, 4, 4));
      g.add(blob(0xff2200, 2, 1, 1, 1, 20, -4, 4));
      const sting = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 6), stdMat(0x222222));
      sting.rotation.z = Math.PI / 2; sting.position.set(-22, 0, 0);
      g.add(sting);
      wings.push(wing(0xddeeff, 14, -2, 8, 9), wing(0xddeeff, 14, -2, -8, 9));
      break;
    case 'shellback':
      g.add(blob(0x222a44, 14, 1.2, 1, 0.8, -2, 0, 14));
      g.add(blob(0x3a4a9a, 26, 1.1, 1.0, 0.7, -2, 0, 18));
      g.add(blob(0x7a8acc, 20, 0.9, 0.8, 0.55, -4, 0, 24));
      g.add(blob(0x111111, 7, 1, 1, 1, 24, 0, 10));
      g.add(blob(0xffee00, 2, 1, 1, 1, 30, 3, 13));
      g.add(blob(0xffee00, 2, 1, 1, 1, 30, -3, 13));
      // front plate indicates where the shell reflects
      const plate = new THREE.Mesh(new THREE.BoxGeometry(4, 34, 24), stdMat(0xb0b8e8, { metalness: 0.6 }));
      plate.position.set(20, 0, 16);
      g.add(plate);
      break;
    default: break;
  }
  wings.forEach((w) => g.add(w));
  const root = new THREE.Group();
  root.add(g);
  root.userData.wings = wings;
  return root;
}

export class Enemy {
  constructor(game, type, x, y) {
    const T = ENEMY_TYPES[type];
    this.g = game;
    this.type = type;
    this.team = 'bug';
    this.x = x; this.y = y; this.z = 0;
    this.yaw = Math.random() * TAU;
    this.hp = this.maxHp = T.hp;
    this.radius = T.r;
    this.speed = T.speed;
    this.fly = !!T.fly;
    this.edible = !!T.edible;
    this.shell = !!T.shell;
    this.healAmt = T.heal;
    this.big = !!T.big;
    initPosture(this, T.posture);
    this.dead = false;
    this.stagger = 0;
    this.atk = null;
    this.atkCd = 0.6 + Math.random();
    this.flashT = 0;
    this.burn = 0;
    this.t = Math.random() * 10;
    this.kx = 0; this.ky = 0;
    this.lastHit = null;
    this.shotCd = 1 + Math.random() * 2;
    this.root = type === 'ant' ? (makeModel('enemy', 40) || buildFallbackAnt()) : buildBug(type);
    this.wings = this.root.userData.wings || [];
    this.flashList = collectFlash(this.root);
    game.world.scene.add(this.root);
    this.overhead = new Overhead(game.world.scene);
    this.sync();
  }

  get eatable() { return this.edible || this.broken > 0 || this.hp / this.maxHp <= 0.3; }

  onParried() {
    this.stagger = Math.max(this.stagger, 1.0);
    this.atk = null;
    this.atkCd = 1.3;
    this.g.fx.burst(this.x, this.y, 30, 0xffff66, 8, 150, 0.4, 2.5);
    this.g.addPosture(this, Math.max(CFG.POSTURE.parryMin, this.postureMax * CFG.POSTURE.parryFrac));
  }

  knock(ang, amt) { this.kx += Math.cos(ang) * amt * 6; this.ky += Math.sin(ang) * amt * 6; }

  update(dt) {
    if (this.dead) return;
    const g = this.g;
    const p = g.player;
    this.t += dt;
    if (this.burn > 0) {
      this.burn -= dt;
      this.hp -= 6 * dt;
      if (Math.random() < dt * 12) g.fx.burst(this.x, this.y, 30, 0xff8a1a, 1, 40, 0.3, 2);
      if (this.hp <= 0) { this.die('player'); return; }
    }
    this.flashT = Math.max(0, this.flashT - dt);
    this.atkCd -= dt;
    tickPosture(this, dt, CFG.POSTURE.regen);
    if (this.broken > 0) { this.stagger = Math.max(this.stagger, 0.05); this.atk = null; }
    // knock decay
    this.x += this.kx * dt; this.y += this.ky * dt;
    this.kx *= Math.exp(-8 * dt); this.ky *= Math.exp(-8 * dt);

    if (this.stagger > 0) {
      this.stagger -= dt;
    } else if (!p.dead) {
      this.ai(dt, p);
    }
    g.world.resolve(this);
    this.wings.forEach((w) => { w.rotation.x = w.userData.side * Math.sin(this.t * 55) * 0.6; });
    this.sync();
  }

  _face(ang, rate = 8, dt = 0.016) { this.yaw = lerpAngle(this.yaw, ang, 1 - Math.exp(-rate * dt)); }
  _go(ang, speed, dt) { this.x += Math.cos(ang) * speed * dt; this.y += Math.sin(ang) * speed * dt; }

  ai(dt, p) {
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    switch (this.type) {
      case 'echo':
      case 'gnat': {
        this._face(ang, 10, dt);
        const wob = Math.sin(this.t * 6 + this.x) * 0.5;
        this._go(ang + wob, this.speed, dt);
        if (d < this.radius + p.radius + 8 && this.atkCd <= 0) {
          this.atkCd = 0.9;
          p.takeHit(5, this, { parryable: true });
        }
        break;
      }
      case 'juicebug': {
        // Waddles away from the frog when close; otherwise wanders.
        if (d < 360) { this._face(ang + Math.PI, 6, dt); this._go(ang + Math.PI + Math.sin(this.t) * 0.6, this.speed, dt); }
        else { this._face(this.yaw + Math.sin(this.t * 0.7) * 0.5, 4, dt); this._go(this.yaw, this.speed * 0.4, dt); }
        break;
      }
      case 'wasp': {
        this._face(ang, 8, dt);
        if (d > 360) this._go(ang, this.speed, dt);
        else if (d < 230) this._go(ang + Math.PI, this.speed, dt);
        else this._go(ang + Math.PI / 2, this.speed * 0.6 * Math.sign(Math.sin(this.t * 0.4)), dt);
        this.shotCd -= dt;
        if (this.atk) {
          this.atk.t += dt;
          if (this.atk.t >= 0.5) {
            this.atk = null;
            this.shotCd = 2.2 + Math.random() * 0.6;
            this.g.projectiles.spawn({ x: this.x, y: this.y, z: 36, angle: Math.atan2(p.y - this.y, p.x - this.x), speed: 320, dmg: 12, team: 'bug', radius: 9, color: 0x99ff33, owner: this });
          }
        } else if (this.shotCd <= 0 && d < 700) {
          this.atk = { k: 'wind', t: 0 };
          this.g.sfx.play('warn');
        }
        break;
      }
      case 'shellback': {
        if (!this.atk) {
          this._face(ang, 5, dt);
          this._go(ang, this.speed, dt);
          if (d < 90 && this.atkCd <= 0) this.atk = { k: 'wind', t: 0 };
        } else {
          this.atk.t += dt;
          if (this.atk.t >= 0.55) {
            this.atk = null;
            this.atkCd = 1.8;
            const front = Math.abs(angDiff(this.yaw, Math.atan2(p.y - this.y, p.x - this.x))) < 1.1;
            if (d < 105 && front) p.takeHit(16, this, { parryable: true });
            this.g.fx.ring(this.x + Math.cos(this.yaw) * 50, this.y + Math.sin(this.yaw) * 50, 5, 0xaaaaff, 10, 55, 0.25);
          }
        }
        break;
      }
      case 'ant':
      default: {
        if (!this.atk) {
          this._face(ang, 9, dt);
          this._go(ang, this.speed, dt);
          if (d < 110 && this.atkCd <= 0) this.atk = { k: 'wind', t: 0, yaw: ang };
        } else if (this.atk.k === 'wind') {
          this.atk.t += dt;
          if (this.atk.t < 0.3) this.atk.yaw = ang;
          this._face(this.atk.yaw, 20, dt);
          if (this.atk.t >= 0.45) this.atk = { k: 'dash', t: 0, yaw: this.atk.yaw, hit: false };
        } else {
          this.atk.t += dt;
          this._go(this.atk.yaw, 720, dt);
          if (!this.atk.hit && d < this.radius + p.radius + 14) {
            this.atk.hit = true;
            p.takeHit(14, this, { parryable: true });
          }
          if (this.atk.t >= 0.22) { this.atk = null; this.atkCd = 1.4; }
        }
        break;
      }
    }
  }

  sync() {
    const zz = this.fly ? 34 + Math.sin(this.t * 6 + this.x * 0.01) * 4 : 0;
    this.root.position.set(this.x, this.y, zz);
    this.root.rotation.z = this.yaw;
    const p = this.g.player;
    const near = Math.hypot(p.x - this.x, p.y - this.y) < CFG.TONGUE.range * (p.pu.big > 0 ? 2 : 1) + 40;
    this.overhead.update(this.g.world.camera, this.x, this.y, zz + this.radius * 2 + 14, this.hp / this.maxHp, this.posture / this.postureMax, this.broken > 0, this.eatable && near);
    if (this.flashT > 0) setFlash(this.flashList, 0xffffff);
    else if (this.broken > 0) setFlash(this.flashList, Math.floor(this.t * 10) % 2 ? 0xffaa00 : 0x442200);
    else if (this.atk && this.atk.k === 'wind') setFlash(this.flashList, Math.floor(this.t * 20) % 2 ? 0xff2200 : 0x660000);
    else if (this.stagger > 0) setFlash(this.flashList, 0x888800);
    else if (this.burn > 0) setFlash(this.flashList, 0x773300);
    else setFlash(this.flashList, null);
  }

  eaten() {
    if (this.dead) return;
    this.dead = true;
    const g = this.g;
    this.overhead.remove();
    g.fx.dissolve(this.root, 0.25, g.player.x, g.player.y);
    g.fx.burst(this.x, this.y, 30, 0x66ff66, 10, 160, 0.4, 3);
    g.player.heal(this.healAmt);
    g.stats.eaten++;
    g.sfx.play('gulp');
    g.hud.flash(`+${this.healAmt} HP`, '#7dff7d');
  }

  die(team) {
    if (this.dead) return;
    this.dead = true;
    const g = this.g;
    this.overhead.remove();
    g.fx.dissolve(this.root, 0.3);
    const col = { gnat: 0x333344, juicebug: 0x7dff6a, wasp: 0xffd400, shellback: 0x4a5acc, ant: 0x884422 }[this.type] || 0xffffff;
    g.fx.burst(this.x, this.y, 30, col, 14, 240, 0.5, 3.5);
    if (team === 'player') g.stats.kills++;
    else if (team === 'ghost') g.stats.ghostKills++;
    g.sfx.play('hit');
    if (this.type === 'juicebug') for (let i = 0; i < 4; i++) g.pickups.spawn('droplet', this.x, this.y);
    if (this.type === 'shellback') { g.pickups.spawn('bullet', this.x + 12, this.y); g.pickups.spawn('bullet', this.x - 12, this.y); }
    if (this.type !== 'echo') g.maybeDrop(this.x, this.y);
    g.score += 10;
  }
}

function buildFallbackAnt() {
  const g = new THREE.Group();
  g.add(blob(0x883322, 12, 1.2, 0.9, 0.9, 0, 0, 14));
  g.add(blob(0x552211, 8, 1, 1, 1, 14, 0, 16));
  g.add(blob(0x883322, 10, 1.2, 0.9, 0.9, -14, 0, 14));
  const root = new THREE.Group();
  root.add(g);
  return root;
}
