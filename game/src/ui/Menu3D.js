import * as THREE from 'three';
import { Panel3D } from './Panel3D.js';
import { LEVELS } from '../levels/levels.js';
import { DIFFICULTY } from '../config.js';
import { Storage } from '../core/Storage.js';
import { Settings } from '../core/Settings.js';
import { fmtTime } from '../core/math.js';

// The menu as a 3D diorama: Tode on a lily pad at dusk, fireflies, and the options as in-world neon panels.
// The camera glides between "rooms". Mouse hover = raycast; click / Enter activates; arrows / WASD navigate;
// Left/Right change option values; Esc / Backspace goes back.
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Menu3D {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.rig = new THREE.Group();
    this.panels = [];
    this.sel = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.mouse = new THREE.Vector2(0, 0);
    this.hasMouse = false;
    this.ray = new THREE.Raycaster();
    this.t = 0;
    this.orbit = 0;
    this.extraRooms = {}; // name -> () => room   (wardrobe etc. register here)
    this._buildDiorama();
    const cv = game.canvas;
    cv.addEventListener('mousemove', (e) => {
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.hasMouse = true;
      if (this.active) this._pick();
    });
    cv.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      this._pick();
      const p = this.panels[this.sel];
      if (p && p.hover && p.interactive) this._activate(p, e.button === 2 ? -1 : 1);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active || this.capture) return;
      const k = e.code;
      if (k === 'ArrowDown' || k === 'KeyS') this._move(1);
      else if (k === 'ArrowUp' || k === 'KeyW') this._move(-1);
      else if (k === 'ArrowLeft' || k === 'KeyA') { const p = this.panels[this.sel]; if (p && p.item.prev) { p.item.prev(); this.g.sfx.play('ui'); } }
      else if (k === 'ArrowRight' || k === 'KeyD') { const p = this.panels[this.sel]; if (p && p.item.next) { p.item.next(); this.g.sfx.play('ui'); } }
      else if (k === 'Enter' || k === 'Space') { const p = this.panels[this.sel]; if (p && p.interactive) this._activate(p, 1); }
      else if ((k === 'Escape' || k === 'Backspace') && this.roomName !== 'main' && this.roomName !== 'stats') this.go('main');
    });
  }

  _buildDiorama() {
    const d = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(70, 72, 5, 40, 1, false, 0.35, Math.PI * 2 - 0.7), new THREE.MeshStandardMaterial({ color: 0x3f9a44, roughness: 0.8 }));
    pad.rotation.x = Math.PI / 2; pad.position.z = -1;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1400, 48), new THREE.MeshStandardMaterial({ color: 0x0b2232, roughness: 0.2, metalness: 0.3 }));
    water.position.z = -3;
    const pads = [];
    for (let i = 0; i < 9; i++) {
      const s = 25 + Math.random() * 30, a = Math.random() * 6.28, r = 160 + Math.random() * 380;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(s, s, 3, 24, 1, false, 0.3, 5.6), pad.material);
      m.rotation.x = Math.PI / 2; m.rotation.y = Math.random() * 6; m.position.set(Math.cos(a) * r, Math.sin(a) * r, -1.5);
      pads.push(m);
    }
    // reeds
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * 6.28, r = 260 + Math.random() * 500;
      const h = 40 + Math.random() * 70;
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, h, 5), new THREE.MeshStandardMaterial({ color: 0x2e4d2a }));
      reed.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3; reed.position.set(Math.cos(a) * r, Math.sin(a) * r, h / 2 - 2);
      d.add(reed);
    }
    this.flies = [];
    const fm = new THREE.MeshBasicMaterial({ color: 0xffe27a, fog: false });
    for (let i = 0; i < 46; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 4), fm);
      f.userData = { a: Math.random() * 6.28, r: 60 + Math.random() * 420, z: 20 + Math.random() * 160, s: 0.2 + Math.random() * 0.5, p: Math.random() * 6 };
      d.add(f); this.flies.push(f);
    }
    this.lamp = new THREE.PointLight(0xffb070, 2.2, 600, 1.2);
    this.lamp.position.set(80, -40, 120);
    this.moon = new THREE.DirectionalLight(0x8899ff, 0.8);
    this.moon.position.set(-300, 200, 500);
    d.add(pad, water, ...pads, this.lamp, this.moon);
    this.diorama = d;
    this.rig.add(d);
  }

  // ------------------------------------------------------------------ rooms
  rooms() {
    const g = this.g;
    const back = { kind: 'button', label: 'BACK', act: () => this.go('main') };
    return {
      main: () => ({
        cam: V(440, -30, 140), look: V(40, -95, 108),
        list: { at: V(120, -150, 190), w: 122, h: 25, gap: 29 },
        title: { label: 'FROGGY BALLIN', at: V(118, -150, 228), w: 200, h: 40 },
        items: [
          { kind: 'button', label: 'PLAY', sub: 'Time Loop: pick a level', act: () => this.go('levels') },
          { kind: 'button', label: 'BOSS RUSH', act: () => g.screens.wipe(() => g.startRun('bossrush')) },
          { kind: 'button', label: 'SURVIVAL', act: () => g.screens.wipe(() => g.startRun('survival')) },
          { kind: 'option', label: 'DIFFICULTY', value: () => g.D.label, act: () => this.go('difficulty'), next: () => this._cycleDiff(1), prev: () => this._cycleDiff(-1) },
          { kind: 'button', label: 'WARDROBE', act: () => this.go('wardrobe') },
          { kind: 'button', label: 'SETTINGS', act: () => this.go('settings') },
          { kind: 'button', label: 'HOW TO PLAY', act: () => this.go('howto') },
          { kind: 'button', label: 'CREDITS', act: () => this.go('credits') },
        ],
      }),
      levels: () => ({
        cam: V(430, -628, 140), look: V(40, -628, 118),
        grid: { at: V(110, -700, 175), w: 135, h: 46, cols: 2, dx: 145, dz: 54 },
        items: [
          ...LEVELS.map((l) => {
            const pb = Storage.get(g.sk('pb', l.id), null);
            return { kind: 'button', label: l.name.toUpperCase(), sub: `${l.blurb}  ${pb ? `Best ${fmtTime(pb.best)} (${pb.wins} wins)` : 'No record yet'}`, act: () => g.screens.wipe(() => g.startRun('timeloop', l.id)) };
          }),
          back,
        ],
      }),
      difficulty: () => ({
        cam: V(430, 530, 130), look: V(40, 530, 105),
        list: { at: V(120, 450, 172), w: 112, h: 26, gap: 31 },
        card: { at: V(110, 595, 122), w: 150, h: 110, item: { kind: 'card', label: g.D.label, body: g.D.desc } },
        items: [
          ...Object.entries(DIFFICULTY).map(([k, v]) => ({ kind: 'option', label: v.label, value: () => (g.diffKey === k ? 'ON' : ''), act: () => { g.setDifficulty(k); this.go('difficulty', true); } })),
          back,
        ],
      }),
      settings: () => this.settingsRoom(back),
      howto: () => ({
        cam: V(440, -420, 420), look: V(40, -420, 398),
        card: { at: V(100, -420, 420), w: 270, h: 200, item: { kind: 'card', label: 'HOW TO PLAY', body: HOWTO } },
        list: { at: V(100, -420, 300), w: 90, h: 24, gap: 30 },
        items: [back],
      }),
      credits: () => ({
        cam: V(440, 420, 420), look: V(40, 420, 398),
        card: { at: V(100, 420, 420), w: 260, h: 160, item: { kind: 'card', label: 'CREDITS', body: CREDITS } },
        list: { at: V(100, 420, 318), w: 90, h: 24, gap: 30 },
        items: [back],
      }),
      ...this.extraRooms,
    };
  }

  settingsRoom(back) {
    const g = this.g;
    const tog = (k, label, after) => ({ kind: 'option', label, value: () => (Settings.get(k) ? 'ON' : 'OFF'), act: () => { Settings.set(k, !Settings.get(k)); after && after(); }, next: () => { Settings.set(k, !Settings.get(k)); after && after(); }, prev: () => { Settings.set(k, !Settings.get(k)); after && after(); } });
    const num = (k, label, step, lo, hi, fmt = (v) => v, after) => ({ kind: 'option', label, value: () => fmt(Settings.get(k)),
      next: () => { Settings.set(k, Math.min(hi, +(Settings.get(k) + step).toFixed(2))); after && after(); }, prev: () => { Settings.set(k, Math.max(lo, +(Settings.get(k) - step).toFixed(2))); after && after(); } });
    const apply = () => g.applySettings();
    return {
      cam: V(470, -75, 420), look: V(40, -75, 410),
      grid: { at: V(110, -150, 500), w: 140, h: 24, cols: 2, dx: 150, dz: 29 },
      items: [
        tog('ui3d', '3D MENUS', () => { apply(); if (!Settings.get('ui3d')) g.toMenu(); }),
        tog('hud3d', 'HUD: IN-WORLD', apply),
        tog('crt', 'CRT OVERLAY', apply),
        tog('reduce', 'REDUCE FLASHING', apply),
        tog('dmgNums', 'DAMAGE NUMBERS', apply),
        tog('invertY', 'INVERT Y', apply),
        num('sens', 'MOUSE SENS', 0.1, 0.2, 3, (v) => v.toFixed(1)),
        num('fov', 'FOV', 5, 40, 90, (v) => v, apply),
        num('camDist', 'CAMERA DIST', 20, 180, 420, (v) => v, apply),
        num('aimAssist', 'AIM ASSIST', 0.25, 0, 2, (v) => v.toFixed(2)),
        num('master', 'MASTER VOL', 0.1, 0, 1, (v) => Math.round(v * 100) + '%', apply),
        num('sfx', 'SFX VOL', 0.1, 0, 1, (v) => Math.round(v * 100) + '%', apply),
        num('music', 'MUSIC VOL', 0.1, 0, 1, (v) => Math.round(v * 100) + '%', apply),
        ...(this.extraSettings ? this.extraSettings() : []),
        back,
      ],
    };
  }

  _cycleDiff(d) {
    const ks = Object.keys(DIFFICULTY);
    const i = (ks.indexOf(this.g.diffKey) + d + ks.length) % ks.length;
    this.g.setDifficulty(ks[i]);
  }

  // ------------------------------------------------------------------ lifecycle
  open(room = 'main') {
    const g = this.g, w = g.world;
    this.active = true;
    const p = g.player;
    this.rig.position.set(p.x, p.y, 0);
    this.rig.rotation.z = this.rigYaw = -2.35;
    if (!this.rig.parent) w.scene.add(this.rig);
    this.diorama.visible = true;
    w.scene.background = new THREE.Color(0x1a1030);
    w.scene.fog = new THREE.Fog(0x1a1030, 500, 1700);
    w.levelGroup.visible = false;
    this.snap = true;
    this.go(room);
  }

  close() {
    this.active = false;
    this._clearPanels();
    if (this.rig.parent) this.rig.parent.remove(this.rig);
    this.g.world.levelGroup.visible = true;
  }

  // Stats as a 3D moment: panels float next to the frog while the camera orbits.
  openStats(d, rows) {
    const g = this.g, w = g.world, p = g.player;
    this.active = true;
    this.rig.position.set(p.x, p.y, 0);
    this.rig.rotation.z = this.rigYaw = Math.atan2(w.camera.position.y - p.y, w.camera.position.x - p.x);
    if (!this.rig.parent) w.scene.add(this.rig);
    this.diorama.visible = false;
    this.statsData = { d, rows };
    this.snap = false;
    this.go('stats');
  }

  _statsRoom() {
    const { d, rows } = this.statsData;
    const g = this.g;
    return {
      cam: V(390, 40, 150), look: V(0, -70, 100), orbit: true,
      title: { label: d.title, at: V(60, -150, 218), w: 200, h: 36, accent: d.win ? '#33ff77' : '#ff2a3a' },
      card: { at: V(60, -150, 135), w: 170, h: 122, item: { kind: 'card', label: d.why, body: rows.map((r) => `${r[0]}: ${r[1]}`).join('\n') + (d.newPB ? '\n*NEW PERSONAL BEST!' : '') } },
      list: { at: V(60, -150, 58), w: 130, h: 24, gap: 29 },
      items: [
        { kind: 'button', label: d.mode === 'timeloop' ? 'NEXT ITERATION (R)' : 'TRY AGAIN (R)', act: () => g.restart() },
        { kind: 'button', label: 'MAIN MENU', act: () => g.screens.wipe(() => g.toMenu()) },
      ],
    };
  }

  _clearPanels() {
    for (const p of this.panels) { p.mesh.parent && p.mesh.parent.remove(p.mesh); p.dispose(); }
    for (const p of this.deco || []) { p.mesh.parent && p.mesh.parent.remove(p.mesh); p.dispose(); }
    this.panels = []; this.deco = [];
  }

  go(name, keepSel) {
    const prevSel = this.sel;
    this._clearPanels();
    this.roomName = name;
    const R = name === 'stats' ? this._statsRoom() : (this.rooms()[name] || this.rooms().main)();
    this.room = R;
    const add = (item, at, w, h, deco) => {
      const p = new Panel3D(item, w, h);
      p.mesh.position.copy(at);
      this.rig.add(p.mesh);
      (deco ? this.deco : this.panels).push(p);
      return p;
    };
    if (R.title) add({ kind: 'title', label: R.title.label, accent: R.title.accent }, R.title.at, R.title.w, R.title.h, true);
    if (R.card) add(R.card.item, R.card.at, R.card.w, R.card.h, true);
    R.items.forEach((it, i) => {
      let at;
      if (R.grid) { const G = R.grid; at = G.at.clone().add(V(0, (i % G.cols) * G.dx, -Math.floor(i / G.cols) * G.dz)); add(it, at, G.w, G.h); }
      else { const L = R.list; at = L.at.clone().add(V(0, 0, -i * L.gap)); add(it, at, L.w, L.h); }
    });
    this.sel = keepSel ? Math.min(prevSel, this.panels.length - 1) : 0;
    this._face();
    this.g.sfx.play('ui');
  }

  _camLocal() {
    const R = this.room;
    const c = R.cam.clone();
    if (R.orbit) { const a = this.orbit; c.set(R.cam.x * Math.cos(a) - R.cam.y * Math.sin(a), R.cam.x * Math.sin(a) + R.cam.y * Math.cos(a), R.cam.z); }
    if (this.hasMouse) c.add(V(0, -this.mouse.x * 28, -this.mouse.y * 16));
    return c;
  }

  _face() {
    this.rig.updateMatrixWorld(true);
    const cw = this.rig.localToWorld(this.room.cam.clone());
    for (const p of [...this.panels, ...this.deco]) { p.mesh.up.set(0, 0, 1); p.mesh.lookAt(cw); }
  }

  _move(d) {
    const n = this.panels.length;
    if (!n) return;
    for (let k = 0; k < n; k++) { this.sel = (this.sel + d + n) % n; if (this.panels[this.sel].interactive) break; }
    this.hasMouse = false;
    this.g.sfx.play('ui');
  }

  _pick() {
    const cam = this.g.world.camera;
    this.ray.setFromCamera(this.mouse, cam);
    const hits = this.ray.intersectObjects(this.panels.map((p) => p.mesh), false);
    const p = hits.length ? hits[0].object.userData.panel : null;
    const i = p ? this.panels.indexOf(p) : -1;
    if (i >= 0 && i !== this.sel) { this.sel = i; this.g.sfx.play('ui'); }
    this._mouseOver = i >= 0;
  }

  _activate(p, dir) {
    const it = p.item;
    this.g.sfx.init();
    this.g.sfx.play('ui');
    if (it.act) it.act();
    else if (dir > 0 && it.next) it.next();
    else if (dir < 0 && it.prev) it.prev();
  }

  update(dt) {
    if (!this.active) return;
    const g = this.g, w = g.world, cam = w.camera;
    this.t += dt;
    if (this.room.orbit) { this.orbit += dt * 0.12; this._face(); }
    const camW = this.rig.localToWorld(this._camLocal());
    const lookW = this.rig.localToWorld(this.room.look.clone());
    const k = this.snap ? 1 : 1 - Math.exp(-4.5 * dt);
    this.snap = false;
    this.camPos.lerp(camW, k); this.camLook.lerp(lookW, k);
    if (k === 1) { this.camPos.copy(camW); this.camLook.copy(lookW); }
    cam.position.copy(this.camPos);
    cam.up.set(0, 0, 1);
    cam.lookAt(this.camLook);
    if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
    // Tode idles facing the camera; in the wardrobe he slowly turns on the pad
    const p = g.player;
    if (this.roomName !== 'stats') {
      p.yaw = this.rigYaw + (this.roomName === 'wardrobe' ? this.t * 0.6 : Math.sin(this.t * 0.6) * 0.25);
      p.moving = false;
      p.sync();
    }
    for (const f of this.flies) {
      const u = f.userData;
      u.a += dt * u.s * 0.3;
      f.position.set(Math.cos(u.a) * u.r, Math.sin(u.a) * u.r, u.z + Math.sin(this.t * 2 + u.p) * 10);
      f.visible = Math.sin(this.t * 3 + u.p) > -0.6;
    }
    if (this.hasMouse && this._mouseOver !== undefined) this._pick();
    this.panels.forEach((pn, i) => {
      pn.hover = i === this.sel && pn.interactive && (!this.hasMouse || this._mouseOver);
      const target = pn.hover ? 1.07 : 1;
      pn.pop += (target - pn.pop) * (1 - Math.exp(-18 * dt));
      pn.mesh.scale.setScalar(pn.pop || 1);
      pn.draw();
    });
    for (const d of this.deco) d.draw();
  }
}

const HOWTO = `Beat a level and your run becomes a ghost that replays everything and hunts you. Kill it, beat the boss and reach the goal first.
*WASD move, Space jump, Shift dodge, mouse aim (click to lock).
*LMB sword combo, RMB parry just before a hit. Q / 1 / 2 swap sword and gun (gun: LMB fire, hold RMB to aim).
*E tongue (eat pink-marked bugs to heal), G ultimate when the meter is full, P pause, M mute.
Yellow flash = normal attack, parry it. Red glyph = perilous: can't be parried, dodge it (or jump shockwaves). Orange glyph = dodge through it to open a RIPOSTE: slash right away for a guaranteed crit.
Posture: fill a bar to break the target (stunned, edible, deathblow x3). Your own bar fills when you block or get hit.`;

const CREDITS = `Froggy Ballin, a JetBrains game jam entry built on the "Build a Game with an AI Coding Agent" course (MIT, JetBrains Academy): Tode the Frog, the ant and house models, Three.js + Vite setup.
Game director: Kutkarshhh. Code written with Claude Code (Anthropic).
All other meshes, UI art and comic panels are drawn in code. All sound and music are synthesized live with WebAudio.`;
