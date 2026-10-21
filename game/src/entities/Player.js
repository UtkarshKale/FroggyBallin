import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeActor, collectFlash, setFlash, stdMat } from '../core/Assets.js';
import { angDiff, lerpAngle, ease, clamp, lerp } from '../core/math.js';

const tipV = new THREE.Vector3();

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
    this.bladeMat = stdMat(0xdfe8f0, { metalness: 0.8, roughness: 0.25 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(50, 4, 7), this.bladeMat);
    blade.position.x = 36;
    // Counter-window glow around the blade + a tip marker for the slash trail
    this.bladeGlow = new THREE.Mesh(new THREE.BoxGeometry(58, 10, 13), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.bladeGlow.position.x = 36;
    this.bladeGlow.visible = false;
    this.tip = new THREE.Object3D();
    this.tip.position.x = 60;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(4, 18, 5), stdMat(0xffc400));
    guard.position.x = 10;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 4), stdMat(0x6d4c41));
    this.pivot.add(blade, guard, grip, this.bladeGlow, this.tip);
    this.root.add(this.pivot);
    // Gun (holstered on the left hip, raised in gun mode).
    this.gun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 7), stdMat(0x444a55, { metalness: 0.6 }));
    barrel.position.x = 13;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 12), stdMat(0x6d4c41));
    handle.position.set(2, 0, -7);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.9 }));
    muzzle.position.x = 30;
    muzzle.visible = false;
    this.muzzle = muzzle;
    this.gun.add(barrel, handle, muzzle);
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
    this.tongueTip = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7fa0 }));
    this.tongueTip.visible = false;
    this.g.world.scene.add(this.tongueMesh, this.tongueTip);
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
    this.parryGrace = 0;
    this.parryStreak = 0;
    this.streakT = 0;
    this.webbedT = 0;
    this.jumps = 0;
    this.flashT = 0;
    this.moving = false;
    this.faceHold = 0;
    this.weapon = 'sword';
    this.aiming = false;
    this.muzzleT = 0;
    this.posture = 0;
    this.postureT = 0;
    this.broken = 0;
    this.dustT = 0;
    this.sq = 0;
    this.lastTip = null;
    this.dashLat = 0;
    this.hist = [];
    this.histT = 0;
    this.pu = { fire: 0, dragon: 0, big: 0, shell: 0, over: 0 };
    this.hitWall = false;
    this.root.visible = true;
    this.tongueMesh.visible = false;
    this.tongueTip.visible = false;
    this.sync();
  }

  get parryActive() { return this.parryT >= 0; }
  get perfectLen() { return CFG.PARRY.perfect * (this.pu.over > 0 ? 2 : 1) * (this.g.bossUltOn('tightParry') ? 0.5 : 1); }
  get ultOn() { return this.g.playerUlt; }
  get blockLen() { return CFG.PARRY.block * (this.pu.over > 0 ? 1.4 : 1); }

  // Returns 'hit' | 'block' | 'perfect' | 'dodged' | 'shell'
  takeHit(dmg, src, opts = {}) {
    if (this.dead) return 'dodged';
    const g = this.g, P = CFG.PLAYER_POSTURE;
    if (this.iframes > 0 || this.parryGrace > 0) return 'dodged';
    if (src && src === g.boss && g.bossUltOn()) dmg *= CFG.ULT.bossDmg;
    if (opts.parryable !== false && this.parryActive && this.broken <= 0) {
      if (this.parryT < this.perfectLen) {
        const big = !!(src && src.big);
        this.counterT = CFG.PARRY.counterWindow;
        this.posture = Math.max(0, this.posture - P.perfectRelief);
        this.stamina = Math.min(100, this.stamina + CFG.PARRY.staminaRefund);
        this.parryStreak = this.streakT > 0 ? this.parryStreak + 1 : 1;
        this.streakT = CFG.PARRY.streakWindow;
        g.stats.perfectParries++;
        g.parryFx(this, src, opts.proj, big, this.parryStreak);
        // Parrying something big freezes the whole game for a beat.
        this.parryGrace = big ? 0.7 : 0.35;
        if (big && g.bigFreeze()) { g.slowmo(0.4); g.hud.screenFlash(); }
        else { g.hitstop(0.09); g.slowmo(CFG.PARRY.slowmo); }
        g.hud.flash(big ? 'PERFECT PARRY!!' : 'PERFECT PARRY', '#fff');
        if (src && src.onParried) src.onParried();
        return 'perfect';
      }
      if (this.parryT < this.blockLen) {
        // Plain block: dull thud, small grey puff, pushed back. Clearly weaker than a perfect parry.
        g.sfx.play('block');
        g.fx.burst(this.x, this.y, 30, 0x9aa7b0, 4, 90, 0.25, 1.6);
        g.fx.addShake(3);
        if (src && src.x != null) {
          const a = Math.atan2(src.y - this.y, src.x - this.x);
          this.vx -= Math.cos(a) * CFG.PARRY.blockPush; this.vy -= Math.sin(a) * CFG.PARRY.blockPush;
        }
        this.addPosture(dmg * P.blockMult + P.blockAdd);
        this._damage(dmg * CFG.PARRY.blockReduce);
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
    this.parryStreak = 0;
    this.addPosture(dmg * P.hitMult);
    g.sfx.play('hurt');
    g.addStyle('hurt');
    g.fx.addShake(8);
    g.hud.hurt();
    return 'hit';
  }

  addPosture(a) {
    if (this.broken > 0 || this.dead) return;
    const P = CFG.PLAYER_POSTURE;
    this.posture += a;
    this.postureT = P.delay;
    if (this.posture >= P.max) {
      this.posture = P.max * 0.4;
      this.broken = P.brokenTime;
      this.swing = null; this.parryT = -1; this.tongue = null; this.dashT = 0;
      this.g.hud.flash('POSTURE BROKEN', '#ff9944');
      this.g.sfx.play('break');
      this.g.fx.addShake(12);
      this.g.fx.ring(this.x, this.y, 20, 0xffaa33, 10, 100, 0.4);
    }
  }

  heal(n) {
    this.hp = Math.min(CFG.PLAYER.hp, this.hp + n);
    this.g.fx.burst(this.x, this.y, 30, 0x55ff55, 4, 90, 0.4, 2);
  }

  _damage(dmg) {
    if (this.broken > 0) dmg *= 1.5;
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

  // Golden Fly: jump back ~3 seconds in time.
  rewind() {
    const h = this.hist;
    if (!h.length) return;
    const target = this.t - 3;
    let e = h[0];
    for (const s of h) { if (s.t <= target) e = s; else break; }
    this.g.fx.ring(this.x, this.y, 20, 0xffd700, 10, 160, 0.5);
    this.x = e.x; this.y = e.y; this.z = 0; this.vz = 0; this.vx = this.vy = 0;
    this.hp = Math.max(this.hp, e.hp);
    this.posture = 0;
    this.g.fx.ring(this.x, this.y, 20, 0xffd700, 160, 10, 0.5);
    this.g.sfx.play('rewind');
    this.g.world.snapCamera();
  }

  update(dt, input, cam) {
    if (this.dead) return;
    const g = this.g;
    const K = CFG.KEYS;
    this.t += dt;
    this.hitWall = false;
    for (const k of Object.keys(this.pu)) if (k !== 'shell') this.pu[k] = Math.max(0, this.pu[k] - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.parryGrace = Math.max(0, this.parryGrace - dt);
    this.webbedT = Math.max(0, this.webbedT - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.parryCd = Math.max(0, this.parryCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.counterT = Math.max(0, this.counterT - dt);
    this.streakT = Math.max(0, this.streakT - dt);
    if (this.streakT <= 0) this.parryStreak = 0;
    this.comboT += dt;
    this.slashBuf = Math.max(0, this.slashBuf - dt);
    this.faceHold = Math.max(0, this.faceHold - dt);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    if (this.parryT >= 0) {
      this.parryT += dt;
      if (this.parryT > this.blockLen) this.parryT = -1;
    }
    // History for Golden Fly rewind
    this.histT -= dt;
    if (this.histT <= 0) {
      this.histT = 0.1;
      this.hist.push({ t: this.t, x: this.x, y: this.y, hp: this.hp });
      if (this.hist.length > 45) this.hist.shift();
    }
    // Player posture
    const PP = CFG.PLAYER_POSTURE;
    if (this.broken > 0) this.broken = Math.max(0, this.broken - dt);
    else if (this.postureT > 0) this.postureT -= dt;
    else if (!g.bossUltOn('noRegen')) this.posture = Math.max(0, this.posture - PP.regen * dt);
    const locked = this.broken > 0;

    // Stamina regen
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + CFG.TONGUE.regen * dt);

    // Over-the-shoulder camera in gun mode: aim at the point under the crosshair, not parallel to it.
    const aimYaw = cam.yaw - (this.weapon === 'gun' ? Math.atan2(cam.shoulder || 0, 700) : 0);
    const fx = Math.cos(cam.yaw), fy = Math.sin(cam.yaw);
    const rx = Math.sin(cam.yaw), ry = -Math.cos(cam.yaw);
    const f = (input.down(K.forward) ? 1 : 0) - (input.down(K.back) ? 1 : 0);
    const r = ((input.down(K.right) ? 1 : 0) - (input.down(K.left) ? 1 : 0)) * (g.bossUltOn('reverse') ? -1 : 1);
    let mx = fx * f + rx * r, my = fy * f + ry * r;
    const ml = Math.hypot(mx, my);
    this.moving = ml > 0.01 && !locked;
    if (ml > 0.01) { mx /= ml; my /= ml; }

    // Weapon switching
    if (!locked && (input.pressed(K.weapon) || input.pressed(K.sword) || input.pressed(K.gun))) {
      let want = this.weapon === 'sword' ? 'gun' : 'sword';
      if (input.pressed(K.sword)) want = 'sword';
      if (input.pressed(K.gun)) want = 'gun';
      if (want !== this.weapon) {
        this.weapon = want;
        this.swing = null; this.parryT = -1; this.slashBuf = 0;
        g.sfx.play('equip');
        g.hud.flash(want === 'gun' ? 'GUN EQUIPPED: LMB fire, hold RMB to aim' : 'SWORD EQUIPPED', '#fff');
      }
    }
    const gunMode = this.weapon === 'gun';
    this.aiming = gunMode && input.mDown(2) && !locked;

    // Actions
    if (!locked) {
      if (!gunMode) {
        if (input.mPressed(0)) this.slashBuf = 0.22;
        // Shorter recovery: a buffered slash cancels the tail of the current swing.
        if (this.slashBuf > 0 && this.swing && this.swing.hit && this.swing.t >= CFG.SWORD.dur[this.swing.step] * CFG.SWORD.cancelAt) { this.swing = null; this.comboT = 0; }
        if (this.slashBuf > 0 && !this.swing && this.parryT < 0 && !this.tongue && this.dashT <= 0) this._startSwing(aimYaw);
        if (input.mPressed(2) && this.parryCd <= 0 && !this.tongue) this._startParry(aimYaw);
      } else if (input.mDown(0)) {
        this._shoot(aimYaw);
      }
      if (input.pressed(K.shoot)) this._shoot(aimYaw);
      if (input.pressed(K.tongue)) this._startTongue(aimYaw);
      if (input.pressed(K.dodge) && this.dodgeCd <= 0 && this.dashT <= 0) {
        this.dashT = CFG.DODGE.dur;
        this.dodgeCd = CFG.DODGE.cooldown * (this.pu.dragon > 0 ? 0.6 : 1);
        this.iframes = CFG.DODGE.iframes;
        this.dashDir = this.moving ? Math.atan2(my, mx) : this.yaw;
        this.dashLat = Math.cos(this.dashDir) * rx + Math.sin(this.dashDir) * ry; // + = rightward on screen (camera roll)
        g.sfx.play('dodge');
        g.recorder.event('d');
        g.fx.burst(this.x, this.y, 10, 0xffffff, 6, 80, 0.3, 2);
      }
      if (input.pressed(K.jump)) {
        if (this.z <= 0.5) { this.vz = CFG.PLAYER.jumpV; this.jumps = 1; this.sq = 0.28; g.sfx.play('jump'); }
        else if (this.pu.dragon > 0 && this.jumps < 2) { this.vz = CFG.PLAYER.jumpV * 0.9; this.jumps = 2; g.sfx.play('jump'); g.fx.ring(this.x, this.y, this.z, 0x44ddff, 8, 40, 0.3); }
      }
    }

    // Movement
    let speed = CFG.PLAYER.speed * (this.pu.dragon > 0 ? 1.4 : 1);
    if (this.swing) speed *= 0.5;
    if (this.parryT >= 0) speed *= 0.6;
    if (this.tongue) speed *= 0.6;
    if (this.aiming) speed *= 0.5;
    if (this.ultOn) speed *= CFG.ULT.moveMult;
    // Webs (ground patches + web shots) and latched leeches slow the frog
    if (this.z <= 0) speed *= g.webs.slowAt(this.x, this.y);
    if (this.webbedT > 0) speed *= CFG.WEB.shotSlow;
    speed *= g.leechSlow();
    let tvx = locked ? 0 : mx * speed, tvy = locked ? 0 : my * speed;
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
    const wasAir = this.z > 0;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= CFG.PLAYER.gravity * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; this.jumps = 0; }
    }
    if (wasAir && this.z === 0) { this.sq = -0.32; g.fx.burst(this.x, this.y, 3, 0xd8d2b0, 6, 90, 0.35, 2.5, 120); }
    this.sq *= Math.exp(-9 * dt);
    g.world.resolve(this);

    // Footstep dust
    if (this.moving && this.z <= 0 && Math.hypot(this.vx, this.vy) > 120) {
      this.dustT -= dt;
      if (this.dustT <= 0) { this.dustT = 0.17; g.fx.burst(this.x, this.y, 3, 0xd8d2b0, 2, 50, 0.35, 2, 40); }
    }

    // Facing: gun mode always faces the crosshair (third-person shooter style)
    const busy = this.swing || this.parryT >= 0 || this.tongue || this.faceHold > 0 || gunMode;
    if (busy) this.yaw = lerpAngle(this.yaw, aimYaw, 1 - Math.exp(-30 * dt));
    else if (this.moving) this.yaw = lerpAngle(this.yaw, Math.atan2(my, mx), 1 - Math.exp(-16 * dt));

    this._updateSwing(dt);
    this._updateTongue(dt);
    this._updateGear(dt);
    this.sync();
    this._trail();
  }

  // Glowing dots along the blade tip path during the fast part of a swing.
  _trail() {
    const sw = this.swing;
    if (!sw || this.weapon !== 'sword') { this.lastTip = null; return; }
    const u = sw.t / CFG.SWORD.dur[sw.step];
    if (u < 0.18 || u > 0.75) { this.lastTip = null; return; }
    this.root.updateMatrixWorld(true);
    this.tip.getWorldPosition(tipV);
    const col = this.counterT > 0 ? 0xffe066 : sw.step === 2 ? 0xbfe9ff : 0xffffff;
    const fx = this.g.fx;
    if (this.lastTip) for (let i = 1; i <= 3; i++) {
      const k = i / 3;
      fx.dot(lerp(this.lastTip.x, tipV.x, k), lerp(this.lastTip.y, tipV.y, k), lerp(this.lastTip.z, tipV.z, k), col, sw.step === 2 ? 3.6 : 2.6, 0.14);
    }
    this.lastTip = tipV.clone();
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
    sw.t += dt * (this.ultOn ? CFG.ULT.atkSpeed : 1);
    const dur = S.dur[sw.step];
    if (!sw.hit && sw.t >= dur * S.hitAt) {
      sw.hit = true;
      this.g.swordStrike({ team: 'player', x: this.x, y: this.y, yaw: sw.yaw, step: sw.step, src: this });
    }
    if (sw.t >= dur) { this.swing = null; this.comboT = 0; }
  }

  _startParry(aimYaw) {
    this.parryT = 0;
    this.parryCd = CFG.PARRY.cooldown / (this.ultOn ? CFG.ULT.atkSpeed : 1);
    this.swing = null;
    this.yaw = aimYaw;
    this.g.sfx.play('parry');
    this.g.recorder.event('p');
  }

  _shoot(aimYaw) {
    const g = this.g;
    if (this.shootCd > 0 || this.tongue) return;
    if (this.ammo <= 0) { g.sfx.play('empty'); this.shootCd = 0.3; g.hud.flash('OUT OF AMMO', '#ffcc66'); return; }
    const ult = this.ultOn;
    if (!ult) this.ammo--;
    this.shootCd = CFG.GUN.cooldown / (ult ? CFG.ULT.atkSpeed : 1);
    const aimed = this.aiming;
    // Aim assist toward the nearest target in the crosshair cone (tighter when aiming down sights).
    let ang = aimYaw, best = aimed ? CFG.GUN.aimCone : CFG.GUN.assistCone;
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
    this.faceHold = 0.3;
    const fire = this.pu.fire > 0;
    g.projectiles.spawn({
      x: this.x + Math.cos(ang) * 34, y: this.y + Math.sin(ang) * 34, z: 26,
      angle: ang, speed: CFG.GUN.speed * (aimed ? CFG.GUN.aimSpeedMult : 1),
      dmg: CFG.GUN.dmg * (fire ? 1.4 : 1) * (aimed ? CFG.GUN.aimMult : 1) * (ult ? CFG.ULT.mult : 1), team: 'player', radius: CFG.GUN.radius,
      color: fire ? 0xff7a1a : 0xffee66, owner: this, burn: fire,
    });
    g.stats.shots++;
    g.sfx.play('shoot');
    g.recorder.event('g', +ang.toFixed(3));
    g.fx.burst(this.x + Math.cos(ang) * 36, this.y + Math.sin(ang) * 36, 26, 0xffdd55, 4, 100, 0.15, 2);
    g.fx.addShake(aimed ? 1 : 2.5);
    this.muzzleT = 0.05;
  }

  _startTongue(aimYaw) {
    if (this.tongue || this.stamina < CFG.TONGUE.cost || this.swing || this.parryT >= 0) {
      if (!this.tongue && this.stamina < CFG.TONGUE.cost) this.g.hud.flash('Tongue tired...', '#ff9fb8');
      return;
    }
    this.stamina -= CFG.TONGUE.cost;
    this.staminaDelay = CFG.TONGUE.regenDelay;
    this.yaw = aimYaw;
    this.tongue = { t: 0, resolved: false, len: 0, target: null, yaw: aimYaw };
    this.g.sfx.play('tongue');
    this.g.recorder.event('t', +aimYaw.toFixed(3));
  }

  _updateTongue(dt) {
    const tg = this.tongue;
    if (!tg) { this.tongueMesh.visible = false; this.tongueTip.visible = false; return; }
    const T = CFG.TONGUE;
    const range = T.range * (this.pu.big > 0 ? 2 : 1) * (this.ultOn ? CFG.ULT.mult : 1);
    tg.t += dt;
    if (!tg.resolved && tg.t >= T.resolveAt) {
      tg.resolved = true;
      this._resolveTongue(tg, range);
    }
    const out = tg.t < T.resolveAt;
    const reach = tg.target ? Math.hypot(tg.target.x - this.x, tg.target.y - this.y) : range * 0.8;
    const k = out ? tg.t / T.resolveAt : 1 - (tg.t - T.resolveAt) / (T.dur - T.resolveAt);
    tg.len = Math.max(1, reach * clamp(k, 0, 1));
    // Springy wobble: the tongue whips side to side and pulses in thickness.
    const wob = Math.sin(tg.t * 46) * 0.16 * (1 - clamp(tg.t / T.dur, 0, 1));
    const ya = tg.yaw + wob;
    this.tongueMesh.visible = true;
    this.tongueMesh.scale.set(tg.len, 1 + 0.35 * Math.sin(tg.t * 60), 1 + 0.35 * Math.sin(tg.t * 60));
    this.tongueMesh.position.set(this.x + Math.cos(ya) * tg.len / 2, this.y + Math.sin(ya) * tg.len / 2, 22);
    this.tongueMesh.rotation.z = ya;
    this.tongueTip.visible = true;
    this.tongueTip.position.set(this.x + Math.cos(ya) * tg.len, this.y + Math.sin(ya) * tg.len, 22);
    if (tg.t >= T.dur) { this.tongue = null; this.tongueMesh.visible = false; this.tongueTip.visible = false; }
  }

  // Auto-targets the closest edible bug in a wide cone; broken (posture-stunned) bugs are always edible.
  _resolveTongue(tg, range) {
    const g = this.g;
    const maxEat = this.pu.big > 0 ? 3 : 1;
    const cands = [];
    for (const e of g.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d > range + e.radius) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      if (!e.latched && Math.abs(angDiff(tg.yaw, a)) > CFG.TONGUE.halfArc * (d < 90 ? 2 : 1)) continue;
      cands.push({ e, d, a });
    }
    cands.sort((a, b) => (Number(b.e.eatable) - Number(a.e.eatable)) || (a.d - b.d));
    let ate = 0;
    for (const { e, a } of cands) {
      if (ate >= maxEat) break;
      if (e.eatable) {
        if (!tg.target) { tg.target = e; tg.yaw = a; }
        if (e.broken > 0) this.stamina = 100;
        e.eaten();
        ate++;
      } else if (ate === 0) {
        const k = this.ultOn ? CFG.ULT.mult : 1;
        g.damageTarget(e, 5 * k, { team: 'player' });
        g.addPosture(e, 10 * k);
        e.stagger = Math.max(e.stagger, 0.3);
        tg.target = e; tg.yaw = a;
        g.hud.flash('Too big to eat - break its posture!', '#ff9fb8');
        break;
      }
    }
    // Boss / ghost: small damage, ghost gets slowed
    if (!ate && !tg.target) {
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
    const gunMode = this.weapon === 'gun';
    const p = this.pivot;
    p.visible = !gunMode;
    const sw = this.swing;
    if (sw) {
      // Anticipation (wind back past the start), fast swing with overshoot, then follow-through settle.
      const u = clamp(sw.t / CFG.SWORD.dur[sw.step], 0, 1);
      const s0 = sw.step === 2 ? -1.7 : sw.step === 0 ? 1.3 : -1.3;
      const s1 = sw.step === 2 ? 0.6 : -s0;
      let a;
      if (u < 0.18) a = lerp(s0 * 0.85, s0 * 1.25, ease(u / 0.18));
      else if (u < 0.55) a = lerp(s0 * 1.25, s1 * 1.18, ease((u - 0.18) / 0.37));
      else a = lerp(s1 * 1.18, s1 * 0.92, ease((u - 0.55) / 0.45));
      if (sw.step === 2) p.rotation.set(0, a, 0);
      else p.rotation.set(0, 0, a);
    } else if (this.parryT >= 0) {
      p.rotation.set(0, -0.9, 0);
    } else {
      p.rotation.set(0, 0.9, -0.5);
    }
    // Gun: raised in front in gun mode, holstered on the hip otherwise
    if (gunMode) {
      this.gun.position.set(10, -8, 26);
      this.gun.rotation.set(0, this.aiming ? -0.02 : 0.05, 0);
      this.gun.scale.setScalar(1.15);
    } else {
      this.gun.position.set(2, 16, 14);
      this.gun.rotation.set(0, 1.2, 0);
      this.gun.scale.setScalar(0.8);
    }
    this.muzzle.visible = this.muzzleT > 0;
    // Sword glows while the counter crit is ready
    const ready = this.counterT > 0;
    this.bladeGlow.visible = ready;
    if (ready) this.bladeGlow.material.opacity = 0.35 + 0.3 * Math.sin(this.t * 30);
    this.bladeMat.emissive.setHex(ready ? 0x997700 : 0x000000);
    this.parryDisc.visible = this.parryT >= 0 && !gunMode;
    if (this.parryT >= 0) {
      const perfect = this.parryT < this.perfectLen;
      this.parryDisc.material.opacity = perfect ? 0.9 : 0.4;
      this.parryDisc.material.color.setHex(perfect ? 0xffffff : 0x66ccff);
    }
  }

  sync() {
    const hop = this.moving && this.z <= 0 ? Math.abs(Math.sin(this.t * 12)) * 5 : 0;
    this.root.position.set(this.x, this.y, this.z + hop);
    this.root.rotation.z = this.yaw;
    // Squash and stretch: stretch on take-off / in the air, squash on landing.
    const stretch = Math.max(0.55, (this.z > 0 ? 1.06 : 1) * (1 + this.sq));
    this.root.scale.set(1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch), stretch);
    if (this.flashT > 0) {
      this.flashT -= 1 / 60;
      setFlash(this.flashList, 0xff3333);
    } else if (this.broken > 0) {
      setFlash(this.flashList, Math.floor(this.t * 10) % 2 ? 0xaa6600 : 0x331a00);
    } else if (this.counterT > 0) {
      setFlash(this.flashList, 0x225577);
    } else {
      setFlash(this.flashList, null);
    }
    if (this.iframes > 0) this.root.visible = Math.floor(this.t * 30) % 2 === 0 || this.dashT > 0;
    else this.root.visible = !this.dead;
  }
}
