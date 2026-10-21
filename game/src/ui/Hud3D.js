import * as THREE from 'three';
import { CFG } from '../config.js';

// Diegetic HUD: holographic arcs around Tode (HP / posture / stamina / ult), ammo readout by the gun,
// a floating boss bar, floating rank + combo text and in-world damage numbers. The DOM HUD keeps only
// timer, objective, toasts and banners while this is on (Settings -> HUD mode).
const ARC_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const ARC_FS = `
  varying vec2 vUv;
  uniform float hp, posture, stamina, ult, broken, time, lowHp;
  float band(vec2 p, float r0, float r1, float a0, float a1, float f, out float fill) {
    float r = length(p);
    float a = atan(p.y, p.x);
    float t = (a - a0) / (a1 - a0);
    float inside = step(r0, r) * step(r, r1) * step(0.0, t) * step(t, 1.0);
    fill = step(t, f);
    return inside;
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    vec4 col = vec4(0.0);
    float f;
    // left side (bottom -> top): HP outer, stamina inner. right side: posture outer, ult inner.
    float m = band(vec2(-p.x, p.y), 0.80, 0.90, -1.15, 1.15, hp, f);
    if (m > 0.0) { vec3 c = mix(vec3(1.0, 0.15, 0.2), vec3(0.35, 1.0, 0.45), smoothstep(0.25, 0.6, hp)); col = vec4(f > 0.5 ? c : c * 0.18, f > 0.5 ? 0.95 : 0.45); if (lowHp > 0.5 && f > 0.5) col.rgb *= 0.7 + 0.3 * sin(time * 12.0); }
    m = band(vec2(-p.x, p.y), 0.70, 0.76, -0.95, 0.95, stamina, f);
    if (m > 0.0) col = vec4(f > 0.5 ? vec3(1.0, 0.5, 0.7) : vec3(0.2, 0.1, 0.14), f > 0.5 ? 0.85 : 0.35);
    m = band(p, 0.80, 0.90, -1.15, 1.15, posture, f);
    if (m > 0.0) { vec3 c = broken > 0.5 ? vec3(1.0, 0.45, 0.1) : mix(vec3(0.95), vec3(1.0, 0.75, 0.3), smoothstep(0.6, 0.9, posture)); col = vec4(f > 0.5 ? c : vec3(0.15), f > 0.5 ? 0.95 : 0.4); }
    m = band(p, 0.70, 0.76, -0.95, 0.95, ult, f);
    if (m > 0.0) { vec3 c = ult >= 0.999 ? vec3(0.4, 1.0, 0.8) * (0.75 + 0.25 * sin(time * 10.0)) : vec3(0.25, 0.85, 0.7); col = vec4(f > 0.5 ? c : vec3(0.08, 0.18, 0.15), f > 0.5 ? 0.9 : 0.35); }
    if (col.a <= 0.0) discard;
    gl_FragColor = col;
  }`;

function textSprite(w, h, sw, sh) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
  spr.scale.set(sw, sh, 1);
  spr.renderOrder = 12;
  return { spr, c, ctx: c.getContext('2d'), tex, key: '' };
}

export class Hud3D {
  constructor(game) {
    this.g = game;
    const scene = game.world.scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.arcMat = new THREE.ShaderMaterial({
      uniforms: { hp: { value: 1 }, posture: { value: 0 }, stamina: { value: 1 }, ult: { value: 0 }, broken: { value: 0 }, time: { value: 0 }, lowHp: { value: 0 } },
      vertexShader: ARC_VS, fragmentShader: ARC_FS, transparent: true, depthTest: false, depthWrite: false,
    });
    this.arcs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.arcMat);
    this.arcs.renderOrder = 11;
    this.root.add(this.arcs);
    this.ammo = textSprite(256, 64, 60, 15);
    this.rank = textSprite(256, 160, 70, 44);
    this.boss = textSprite(512, 96, 240, 45);
    this.root.add(this.ammo.spr, this.rank.spr, this.boss.spr);
    this.nums = [];
    for (let i = 0; i < 20; i++) { const n = textSprite(160, 80, 34, 17); n.t = 0; n.spr.visible = false; this.root.add(n.spr); this.nums.push(n); }
    this.ni = 0;
    this.on = false;
    this.setOn(false);
  }

  setOn(v) { this.on = v; this.root.visible = v; }

  dmgNum(x, y, z, amount, kind) {
    const n = this.nums[this.ni++ % this.nums.length];
    const c = n.ctx;
    c.clearRect(0, 0, 160, 80);
    c.font = `italic 900 ${kind === 'big' ? 60 : kind === 'crit' ? 52 : 44}px 'Arial Black', Impact, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 9; c.strokeStyle = '#000';
    const s = String(Math.round(amount));
    c.save(); c.translate(80, 42); c.rotate((Math.random() - 0.5) * 0.4);
    c.strokeText(s, 0, 0);
    c.fillStyle = kind === 'big' ? '#ff3344' : kind === 'crit' ? '#ffd23f' : '#fff';
    c.fillText(s, 0, 0);
    c.restore();
    n.tex.needsUpdate = true;
    n.spr.visible = true;
    n.t = 0.75; n.x = x + (Math.random() - 0.5) * 20; n.y = y; n.z = z;
    n.k = kind === 'big' ? 1.5 : kind === 'crit' ? 1.25 : 1;
  }

  _draw(s, key, fn) { if (s.key === key) return; s.key = key; s.ctx.clearRect(0, 0, s.c.width, s.c.height); fn(s.ctx, s.c.width, s.c.height); s.tex.needsUpdate = true; }

  update(dt) {
    if (!this.on) return;
    const g = this.g, p = g.player, cam = g.world.camera;
    const vis = !p.dead && (g.state === 'PLAYING' || g.state === 'PAUSED');
    this.arcs.visible = vis;
    // arcs halo around the frog, always facing the camera
    this.arcs.position.set(p.x, p.y, p.z + 26);
    this.arcs.quaternion.copy(cam.quaternion);
    this.arcs.scale.setScalar(150);
    const u = this.arcMat.uniforms;
    u.hp.value = Math.max(0, p.hp / CFG.PLAYER.hp);
    u.posture.value = p.broken > 0 ? 1 : Math.min(1, p.posture / CFG.PLAYER_POSTURE.max);
    u.broken.value = p.broken > 0 ? 1 : 0;
    u.stamina.value = p.stamina / 100;
    u.ult.value = g.ult ? g.ult.meter / 100 : 0;
    u.lowHp.value = p.hp < 30 ? 1 : 0;
    u.time.value += dt;
    // right vector of the camera, for side-placed readouts
    const rx = cam.matrixWorld.elements[0], ry = cam.matrixWorld.elements[1];
    // ammo by the gun / right hand
    this.ammo.spr.visible = vis;
    this.ammo.spr.position.set(p.x + rx * 58, p.y + ry * 58, p.z + 30);
    this._draw(this.ammo, `${p.ammo}|${p.weapon}|${g.playerUlt}`, (c, W, H) => {
      c.font = "900 40px Consolas, 'Courier New', monospace"; c.textBaseline = 'middle';
      c.lineWidth = 7; c.strokeStyle = '#000';
      const t = g.playerUlt ? 'AMMO INF' : `AMMO ${p.ammo}/${CFG.PLAYER.maxAmmo}`;
      c.strokeText(t, 6, H / 2); c.fillStyle = p.weapon === 'gun' ? '#ffd23f' : '#bbb'; c.fillText(t, 6, H / 2);
    });
    // rank + combo floating on the left of the frog
    const st = g.style;
    this.rank.spr.visible = vis && st && (st.pts > 0 || st.combo > 1);
    if (st) {
      const R = CFG.STYLE.ranks[st.rank];
      this.rank.spr.position.set(p.x - rx * 78, p.y - ry * 78, p.z + 70);
      this._draw(this.rank, `${R[1]}|${st.combo}`, (c, W, H) => {
        c.textBaseline = 'middle';
        c.font = "italic 900 110px 'Arial Black', Impact, sans-serif";
        c.lineWidth = 12; c.strokeStyle = '#000'; c.strokeText(R[1], 20, 70);
        c.fillStyle = R[2]; c.fillText(R[1], 20, 70);
        if (st.combo > 1) { c.font = "italic 900 34px 'Arial Black', Impact, sans-serif"; c.lineWidth = 7; c.strokeText(`x${st.combo}`, 110, 112); c.fillStyle = '#ffd23f'; c.fillText(`x${st.combo}`, 110, 112); }
      });
    }
    // boss bar above the boss
    const b = g.boss;
    const bv = vis && b && b.active && !b.dead;
    this.boss.spr.visible = !!bv;
    if (bv) {
      this.boss.spr.position.set(b.x, b.y, (b.z || 0) + b.radius * 2 + 80);
      const hpF = Math.max(0, b.hp / b.maxHp), poF = b.stunned ? 1 : b.posture / b.postureMax;
      this._draw(this.boss, `${Math.round(hpF * 200)}|${Math.round(poF * 100)}|${b.stunned}`, (c, W, H) => {
        c.fillStyle = 'rgba(0,0,0,.75)'; c.beginPath(); c.moveTo(20, 0); c.lineTo(W, 0); c.lineTo(W - 20, H); c.lineTo(0, H); c.fill();
        c.font = "italic 900 26px 'Arial Black', Impact, sans-serif"; c.fillStyle = '#fff'; c.textBaseline = 'top'; c.fillText(b.name, 30, 6);
        c.fillStyle = '#3a0a0e'; c.fillRect(30, 42, W - 60, 20); c.fillStyle = '#ff3344'; c.fillRect(30, 42, (W - 60) * hpF, 20);
        c.fillStyle = '#222'; c.fillRect(30, 70, W - 60, 12);
        const half = (W - 60) / 2 * Math.min(1, poF);
        c.fillStyle = b.stunned ? '#ff7a22' : poF > 0.7 ? '#ffcc66' : '#e8e8e8';
        c.fillRect(W / 2 - half, 70, half * 2, 12);
      });
    }
    for (const n of this.nums) {
      if (n.t <= 0) { n.spr.visible = false; continue; }
      n.t -= dt;
      const k = 1 - n.t / 0.75;
      n.spr.position.set(n.x, n.y, n.z + 40 * k);
      const s = (k < 0.15 ? 1.6 - k * 4 : 1) * n.k;
      n.spr.scale.set(34 * s, 17 * s, 1);
      n.spr.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
  }
}
