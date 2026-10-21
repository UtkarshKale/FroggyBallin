import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeActor, collectFlash, setFlash, stdMat } from '../core/Assets.js';
import { angDiff, lerpAngle, ease, clamp } from '../core/math.js';

export class Player {
  constructor(game) {
    this.g = game;
    this.team = 'player';
    this.radius = CFG.PLAYER.radius;
    this.root = makeActor('tode', CFG.PLAYER.height, 0x4caf50);
    this.flashList = collectFlash(this.root);
    this._buildGear();
    game.world.scene.add(this.root);
    this.reset(0, 0);
  }

  _buildGear() {
    // Sword on a pivot at the frog's right hand.
    this.pivot = new THREE.Group();
    this.pivot.position.set(6, -16, 24);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 7), stdMat(0xdfe8f0, { metalness: 0.8, roughness: 0.25 }));
    blade.position.x = 36;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(4, 18, 5), stdMat(0xffc400));
    guard.position.x = 10;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 4), stdMat(0x6d4c41));
    this.pivot.add(blade, guard, grip);
    this.root.add(this.pivot);
    // Gun on the left side.
    this.gun = new THREE.Group();
    this.gun.position.set(10, 15, 20);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 6), stdMat(0x444a55));
    barrel.position.x = 11;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 10), stdMat(0x6d4c41));
    handle.position.set(2, 0, -6);
    this.gun.add(barrel, handle);
    this.root.add(this.gun);
    // Parry shield disc
    this.parryDisc = new THREE.Mesh(
      new THREE.CircleGeometry(30, 24),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.parryDisc.rotation.y = Math.PI / 2;
    this.parryDisc.position.set(36, 0, 26);
    this.parryDisc.visible = false;
    this.root.add(this.parryDisc);
    // Tongue
    this.tongueMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 5), new THREE.MeshBasicMaterial({ color: 0xff5f8a }));
    this.tongueMesh.visible = false;
    this.g.world.scene.add(this.tongueMesh);
  }

  reset(x, y) {
    this.x = x; this.y = y; this.z = 0; this.vz = 0;
    this.vx = 0; this.vy = 0;
    this.yaw = 0;
    this.hp = CFG.PLAYER.hp;
    this.ammo = CFG.PLAYER.startAmmo;
    this.stamina = 100;
    this.staminaDelay = 0;
    this.dead = false;
    this.t = 0;
    this.swing = null;
    this.combo = 0;
    this.comboT = 99;
    this.slashBuf = 0;
    this.parryT = -1;
    this.parryCd = 0;
    this.counterT = 0;
    this.shootCd = 0;
    this.tongue = null;
    this.dashT = 0;
    this.dodgeCd = 0;
    this.iframes = 0;
    this.jumps = 0;
    this.flashT = 0;
    this.moving = false;
    this.faceHold = 0;
    this.pu = { fire: 0, dragon: 0, big: 0, shell: 0 };
    this.hitWall = false;
    this.root.visible = true;
    this.tongueMesh.visible = false;
    this.sync();
  }

  get parryActive() { return this.parryT >= 0; }
  get perfectWindow() { return this.parryT >= 0 && this.parryT < CFG.PARRY.perfect; }

  // Returns 'hit' | 'block' | 'perfect' | 'dodged' | 'shell'
  takeHit(dmg, src, opts = {}) {
    if (this.dead) return 'dodged';
    const g = this.g;
    if (this.iframes > 0) return 'dodged';
    if (opts.parryable !== false && this.parryActive) {
      if (this.parryT < CFG.PARRY.perfect) {
        this.counterT = CFG.PARRY.counterWindow;
        g.stats.perfectParries++;
        g.sfx.play('perfect');
        g.fx.ring(this.x, this.y, 20, 0xffffff, 10, 120, 0.4);
        g.fx.burst(this.x, this.y, 30, 0xffffff, 14, 260, 0.4, 2.5);
        g.fx.addShake(10);
        g.slowmo(CFG.PARRY.slowmo);
        g.hud.flash('PERFECT PARRY', '#fff');
        if (src && src.onParried) src.onParried();
        return 'perfect';
      }
      if (this.parryT < CFG.PARRY.block) {
        dmg *= CFG.PARRY.blockReduce;
        g.sfx.play('block');
        g.fx.burst(this.x, this.y, 30, 0x66ccff, 6, 140, 0.3, 2);
        if (opts.proj) { /* blocked projectile is consumed by caller */ }
        this._damage(dmg);
        return 'block';
      }
    }
    if (this.pu.shell > 0) {
      this.pu.shell--;
      g.sfx.play('block');
      g.fx.ring(this.x, this.y, 25, 0x8899ff, 10, 70, 0.3);
      return 'shell';
    }
    this._damage(dmg);
    g.sfx.play('hurt');
    g.fx.addShake(8);
    g.hud.hurt();
    return 'hit';
  }

  heal(n) {
    this.hp = Math.min(CFG.PLAYER.hp, this.hp + n);
    this.g.fx.burst(this.x, this.y, 30, 0x55ff55, 4, 90, 0.4, 2);
  }

  _damage(dmg) {
    this.hp -= dmg;
    this.flashT = 0.12;
    this.g.stats.damageTaken += dmg;
    if (this.hp <= 0 && !this.dead) {
      this.hp = 0;
      this.dead = true;
      this.g.fx.burst(this.x, this.y, 30, 0x4caf50, 24, 300, 0.8, 4);
      this.root.visible = false;
      this.g.endRun('dead');
    }
  }

  update(dt, input, cam) {
    if (this.dead) return;
    const g = this.g;
    const K = CFG.KEYS;
    this.t += dt;
    this.hitWall = false;
    for (const k of Object.keys(this.pu)) if (k !== 'shell') this.pu[k] = Math.max(0, this.pu[k] - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.parryCd = Math.max(0, this.parryCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.counterT = Math.max(0, this.counterT - dt);
    this.comboT += dt;
    this.slashBuf = Math.max(0, this.slashBuf - dt);
    this.faceHold = Math.max(0, this.faceHold - dt);
    if (this.parryT >= 0) {
      this.parryT += dt;
      if (this.parryT > CFG.PARRY.block) this.parryT = -1;
    }

    // Stamina regen
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + CFG.TONGUE.regen * dt);

    const aimYaw = cam.yaw;
    const fx = Math.cos(cam.yaw), fy = Math.sin(cam.yaw);
    const rx = Math.sin(cam.yaw), ry = -Math.cos(cam.yaw);
    const f = (input.down(K.forward) ? 1 : 0) - (input.down(K.back) ? 1 : 0);
    const r = (input.down(K.right) ? 1 : 0) - (input.down(K.left) ? 1 : 0);
    let mx = fx * f + rx * r, my = fy * f + ry * r;
    const ml = Math.hypot(mx, my);
    this.moving = ml > 0.01;
    if (this.moving) { mx /= ml; my /= ml; }

    // Actions
    if (input.mPressed(0)) this.slashBuf = 0.22;
    if (this.slashBuf > 0 && !this.swing && this.parryT < 0 && !this.tongue && this.dashT <= 0) this._startSwing(aimYaw);
    if (input.mPressed(2) && this.parryCd <= 0 && !this.tongue) this._startParry(aimYaw);
    if (input.pressed(K.shoot)) this._shoot(aimYaw);
    if (input.pressed(K.tongue)) this._startTongue(aimYaw);
    if (input.pressed(K.dodge) && this.dodgeCd <= 0 && this.dashT <= 0) {
      this.dashT = CFG.DODGE.dur;
      this.dodgeCd = CFG.DODGE.cooldown * (this.pu.dragon > 0 ? 0.6 : 1);
      this.iframes = CFG.DODGE.iframes;
      this.dashDir = this.moving ? Math.atan2(my, mx) : this.yaw;
      g.sfx.play('dodge');
      g.recorder.event('d');
      g.fx.burst(this.x, this.y, 10, 0xffffff, 6, 80, 0.3, 2);
    }
    if (input.pressed(K.jump)) {
      if (this.z <= 0.5) { this.vz = CFG.PLAYER.jumpV; this.jumps = 1; g.sfx.play('jump'); }
      else if (this.pu.dragon > 0 && this.jumps < 2) { this.vz = CFG.PLAYER.jumpV * 0.9; this.jumps = 2; g.sfx.play('jump'); g.fx.ring(this.x, this.y, this.z, 0x44ddff, 8, 40, 0.3); }
    }

    // Movement
    let speed = CFG.PLAYER.speed * (this.pu.dragon > 0 ? 1.4 : 1);
    if (this.swing) speed *= 0.5;
    if (this.parryT >= 0) speed *= 0.6;
    if (this.tongue) speed *= 0.6;
    let tvx = mx * speed, tvy = my * speed;
    if (this.dashT > 0) {
      this.dashT -= dt;
      tvx = Math.cos(this.dashDir) * speed * CFG.DODGE.speedMult;
      tvy = Math.sin(this.dashDir) * speed * CFG.DODGE.speedMult;
      this.vx = tvx; this.vy = tvy;
    } else {
      const k = 1 - Math.exp(-CFG.PLAYER.accel * dt);
      this.vx += (tvx - this.vx) * k;
      this.vy += (tvy - this.vy) * k;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Jump physics
    if (this.z > 0 || this.vz > 0) {
      this.vz -= CFG.PLAYER.gravity * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; this.jumps = 0; }
    }
    g.world.resolve(this);

    // Facing
    const busy = this.swing || this.parryT >= 0 || this.tongue || this.faceHold > 0;
    if (busy) this.yaw = lerpAngle(this.yaw, aimYaw, 1 - Math.exp(-30 * dt));
    else if (this.moving) this.yaw = lerpAngle(this.yaw, Math.atan2(my, mx), 1 - Math.exp(-16 * dt));

    this._updateSwing(dt);
    this._updateTongue(dt);
    this._updateGear(dt);
    this.sync();
  }

  _startSwing(aimYaw) {
    const S = CFG.SWORD;
    this.combo = this.comboT < S.comboWindow ? (this.combo + 1) % 3 : 0;
    this.swing = { step: this.combo, t: 0, hit: false, yaw: aimYaw };
    this.slashBuf = 0;
    this.yaw = aimYaw;
    this.g.sfx.play(this.combo === 2 ? 'slam' : 'slash');
    this.g.recorder.event('s', this.combo);
  }

  _updateSwing(dt) {
    const sw = this.swing;
    if (!sw) return;
    const S = CFG.SWORD;
    sw.t += dt;
    const dur = S.dur[sw.step];
    if (!sw.hit && sw.t >= dur * S.hitAt) {
      sw.hit = true;
      this.g.swordStrike({ team: 'player', x: this.x, y: this.y, yaw: sw.yaw, step: sw.step, src: this });
    }
    if (sw.t >= dur) { this.swing = null; this.comboT = 0; }
  }

  _startParry(aimYaw) {
    this.parryT = 0;
    this.parryCd = CFG.PARRY.cooldown;
    this.swing = null;
    this.yaw = aimYaw;
    this.g.sfx.play('parry');
    this.g.recorder.event('p');
  }

  _shoot(aimYaw) {
    const g = this.g;
    if (this.shootCd > 0 || this.tongue) return;
    if (this.ammo <= 0) { g.sfx.play('empty'); this.shootCd = 0.3; return; }
    this.ammo--;
    this.shootCd = CFG.GUN.cooldown;
    // Light aim assist toward the nearest target in the crosshair cone.
    let ang = aimYaw, best = CFG.GUN.assistCone;
    const targets = [...g.enemies];
    if (g.boss && g.boss.active) targets.push(g.boss);
    if (g.ghost && !g.ghost.dead) targets.push(g.ghost);
    for (const t of targets) {
      if (t.dead) continue;
      const a = Math.atan2(t.y - this.y, t.x - this.x);
      const d = Math.abs(angDiff(aimYaw, a));
      if (d < best) { best = d; ang = a; }
    }
    this.yaw = ang;
    this.faceHold = 0.25;
    const fire = this.pu.fire > 0;
    g.projectiles.spawn({
      x: this.x + Math.cos(ang) * 30, y: this.y + Math.sin(ang) * 30, z: 26,
      angle: ang, speed: CFG.GUN.speed, dmg: CFG.GUN.dmg * (fire ? 1.4 : 1), team: 'player', radius: CFG.GUN.radius,
      color: fire ? 0xff7a1a : 0xffee66, owner: this, burn: fire,
    });
    g.stats.shots++;
    g.sfx.play('shoot');
    g.recorder.event('g', +ang.toFixed(3));
    g.fx.burst(this.x + Math.cos(ang) * 32, this.y + Math.sin(ang) * 32, 26, 0xffdd55, 4, 100, 0.15, 2);
  }

  _startTongue(aimYaw) {
    if (this.tongue || this.stamina < CFG.TONGUE.cost || this.swing || this.parryT >= 0) return;
    this.stamina -= CFG.TONGUE.cost;
    this.staminaDelay = CFG.TONGUE.regenDelay;
    this.yaw = aimYaw;
    this.tongue = { t: 0, resolved: false, len: 0, target: null, yaw: aimYaw };
    this.g.sfx.play('tongue');
    this.g.recorder.event('t', +aimYaw.toFixed(3));
  }

  _updateTongue(dt) {
    const tg = this.tongue;
    if (!tg) { this.tongueMesh.visible = false; return; }
    const T = CFG.TONGUE;
    const range = T.range * (this.pu.big > 0 ? 2 : 1);
    tg.t += dt;
    if (!tg.resolved && tg.t >= T.resolveAt) {
      tg.resolved = true;
      this._resolveTongue(tg, range);
    }
    const out = tg.t < T.resolveAt;
    const reach = tg.target ? Math.hypot(tg.target.x - this.x, tg.target.y - this.y) : range * 0.8;
    const k = out ? tg.t / T.resolveAt : 1 - (tg.t - T.resolveAt) / (T.dur - T.resolveAt);
    tg.len = Math.max(1, reach * clamp(k, 0, 1));
    this.tongueMesh.visible = true;
    this.tongueMesh.scale.x = tg.len;
    this.tongueMesh.position.set(this.x + Math.cos(tg.yaw) * tg.len / 2, this.y + Math.sin(tg.yaw) * tg.len / 2, 22);
    this.tongueMesh.rotation.z = tg.yaw;
    if (tg.t >= T.dur) { this.tongue = null; this.tongueMesh.visible = false; }
  }

  _resolveTongue(tg, range) {
    const g = this.g;
    const maxEat = this.pu.big > 0 ? 3 : 1;
    const cands = [];
    for (const e of g.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d > range) continue;
      if (Math.abs(angDiff(tg.yaw, Math.atan2(e.y - this.y, e.x - this.x))) > CFG.TONGUE.halfArc) continue;
      cands.push({ e, d });
    }
    cands.sort((a, b) => a.d - b.d);
    let ate = 0;
    for (const { e } of cands) {
      if (ate >= maxEat) break;
      if (e.edible || e.hp / e.maxHp <= 0.25) {
        if (!tg.target) tg.target = e;
        e.eaten();
        ate++;
      } else if (ate === 0) {
        g.damageTarget(e, 5, { team: 'player' });
        e.stagger = Math.max(e.stagger, 0.3);
        tg.target = e;
        break;
      }
    }
    // Boss / ghost: small damage, ghost gets slowed
    if (!ate) {
      for (const big of [g.boss && g.boss.active ? g.boss : null, g.ghost]) {
        if (!big || big.dead) continue;
        const d = Math.hypot(big.x - this.x, big.y - this.y);
        if (d < range && Math.abs(angDiff(tg.yaw, Math.atan2(big.y - this.y, big.x - this.x))) < 0.6) {
          g.damageTarget(big, 5, { team: 'player' });
          if (big === g.ghost) big.slowT = 1;
          tg.target = big;
          g.sfx.play('hit');
          break;
        }
      }
    }
  }

  _updateGear(dt) {
    const sw = this.swing;
    const p = this.pivot;
    if (sw) {
      const dur = CFG.SWORD.dur[sw.step];
      const k = ease(clamp(sw.t / dur, 0, 1));
      if (sw.step === 2) {
        p.rotation.set(0, -1.7 + 2.3 * k, 0);
      } else {
        const a = sw.step === 0 ? 1.3 - 2.6 * k : -1.3 + 2.6 * k;
        p.rotation.set(0, 0, a);
      }
    } else if (this.parryT >= 0) {
      p.rotation.set(0, -0.9, 0);
    } else {
      p.rotation.set(0, 0.3, -1.45);
    }
    this.parryDisc.visible = this.parryT >= 0;
    if (this.parryT >= 0) {
      this.parryDisc.material.opacity = this.parryT < CFG.PARRY.perfect ? 0.9 : 0.4;
      this.parryDisc.material.color.setHex(this.parryT < CFG.PARRY.perfect ? 0xffffff : 0x66ccff);
    }
    this.gun.visible = this.ammo > 0 || true;
  }

  sync() {
    const hop = this.moving && this.z <= 0 ? Math.abs(Math.sin(this.t * 12)) * 5 : 0;
    this.root.position.set(this.x, this.y, this.z + hop);
    this.root.rotation.z = this.yaw;
    const stretch = this.z > 0 ? 1.08 : 1;
    this.root.scale.set(1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch), stretch);
    if (this.flashT > 0) {
      this.flashT -= 1 / 60;
      setFlash(this.flashList, 0xff3333);
    } else if (this.counterT > 0) {
      setFlash(this.flashList, 0x225577);
    } else {
      setFlash(this.flashList, null);
    }
    if (this.iframes > 0) this.root.visible = Math.floor(this.t * 30) % 2 === 0 || this.dashT > 0;
    else this.root.visible = !this.dead;
  }
}
