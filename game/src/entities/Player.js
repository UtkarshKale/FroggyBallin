import * as THREE from 'three';
import { CFG } from '../config.js';
import { Settings } from '../core/Settings.js';
import { Cosmetics, buildHat, buildEyes } from './Cosmetics.js';
import { AnimController, applyPose, ZERO } from './AnimController.js';
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
    // Rig: root (position + yaw) -> body (offset + squash) -> pc (rotation pivot at mid height) -> gr (model + gear)
    const H = CFG.PLAYER.height;
    const holder = this.root.children[0];
    this.body = new THREE.Group(); this.pc = new THREE.Group(); this.gr = new THREE.Group();
    this.pc.position.z = H / 2; this.gr.position.z = -H / 2;
    this.root.add(this.body); this.body.add(this.pc); this.pc.add(this.gr); this.gr.add(holder);
    this._buildAnim();
    this._buildGear();
    this.applyCosmetics();
    game.world.scene.add(this.root);
    game.world.tag(this.root, 'actor');
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
    this.guardMat = stdMat(0xffc400);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(4, 18, 5), this.guardMat);
    guard.position.x = 10;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 4), stdMat(0x6d4c41));
    this.pivot.add(blade, guard, grip, this.bladeGlow, this.tip);
    this.gr.add(this.pivot);
    // Gun: held in the right hand at the end of an arm that swings toward the aim point.
    // Holstered on the left hip in sword mode; the sword goes on the back while the gun is out.
    this.arm = new THREE.Group();
    this.armMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, 20, 8), stdMat(0x3f9a44));
    this.armMesh.rotation.z = Math.PI / 2; this.armMesh.position.x = 9;
    this.arm.add(this.armMesh);
    this.gun = new THREE.Group();
    this.gunMat = stdMat(0x444a55, { metalness: 0.6 });
    const dark = stdMat(0x18181c, { metalness: 0.5 }), accent = stdMat(0xffd23f, { emissive: 0x443300 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 10), this.gunMat); body.position.set(10, 0, 1);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(24, 8.4, 2), accent); stripe.position.set(10, 0, 3);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 18, 10), dark); barrel.rotation.z = Math.PI / 2; barrel.position.set(30, 0, 2);
    const gGrip = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 13), dark); gGrip.position.set(1, 0, -7); gGrip.rotation.y = 0.28;
    const rear = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 3), dark); rear.position.set(-1, 0, 7.5);
    const front = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 3.5), new THREE.MeshBasicMaterial({ color: 0x66ffcc })); front.position.set(36, 0, 6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.9, 6, 14), new THREE.MeshBasicMaterial({ color: 0x66ddff })); ring.rotation.y = Math.PI / 2; ring.position.set(39.5, 0, 2);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    muzzle.position.set(44, 0, 2);
    muzzle.visible = false;
    this.muzzle = muzzle;
    this.muzzlePt = new THREE.Object3D(); this.muzzlePt.position.set(42, 0, 2);
    // ammo readout on the gun
    const ac = document.createElement('canvas'); ac.width = 128; ac.height = 48;
    this.ammoTex = { c: ac, ctx: ac.getContext('2d'), tex: new THREE.CanvasTexture(ac), key: '' };
    this.ammoTex.tex.colorSpace = THREE.SRGBColorSpace;
    this.ammoSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ammoTex.tex, transparent: true, depthTest: false }));
    this.ammoSpr.scale.set(20, 7.5, 1); this.ammoSpr.position.set(12, 0, 13); this.ammoSpr.renderOrder = 9;
    this.gun.add(body, stripe, barrel, gGrip, rear, front, ring, muzzle, this.muzzlePt, this.ammoSpr);
    this.gun.position.set(20, 0, 0);
    this.arm.add(this.gun);
    this.gr.add(this.arm);
    // Parry shield disc
    this.parryDisc = new THREE.Mesh(
      new THREE.CircleGeometry(30, 24),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.parryDisc.rotation.y = Math.PI / 2;
    this.parryDisc.position.set(36, 0, 26);
    this.parryDisc.visible = false;
    this.gr.add(this.parryDisc);
    // Power-up aura: a glowing ring at the feet in the colour of the active power-up
    this.aura = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.aura.visible = false;
    this.g.world.scene.add(this.aura);
    // Tongue
    this.tongueMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 5), new THREE.MeshBasicMaterial({ color: 0xff5f8a }));
    this.tongueMesh.visible = false;
    this.tongueTip = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7fa0 }));
    this.tongueTip.visible = false;
    this.g.world.scene.add(this.tongueMesh, this.tongueTip);
  }

  // Wardrobe: recolour the frog model in code, attach hat/eye overlays, colour sword, gun, tongue, effects.
  applyCosmetics(c = Cosmetics.worn()) {
    this.cos = c;
    const skin = Cosmetics.val(c, 'skin'), glow = Cosmetics.val(c, 'glow');
    for (const m of this.flashList) {
      // Shader tint: only the frog's green body pixels are recoloured (eyes, mouth and outlines keep their colour).
      if (!m.userData.skinU) {
        m.userData.skinU = { value: new THREE.Color(1, 1, 1) };
        m.userData.skinOn = { value: 0 };
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uSkin = m.userData.skinU; sh.uniforms.uSkinOn = m.userData.skinOn;
          sh.fragmentShader = 'uniform vec3 uSkin; uniform float uSkinOn;\n' + sh.fragmentShader.replace('#include <color_fragment>',
            '#include <color_fragment>\n{ vec3 c0 = diffuseColor.rgb; float gr = c0.g - max(c0.r, c0.b); float k = smoothstep(0.01, 0.08, gr) * uSkinOn; float l = dot(c0, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(c0, uSkin * (0.15 + l * 2.2), k); }');
        };
        m.needsUpdate = true;
      }
      m.userData.skinOn.value = skin == null ? 0 : 1;
      if (skin != null) m.userData.skinU.value.setHex(skin);
      m.userData.e0 = glow || 0;
      m.emissive.setHex(m.userData.e0);
    }
    if (this.hatG) this.gr.remove(this.hatG);
    if (this.eyeG) this.gr.remove(this.eyeG);
    this.hatG = buildHat(c.hat); this.eyeG = buildEyes(c.eyes);
    this.gr.add(this.hatG, this.eyeG);
    this.bladeMat.color.setHex(Cosmetics.val(c, 'blade'));
    this.guardMat.color.setHex(Cosmetics.val(c, 'hilt'));
    this.gunMat.color.setHex(Cosmetics.val(c, 'gun'));
    const tc = Cosmetics.val(c, 'tongue');
    this.tongueMesh.material.color.setHex(tc);
    this.tongueTip.material.color.setHex(new THREE.Color(tc).offsetHSL(0, 0, 0.12).getHex());
    this.trailColor = Cosmetics.val(c, 'trail');
    this.parryColor = Cosmetics.val(c, 'parry');
    this.splatColor = Cosmetics.val(c, 'splat');
  }

  _buildAnim() {
    const A = CFG.ANIM, TAU = Math.PI * 2;
    const P = (o) => ({ ...ZERO(), ...o });
    this.phase = 0;
    this.anim = new AnimController({
      // 2D locomotion blend tree: idle breathing <-> walk <-> run, leaning into the movement direction.
      loco: (t, c) => {
        const s = c.speed, f = c.fwd, sd = c.side;
        const hop = Math.abs(Math.sin(this.phase)) * lerp(A.walkHop, A.runHop, clamp(s - 0.3, 0, 1)) * clamp(s * 3, 0, 1) * (c.gun ? 0.5 : 1);
        const br = Math.sin(t * 2.2) * A.breath * (1 - clamp(s * 3, 0, 1));
        return P({ pz: hop, ry: f * A.leanFwd * clamp(s, 0, 1.2) + (c.gun ? -0.05 : 0), rx: -sd * A.leanSide * clamp(s, 0, 1.2), sz: 1 + br + hop * 0.01, sx: 1 - br * 0.5, sy: 1 - br * 0.5 });
      },
      air: (t, c) => (c.vz > 60 ? P({ sz: 1.12, sx: 0.93, sy: 0.93, ry: -0.06 }) : c.vz < -60 ? P({ sz: 1.05, ry: 0.1 }) : P({ sz: 1.02 })),
      dodge: () => { const k = 1 - this.dashT / CFG.DODGE.dur; return P({ ry: TAU * clamp(k, 0, 1), sz: 0.85, pz: Math.sin(clamp(k, 0, 1) * Math.PI) * 6 }); },
      attack: () => {
        const sw = this.swing;
        if (!sw) return P({});
        const u = clamp(sw.t / CFG.SWORD.dur[sw.step], 0, 1);
        const dir = sw.step === 1 ? -1 : 1;
        if (u < 0.18) { const k = ease(u / 0.18); return P({ ry: -0.12 * k, rz: 0.3 * dir * k, sz: 1 - 0.05 * k }); }
        if (u < 0.55) { const k = ease((u - 0.18) / 0.37); return P({ ry: lerp(-0.12, 0.24, k), rz: lerp(0.3, -0.35, k) * dir, px: 8 * k, sz: lerp(0.95, 1.04, k) }); }
        const k = ease((u - 0.55) / 0.45);
        return P({ ry: lerp(0.24, 0.04, k), rz: lerp(-0.35, -0.05, k) * dir, px: lerp(8, 2, k) });
      },
      parry: () => P({ ry: -0.12, px: -2, sz: 0.94, sx: 1.03, sy: 1.03 }),
      hit: (t) => { const k = Math.max(0, 1 - t / 0.25); return P({ ry: -A.flinch * k, px: -5 * k, rx: Math.sin(t * 40) * 0.08 * k }); },
      broken: (t) => P({ ry: 0.35, rx: Math.sin(t * 6) * 0.12, sz: 0.9, sx: 1.05, sy: 1.05 }),
      tongue: () => P({ ry: 0.18, px: 5, sx: 1.05 }),
      ult: (t) => { const k = clamp(t / 0.5, 0, 1); return k < 0.4 ? P({ sz: 1 - 0.25 * (k / 0.4), sx: 1.1, sy: 1.1 }) : P({ sz: 1.15 - 0.15 * k, rz: TAU * ease((k - 0.4) / 0.6), pz: 10 * Math.sin((k - 0.4) / 0.6 * Math.PI) }); },
      death: (t) => { const k = clamp(t / 0.5, 0, 1); return P({ ry: 1.45 * ease(k), pz: -4 * k, sz: 1 - 0.3 * k, sx: 1 + 0.15 * k, sy: 1 + 0.15 * k }); },
    });
    this.add = ZERO();
    this.hurtT = 0; this.gulpT = 0; this.ultPoseT = 0; this.ppT = 0; this.deadT = 0;
  }

  // Picks the animation state, blends it and applies it plus additive layers (squash, recoil, gulp, parry pop).
  _animate(dt) {
    const c = this._actx || (this._actx = {});
    const lv = Math.hypot(this.vx, this.vy), ca = Math.cos(this.yaw), sa = Math.sin(this.yaw);
    c.speed = lv / CFG.PLAYER.speed;
    c.fwd = lv > 1 ? (this.vx * ca + this.vy * sa) / lv : 0;
    c.side = lv > 1 ? (-this.vx * sa + this.vy * ca) / lv : 0;
    c.gun = this.weapon === 'gun';
    c.vz = this.vz;
    this.phase += dt * lerp(CFG.ANIM.walkFreq, CFG.ANIM.runFreq, clamp(c.speed - 0.3, 0, 1)) * (this.moving ? 1 : 0);
    let st = 'loco';
    if (this.dead) st = 'death';
    else if (this.broken > 0) st = 'broken';
    else if (this.dashT > 0) st = 'dodge';
    else if (this.hurtT > 0) st = 'hit';
    else if (this.swing || this.flurry) st = 'attack';
    else if (this.parryT >= 0) st = 'parry';
    else if (this.tongue) st = 'tongue';
    else if (this.ultPoseT > 0) st = 'ult';
    else if (this.z > 0.5) st = 'air';
    this.anim.set(st);
    const pose = this.anim.update(dt, c);
    // additive layers
    const a = this.add;
    const stretch = Math.max(0.55, 1 + this.sq) * (1 - 0.12 * Math.sin(Math.min(1, this.gulpT / 0.3) * Math.PI));
    const pop = 1 + 0.08 * Math.max(0, this.ppT / 0.2);
    a.px = 0; a.py = 0; a.pz = 0; a.rx = 0; a.rz = 0;
    a.ry = -this.gunKick * CFG.ANIM.recoil;
    a.sx = a.sy = pop / Math.sqrt(stretch); a.sz = pop * stretch;
    applyPose(this.body, { ...pose, rx: 0, ry: 0, rz: 0 }, { ...a, rx: 0, ry: 0, rz: 0 });
    this.pc.rotation.set(pose.rx + a.rx, pose.ry + a.ry, pose.rz + a.rz);
  }

  // Keeps the death animation running after the frog dies (gameplay update stops).
  animTick(dt) {
    if (!this.dead) return;
    this.deadT += dt;
    this._animate(dt);
    this.root.visible = this.deadT < 0.9;
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
    this.hurtT = 0; this.gulpT = 0; this.ultPoseT = 0; this.ppT = 0; this.deadT = 0;
    this.parryStreak = 0;
    this.streakT = 0;
    this.webbedT = 0;
    this.riposteT = 0;
    this.riposteSrc = null;
    this.jumps = 0;
    this.flashT = 0;
    this.moving = false;
    this.faceHold = 0;
    this.weapon = 'sword';
    this.equipT = 0;
    this.flurry = null;
    this.flurryCd = 0;
    this.gunKick = 0;
    this.armYaw = 0; this.armPitch = 0;
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
    this.pu = { fire: 0, dragon: 0, big: 0, shell: 0, over: 0, rico: 0, thorn: 0, mag: 0 };
    this.hitWall = false;
    this.root.visible = true;
    this.tongueMesh.visible = false;
    this.tongueTip.visible = false;
    this.sync();
  }

  get parryActive() { return this.parryT >= 0; }
  get perfectLen() { return CFG.PARRY.perfect * this.g.D.parry * (this.pu.over > 0 ? 2 : 1) * (this.g.bossUltOn('tightParry') ? 0.5 : 1); }
  get ultOn() { return this.g.playerUlt; }
  get blockLen() { return CFG.PARRY.block * this.g.D.parry * (this.pu.over > 0 ? 1.4 : 1); }

  // Returns 'hit' | 'block' | 'perfect' | 'dodged' | 'shell'
  takeHit(dmg, src, opts = {}) {
    if (this.dead) return 'dodged';
    const g = this.g, P = CFG.PLAYER_POSTURE;
    dmg *= g.D.dmg;
    if (src && src === g.boss && g.bossUltOn()) dmg *= CFG.ULT.bossDmg;
    if (opts.peril) return this._perilHit(dmg, src, opts);
    if (this.iframes > 0 || this.parryGrace > 0) return 'dodged';
    if (opts.parryable !== false && this.parryActive && this.broken <= 0) {
      if (this.parryT < this.perfectLen) {
        const big = !!(src && src.big);
        this.counterT = CFG.PARRY.counterWindow;
        this.posture = Math.max(0, this.posture - P.perfectRelief);
        this.stamina = Math.min(100, this.stamina + CFG.PARRY.staminaRefund);
        this.parryStreak = this.streakT > 0 ? this.parryStreak + 1 : 1;
        this.ppT = 0.2;
        this.streakT = CFG.PARRY.streakWindow;
        g.stats.perfectParries++;
        g.parryFx(this, src, opts.proj, big, this.parryStreak);
        // Parrying something big freezes the whole game for a beat.
        this.parryGrace = big ? 0.7 : 0.35;
        if (big && g.bigFreeze()) { g.slowmo(CFG.PARRY.bigSlow); g.hud.screenFlash(); }
        else { g.hitstop(CFG.PARRY.hitstop); g.slowmo(CFG.PARRY.slowmo); }
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
    if (this.pu.thorn > 0) dmg *= CFG.POWERUP.thornReduce;
    this._damage(dmg);
    this.hurtT = 0.22;
    this.parryStreak = 0;
    this.addPosture(dmg * P.hitMult);
    g.sfx.play('hurt');
    g.addStyle('hurt');
    g.fx.addShake(8);
    // Thorn Shell: melee attackers take a share of the hit back
    if (this.pu.thorn > 0 && src && src.team === 'bug' && !opts.proj && src.hp != null && !src.dead) {
      g.damageTarget(src, dmg * CFG.POWERUP.thornReflect / CFG.POWERUP.thornReduce, { team: 'player' });
      g.fx.burst(src.x, src.y, 25, 0x8fdc3a, 10, 220, 0.35, 2.5);
    }
    g.hud.hurt();
    return 'hit';
  }

  // Perilous attacks can't be parried. Dodge (i-frames) or jump (sweeps); 'counter' dodges open a riposte.
  _perilHit(dmg, src, opts) {
    const g = this.g, PR = CFG.PERIL;
    if (this.iframes > 0 || (opts.sweep && this.z > 20)) {
      if (this.perilT > 0) return 'dodged';
      this.perilT = 0.5;
      this.posture = Math.max(0, this.posture - PR.dodgeRelief);
      g.addStyle('perilDodge');
      if (opts.peril === 'counter') {
        this.riposteT = PR.riposte; this.riposteSrc = src;
        this.counterT = Math.max(this.counterT, PR.riposte);
        g.hud.ink('RIPOSTE', 'counter');
        g.sfx.play('riposte');
        g.slowmo(0.1);
      } else g.hud.flash('PERILOUS DODGE', '#ff5566');
      return 'dodged';
    }
    if (this.parryGrace > 0) return 'dodged';
    if (this.parryActive) g.hud.flash("CAN'T PARRY THAT!", '#ff3344');
    dmg *= PR.dmgMult;
    this._damage(dmg);
    this.hurtT = 0.25;
    this.parryStreak = 0;
    this.addPosture(dmg * PR.postureMult);
    this.parryGrace = 0.3; // one hit per perilous attack
    g.sfx.play('hurt');
    g.addStyle('hurt');
    g.fx.addShake(14);
    g.hud.hurt();
    return 'hit';
  }

  addPosture(a) {
    if (this.broken > 0 || this.dead) return;
    const P = CFG.PLAYER_POSTURE;
    this.posture += a * this.g.D.posture;
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
      this.g.fx.burst(this.x, this.y, 30, this.splatColor ?? 0x4caf50, 24, 300, 0.8, 4);
      this.g.fx.burst(this.x, this.y, 20, this.splatColor ?? 0x4caf50, 16, 220, 1.0, 6, 900);
      this.deadT = 0;
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
    this.hurtT = Math.max(0, this.hurtT - dt); this.gulpT = Math.max(0, this.gulpT - dt); this.ultPoseT = Math.max(0, this.ultPoseT - dt); this.ppT = Math.max(0, this.ppT - dt);
    this.webbedT = Math.max(0, this.webbedT - dt);
    this.riposteT = Math.max(0, this.riposteT - dt);
    this.perilT = Math.max(0, (this.perilT || 0) - dt);
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
    this.equipT = Math.max(0, this.equipT - dt);
    this.flurryCd = Math.max(0, this.flurryCd - dt);
    this.gunKick *= Math.exp(-14 * dt);
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
      if (want !== this.weapon && !this.flurry) {
        this.weapon = want;
        this.equipT = CFG.GUN.equipTime;
        this.swing = null; this.parryT = -1; this.slashBuf = 0;
        g.sfx.play('equip');
        g.hud.flash(want === 'gun' ? 'GUN EQUIPPED: LMB fire, hold RMB to aim' : 'SWORD EQUIPPED', '#fff');
      }
    }
    const gunMode = this.weapon === 'gun';
    this.aiming = gunMode && input.down(K.parry) && !locked;

    // Actions
    if (!locked) {
      if (!gunMode) {
        if (input.pressed(K.slash)) this.slashBuf = 0.22;
        // Shorter recovery: a buffered slash cancels the tail of the current swing.
        if (this.slashBuf > 0 && this.swing && this.swing.hit && this.swing.t >= CFG.SWORD.dur[this.swing.step] * CFG.SWORD.cancelAt) { this.swing = null; this.comboT = 0; }
        if (this.slashBuf > 0 && !this.swing && this.parryT < 0 && !this.tongue && this.dashT <= 0) this._startSwing(aimYaw);
        if (input.pressed(K.parry) && this.parryCd <= 0 && !this.tongue) this._startParry(aimYaw);
      } else if (input.down(K.slash) && this.equipT < CFG.GUN.equipTime * 0.5 && !this.flurry) {
        this._shoot(aimYaw);
      }
      // F: quick sword flurry from any weapon
      if (input.pressed(K.shoot) && this.flurryCd <= 0 && !this.flurry && !this.tongue) this._startFlurry(aimYaw);
      if (input.pressed(K.tongue)) this._startTongue(aimYaw);
      if (input.pressed(K.dodge) && this.dodgeCd <= 0 && this.dashT <= 0) {
        if (this.flurry) this._endFlurry(); // flurry cancels into dodge
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
    if (this.flurry) speed *= CFG.FLURRY.speedMult;
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
    const busy = this.swing || this.parryT >= 0 || this.tongue || this.faceHold > 0 || gunMode || this.flurry;
    // Gun mode: the body turns toward the free-aim point at a tunable rate while the legs keep strafing.
    const faceTo = gunMode && g.aimPoint ? Math.atan2(g.aimPoint.y - this.y, g.aimPoint.x - this.x) : aimYaw;
    if (busy) this.yaw = lerpAngle(this.yaw, faceTo, 1 - Math.exp(-(gunMode ? CFG.GUN.turnRate : 30) * dt));
    else if (this.moving) this.yaw = lerpAngle(this.yaw, Math.atan2(my, mx), 1 - Math.exp(-16 * dt));

    this._updateSwing(dt);
    this._updateFlurry(dt);
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
    const col = this.counterT > 0 ? 0xffe066 : this.trailColor ?? 0xffffff;
    const fx = this.g.fx;
    if (this.lastTip) for (let i = 1; i <= 3; i++) {
      const k = i / 3;
      fx.dot(lerp(this.lastTip.x, tipV.x, k), lerp(this.lastTip.y, tipV.y, k), lerp(this.lastTip.z, tipV.z, k), col, sw.step === 2 ? 3.6 : 2.6, 0.14);
    }
    this.lastTip = tipV.clone();
  }

  _startSwing(aimYaw) {
    const S = CFG.SWORD;
    // Riposte: snap toward the attacker and lunge in for the counter slash.
    const rs = this.riposteT > 0 ? this.riposteSrc : null;
    if (rs && !rs.dead) {
      const a = Math.atan2(rs.y - this.y, rs.x - this.x), d = Math.hypot(rs.x - this.x, rs.y - this.y);
      aimYaw = a;
      const step = Math.max(0, Math.min(CFG.PERIL.riposteLunge, d - (rs.radius || 20) - 30));
      this.x += Math.cos(a) * step; this.y += Math.sin(a) * step;
      this.g.fx.burst(this.x, this.y, 20, 0xff9a1a, 8, 160, 0.3, 2);
    }
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

  _startFlurry(aimYaw) {
    this.flurry = { n: 0, t: 0, prev: this.weapon, yaw: aimYaw };
    this.weapon = 'sword';
    this.swing = null; this.parryT = -1;
    this.yaw = aimYaw;
    this.g.sfx.play('slash');
  }

  _updateFlurry(dt) {
    const f = this.flurry;
    if (!f) return;
    const F = CFG.FLURRY;
    f.t += dt * (this.ultOn ? CFG.ULT.atkSpeed : 1);
    if (f.n < F.hits && f.t >= f.n * F.gap) {
      const step = f.n % 2;
      this.swing = { step, t: CFG.SWORD.dur[step] * 0.2, hit: true, yaw: this.yaw, flurry: true };
      this.g.swordStrike({ team: 'player', x: this.x, y: this.y, yaw: this.yaw, step, src: this, mult: F.dmg });
      this.g.recorder.event('s', step);
      if (f.n > 0) this.g.sfx.play('slash');
      f.n++;
      if (f.n >= F.hits) { f.end = f.t + F.gap; }
    }
    if (f.end && f.t >= f.end) this._endFlurry();
  }

  _endFlurry() {
    const f = this.flurry;
    if (!f) return;
    this.flurry = null;
    this.swing = null;
    this.flurryCd = CFG.FLURRY.cooldown;
    if (f.prev === 'gun') { this.weapon = 'gun'; this.equipT = CFG.GUN.equipTime * 0.6; }
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
    // Free aim: from the muzzle toward the point under the crosshair (Game.aimPoint), with aim assist on top.
    this.root.updateMatrixWorld(true);
    const mz = this.muzzlePt.getWorldPosition(new THREE.Vector3());
    const ap = g.aimPoint;
    if (ap) aimYaw = Math.atan2(ap.y - mz.y, ap.x - mz.x);
    let ang = aimYaw, best = (aimed ? CFG.GUN.aimCone : CFG.GUN.assistCone) * Settings.get('aimAssist');
    const targets = [...g.enemies];
    if (g.boss && g.boss.active) targets.push(g.boss);
    if (g.ghost && !g.ghost.dead) targets.push(g.ghost);
    for (const t of targets) {
      if (t.dead) continue;
      const a = Math.atan2(t.y - this.y, t.x - this.x);
      const d = Math.abs(angDiff(aimYaw, a));
      if (d < best) { best = d; ang = a; }
    }
    ang += (Math.random() - 0.5) * 2 * (aimed ? CFG.GUN.aimSpread : CFG.GUN.spread);
    this.faceHold = 0.3;
    const fire = this.pu.fire > 0;
    const range = ap ? Math.hypot(ap.x - mz.x, ap.y - mz.y) : 400;
    g.fx.tracer(mz.x, mz.y, mz.z, mz.x + Math.cos(ang) * Math.min(range, 520), mz.y + Math.sin(ang) * Math.min(range, 520), CFG.GUN.bulletZ, fire ? 0xff9a3a : 0xffee88);
    // recoil + shell sparks ejected to the right
    this.gunKick = CFG.GUN.recoil;
    g.fx.burst(mz.x - Math.cos(ang) * 30 + Math.sin(ang) * 6, mz.y - Math.sin(ang) * 30 - Math.cos(ang) * 6, mz.z, 0xffcc55, 3, 90, 0.35, 1.4, 500);
    g.projectiles.spawn({
      x: mz.x, y: mz.y, z: CFG.GUN.bulletZ,
      angle: ang, speed: CFG.GUN.speed * (aimed ? CFG.GUN.aimSpeedMult : 1),
      dmg: CFG.GUN.dmg * (fire ? 1.4 : 1) * (aimed ? CFG.GUN.aimMult : 1) * (ult ? CFG.ULT.mult : 1), team: 'player', radius: CFG.GUN.radius,
      color: fire ? 0xff7a1a : this.pu.rico > 0 ? 0x55ffaa : 0xffee66, owner: this, burn: fire, bounces: this.pu.rico > 0 ? CFG.POWERUP.ricochet : 0,
    });
    g.stats.shots++;
    g.sfx.play('shoot');
    g.recorder.event('g', +ang.toFixed(3));
    g.fx.burst(mz.x, mz.y, mz.z, 0xffdd55, 5, 120, 0.15, 2);
    g.fx.addShake(aimed ? 1 : 2.5);
    this.muzzleT = 0.06;
    if (this.ammo <= 3 && !ult) g.hud.flash(this.ammo ? `LOW AMMO: ${this.ammo}` : 'OUT OF AMMO', '#ffcc66');
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
    const range = T.range * (this.pu.big > 0 ? 2 : 1) * (this.pu.mag > 0 ? CFG.POWERUP.magnetTongue : 1) * (this.ultOn ? CFG.ULT.mult : 1);
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
        if (this.pu.mag > 0 && e.knock && !e.isBoss) e.knock(Math.atan2(this.y - e.y, this.x - e.x), 90); // magnet yank
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
    p.visible = true;
    const eq = this.equipT > 0 ? 1 - this.equipT / CFG.GUN.equipTime : 1; // 0 -> 1 while drawing
    // sword: in the right hand in sword mode, on the back while the gun is out
    if (gunMode) p.position.set(-14, 6, 30); else p.position.set(6, -16, 24);
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
    } else if (gunMode) {
      p.rotation.set(0.5, 2.2, 0.4); // slung across the back
    } else {
      p.rotation.set(0, 0.9, -0.5 + (1 - eq) * 6.28); // draw flourish
    }
    // Gun: raised in front in gun mode, holstered on the hip otherwise
    const A = this.arm;
    if (gunMode) {
      // hold pose: arm from the right shoulder, swinging toward the aim point (yaw + pitch), recoil kick back
      const ap = this.g.aimPoint;
      let wy = 0, wp = 0;
      if (ap) {
        wy = clamp(angDiff(this.yaw, Math.atan2(ap.y - this.y, ap.x - this.x)), -0.9, 0.9);
        wp = clamp(Math.atan2((ap.z ?? CFG.GUN.bulletZ) - 30, Math.max(40, Math.hypot(ap.x - this.x, ap.y - this.y))), -0.5, 0.6);
      }
      const k = 1 - Math.exp(-CFG.GUN.armTurn * dt);
      this.armYaw += (wy - this.armYaw) * k; this.armPitch += (wp - this.armPitch) * k;
      A.position.set(4 - this.gunKick * 0.4, -15, 28);
      A.rotation.set((1 - eq) * 6.28, -this.armPitch, this.armYaw);
      A.scale.setScalar(1);
      this.armMesh.visible = true;
      this.gun.position.set(20 - this.gunKick, 0, 0);
      this.gun.rotation.set(0, -this.gunKick * 0.03, 0);
      this.gun.scale.setScalar(1.25);
    } else {
      A.position.set(-2, 15, 14);
      A.rotation.set(0, 1.25, 0);
      this.armMesh.visible = false;
      this.gun.position.set(0, 0, 0);
      this.gun.rotation.set(0, 0, 0);
      this.gun.scale.setScalar(0.85);
    }
    this.ammoSpr.visible = gunMode;
    const ak = `${this.ammo}|${this.ultOn}`;
    if (gunMode && this.ammoTex.key !== ak) {
      const t = this.ammoTex, c = t.ctx; t.key = ak;
      c.clearRect(0, 0, 128, 48);
      c.font = "900 34px Consolas, 'Courier New', monospace"; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = '#000';
      const s = this.ultOn ? 'INF' : String(this.ammo);
      c.strokeText(s, 64, 26); c.fillStyle = this.ammo <= 3 && !this.ultOn ? '#ff5a5a' : '#ffd23f'; c.fillText(s, 64, 26);
      t.tex.needsUpdate = true;
    }
    this.muzzle.visible = this.muzzleT > 0;
    // aura colour = first active power-up
    const AU = [['fire', 0xff9922], ['dragon', 0x44ddff], ['over', 0xff5555], ['rico', 0x55ffaa], ['thorn', 0x8fdc3a], ['mag', 0xff66ff], ['big', 0xff6688]];
    const on = AU.find(([k]) => this.pu[k] > 0) || (this.pu.shell > 0 ? ['shell', 0x8899ff] : null);
    this.aura.visible = !!on && !this.dead;
    if (on) {
      this.aura.material.color.setHex(on[1]);
      this.aura.position.set(this.x, this.y, 2);
      this.aura.scale.setScalar(34 + Math.sin(this.t * 6) * 3);
      this.aura.material.opacity = 0.45 + 0.2 * Math.sin(this.t * 9);
    }
    // Sword glows while the counter crit is ready
    const ready = this.counterT > 0;
    this.bladeGlow.visible = ready;
    if (ready) this.bladeGlow.material.opacity = 0.35 + 0.3 * Math.sin(this.t * 30);
    this.bladeMat.emissive.setHex(ready ? 0x997700 : 0x000000);
    this.parryDisc.visible = this.parryT >= 0 && !gunMode;
    if (this.parryT >= 0) {
      const perfect = this.parryT < this.perfectLen;
      this.parryDisc.material.opacity = perfect ? 0.9 : 0.4;
      this.parryDisc.material.color.setHex(perfect ? this.parryColor ?? 0xffffff : 0x66ccff);
    }
  }

  sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.z = this.yaw;
    this.root.scale.set(1, 1, 1);
    if (this._lastSyncT !== this.t) { this._animate(Math.min(0.05, this.t - (this._lastSyncT ?? this.t))); this._lastSyncT = this.t; }
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
    if (this.iframes > 0 && this.dashT <= 0) this.root.visible = Math.floor(this.t * 30) % 2 === 0;
    else this.root.visible = !this.dead || this.deadT < 0.9;
  }
}
