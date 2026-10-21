import * as THREE from 'three';
import { Panel3D } from './Panel3D.js';
import { LEVELS } from '../levels/levels.js';
import { DIFFICULTY } from '../config.js';
import { Storage } from '../core/Storage.js';
import { Settings } from '../core/Settings.js';
import { fmtTime } from '../core/math.js';
import { Cosmetics, SLOTS, ACH } from '../entities/Cosmetics.js';
import { CFG } from '../config.js';
import { ACTIONS, Keybinds, keyName } from '../core/Keybinds.js';

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
    this.scroll = 0; this.scrollT = 0; this.scrollV = 0; this.maxScroll = 0;
    this.drag = null;
    this.extraRooms = { wardrobe: () => this.wardrobeRoom(), keybinds: () => this.keybindsRoom() };
    this.capture = null; // action name while waiting for a key / mouse button to rebind
    this.kbMsg = '';
    this._buildDiorama();
    const cv = game.canvas;
    cv.addEventListener('mousemove', (e) => {
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.hasMouse = true;
      if (this.active) this._pick();
    });
    cv.addEventListener('wheel', (e) => { if (!this.active || !this.maxScroll) return; e.preventDefault(); this.scrollV += e.deltaY * 0.6; }, { passive: false });
    window.addEventListener('mousemove', (e) => { if (this.drag) { this.scrollT = Math.max(0, Math.min(this.maxScroll, this.drag.s - (e.clientY - this.drag.y) * this.drag.k)); this.drag.moved = Math.abs(e.clientY - this.drag.y) > 6; } });
    window.addEventListener('mouseup', () => {
      // in scrollable rooms a click activates only if it wasn't a drag
      if (this._pendingClick && !(this.drag && this.drag.moved)) this._activate(this._pendingClick.p, this._pendingClick.dir);
      this._pendingClick = null; this.drag = null;
    });
    cv.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (this.capture) { if (this._capArmed) this._bind('Mouse' + e.button); return; }
      if (this.maxScroll && e.button === 0) this.drag = { y: e.clientY, s: this.scrollT, k: this._rowH() / 60, moved: false };
      this._pick();
      const p = this.panels[this.sel];
      if (p && p.hover && p.interactive) { this._pendingClick = { p, dir: e.button === 2 ? -1 : 1 }; if (!this.maxScroll) { this._activate(p, this._pendingClick.dir); this._pendingClick = null; } }
    });
    window.addEventListener('resize', () => { if (this.active && this.roomName) this.go(this.roomName, true); });
    window.addEventListener('keydown', (e) => {
      if (this.active && this.capture) {
        e.preventDefault();
        if (e.code !== 'Escape') this._bind(e.code); else { this.capture = null; this.kbMsg = 'Cancelled.'; }
        this.g.sfx.play('ui');
        return;
      }
      if (!this.active) return;
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
        list: { at: V(120, -150, 190), w: 122, h: 25, gap: 29 }, rows: this._fitRows(9, 7),
        title: { label: 'FROGGY BALLIN', at: V(118, -150, 228), w: 200, h: 40 },
        items: [
          { kind: 'button', label: 'PLAY', sub: 'Time Loop: pick a level', act: () => this.go('levels') },
          { kind: 'button', label: 'BOSS RUSH', act: () => g.screens.wipe(() => g.startRun('bossrush')) },
          { kind: 'button', label: 'SURVIVAL', act: () => g.screens.wipe(() => g.startRun('survival')) },
          { kind: 'option', label: 'DIFFICULTY', value: () => g.D.label, act: () => this.go('difficulty'), next: () => this._cycleDiff(1), prev: () => this._cycleDiff(-1) },
          { kind: 'button', label: 'WARDROBE', act: () => this.go('wardrobe') },
          { kind: 'button', label: 'SETTINGS', act: () => this.go('settings') },
          { kind: 'button', label: 'KEYBINDS', act: () => this.go('keybinds') },
          { kind: 'button', label: 'HOW TO PLAY', act: () => this.go('howto') },
          { kind: 'button', label: 'CREDITS', act: () => this.go('credits') },
        ],
      }),
      levels: () => ({
        cam: V(430, -628, 140), look: V(40, -628, 118),
        grid: { at: V(110, -700, 175), w: 135, h: 46, cols: 2, dx: 145, dz: 54 }, rows: this._fitRows(3, 2),
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
        list: { at: V(120, 450, 172), w: 112, h: 26, gap: 31 }, rows: this._fitRows(5, 4),
        card: { at: V(110, 595, 122), w: 150, h: 110, item: { kind: 'card', label: g.D.label, body: g.D.desc } },
        items: [
          ...Object.entries(DIFFICULTY).map(([k, v]) => ({ kind: 'option', label: v.label, value: () => (g.diffKey === k ? 'ON' : ''), act: () => { g.setDifficulty(k); this.go('difficulty', true); } })),
          back,
        ],
      }),
      settings: () => this.settingsRoom(back),
      howto: () => ({
        cam: V(440, -420, 420), look: V(40, -420, 398),
        card: { at: V(100, -420, 420), w: 270, h: 200, item: { kind: 'card', label: 'HOW TO PLAY', get body() { return howto(); } } },
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
      cam: V(560, -150, 420), look: V(40, -150, 422),
      grid: { at: V(110, -300, 490), w: 140, h: 22, cols: 3, dx: 150, dz: 27 }, rows: 6,
      items: [
        tog('ui3d', '3D MENUS', () => { apply(); if (!Settings.get('ui3d')) g.toMenu(); }),
        tog('hud3d', 'HUD: IN-WORLD', apply),
        tog('crt', 'CRT OVERLAY', apply),
        tog('reduce', 'REDUCE FLASHING', apply),
        tog('dmgNums', 'DAMAGE NUMBERS', apply),
        tog('invertY', 'INVERT Y', apply),
        num('sens', 'MOUSE SENS', 0.05, 0.1, 3, (v) => v.toFixed(2)),
        num('aimSens', 'AIM SENS (ADS)', 0.05, 0.1, 2, (v) => v.toFixed(2)),
        num('ySens', 'VERTICAL SENS', 0.05, 0.2, 2, (v) => v.toFixed(2)),
        { kind: 'button', label: 'RESET SENSITIVITY', act: () => { Settings.set('sens', Settings.DEFAULTS.sens); Settings.set('aimSens', Settings.DEFAULTS.aimSens); Settings.set('ySens', Settings.DEFAULTS.ySens); } },
        num('fov', 'FOV', 5, 40, 90, (v) => v, apply),
        num('camDist', 'CAMERA DIST', 20, 180, 420, (v) => v, apply),
        num('aimAssist', 'AIM ASSIST', 0.25, 0, 2, (v) => v.toFixed(2)),
        num('master', 'MASTER VOL', 0.1, 0, 1, (v) => Math.round(v * 100) + '%', apply),
        num('sfx', 'SFX VOL', 0.1, 0, 1, (v) => Math.round(v * 100) + '%', apply),
        num('music', 'MUSIC VOL', 0.1, 0, 1, (v) => Math.round(v * 100) + '%', apply),
        back,
      ],
    };
  }

  wardrobeRoom() {
    const g = this.g;
    const refresh = () => g.player.applyCosmetics();
    const items = Object.entries(SLOTS).map(([slot, s]) => ({
      kind: 'option', label: s.label,
      value: () => { const o = Cosmetics.opt(slot, Cosmetics.get()[slot]); return Cosmetics.unlocked(o) ? o[1] : 'LOCKED'; },
      act: () => { Cosmetics.cycle(slot, 1); refresh(); },
      next: () => { Cosmetics.cycle(slot, 1); refresh(); },
      prev: () => { Cosmetics.cycle(slot, -1); refresh(); },
    }));
    const locks = Object.entries(ACH).map(([k, v]) => `${(Storage.get('ach', {}) || {})[k] ? 'UNLOCKED' : 'LOCKED'}: ${v}`).join('\n');
    return {
      cam: V(250, -50, 80), look: V(0, -82, 54),
      grid: { at: V(40, -175, 96), w: 82, h: 14, cols: 2, dx: 88, dz: 16 }, rows: this._fitRows(6, 4),
      card: { at: V(40, 60, 92), w: 70, h: 52, item: { kind: 'card', label: 'UNLOCKS', body: `Gold skin / blade: S rank\nCrown, glowing eyes, gold gun: beat a boss\nHalo: clear Boss Rush\nVoid glow: win on TORTURE\n${locks}` } },
      items: [...items, { kind: 'button', label: 'BACK', act: () => this.go('main') }],
    };
  }

  _bind(code) {
    const a = this.capture;
    this.capture = null; this._capArmed = false;
    const sw = Keybinds.bind(a, code);
    this.kbMsg = sw ? `${keyName(code)} was used by ${Keybinds.label(sw)}: swapped.` : `${Keybinds.label(a)} -> ${keyName(code)}`;
    this.g.applySettings();
  }

  keybindsRoom() {
    const self = this;
    const items = ACTIONS.map(([a, n]) => ({
      kind: 'option', label: n,
      value: () => (this.capture === a ? 'PRESS...' : keyName(CFG.KEYS[a])),
      act: () => { this.capture = a; this._capArmed = false; setTimeout(() => { this._capArmed = true; }, 150); this.kbMsg = `Press a key or mouse button for ${n} (Esc cancels)`; },
      prev: () => { Keybinds.reset(a); this.g.applySettings(); this.kbMsg = `${n} reset to ${keyName(CFG.KEYS[a])}`; },
      next: () => { this.capture = a; this._capArmed = true; this.kbMsg = `Press a key or mouse button for ${n} (Esc cancels)`; },
    }));
    return {
      cam: V(560, 300, 400), look: V(40, 300, 395),
      grid: { at: V(110, 150, 500), w: 140, h: 22, cols: 3, dx: 150, dz: 27 }, rows: this._fitRows(6, 5),
      card: { at: V(110, 300, 548), w: 300, h: 44, item: { kind: 'card', label: 'KEYBINDS', get body() { return self.kbMsg || 'Click / Enter: rebind (keys or mouse). Right-click / Left arrow: reset that action. Conflicts swap.'; } } },
      items: [...items, { kind: 'button', label: 'RESET ALL KEYBINDS', act: () => { Keybinds.resetAll(); this.g.applySettings(); this.kbMsg = 'All keybinds reset.'; } }, { kind: 'button', label: 'BACK', act: () => this.go('main') }],
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
    for (const b of [this.barTrack, this.barThumb]) if (b) { this.rig.remove(b); b.geometry.dispose(); b.material.dispose(); }
    this.barTrack = this.barThumb = null;
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
    // Scrollable lists: rows beyond R.rows scroll vertically (wheel / drag / keyboard focus).
    const rowsTotal = R.grid ? Math.ceil(R.items.length / R.grid.cols) : R.items.length;
    this.visRows = R.rows || rowsTotal;
    this.maxScroll = Math.max(0, rowsTotal - this.visRows) * this._rowH();
    if (!keepSel) { this.scroll = this.scrollT = 0; }
    this.scrollT = Math.min(this.scrollT, this.maxScroll);
    for (const p of this.panels) p.base = p.mesh.position.clone();
    if (this.maxScroll) {
      const L = R.grid || R.list;
      const top = L.at.z, bottom = L.at.z - (this.visRows - 1) * this._rowH();
      const x = L.at.x, y = L.at.y + (R.grid ? (R.grid.cols - 1) * R.grid.dx + R.grid.w / 2 + 10 : L.w / 2 + 10);
      this.barTrack = new THREE.Mesh(new THREE.PlaneGeometry(3, top - bottom + L.h), new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.6, depthWrite: false }));
      this.barThumb = new THREE.Mesh(new THREE.PlaneGeometry(4, Math.max(10, (top - bottom + L.h) * this.visRows / rowsTotal)), new THREE.MeshBasicMaterial({ color: 0xff2a3a, depthWrite: false }));
      this.barTrack.position.set(x, y, (top + bottom) / 2); this.barThumb.position.set(x + 0.5, y, top);
      this.barSpan = [top + L.h / 2, bottom - L.h / 2];
      this.rig.add(this.barTrack, this.barThumb);
    }
    this._face();
    this.g.sfx.play('ui');
  }

  // Fewer visible rows on short windows (text stays a readable size); the rest scrolls.
  _fitRows(full, short) { const h = window.innerHeight; return h >= 640 ? full : h >= 470 ? short : Math.max(3, short - 2); }

  _rowH() { const R = this.room; return R.grid ? R.grid.dz : R.list ? R.list.gap : 30; }

  _camLocal() {
    const R = this.room;
    const c = R.cam.clone();
    // Narrow / small windows: pull the camera back along its view line so panels stay inside the frame.
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect < 1.7) c.sub(R.look).multiplyScalar(Math.min(1.9, 1.7 / aspect)).add(R.look);
    if (R.orbit) { const a = this.orbit; c.set(R.cam.x * Math.cos(a) - R.cam.y * Math.sin(a), R.cam.x * Math.sin(a) + R.cam.y * Math.cos(a), R.cam.z); }
    if (this.hasMouse) c.add(V(0, -this.mouse.x * 28, -this.mouse.y * 16));
    return c;
  }

  _face() {
    this.rig.updateMatrixWorld(true);
    const cw = this.rig.localToWorld(this.room.cam.clone());
    for (const p of [...this.panels, ...this.deco]) { p.mesh.up.set(0, 0, 1); p.mesh.lookAt(cw); }
    for (const b of [this.barTrack, this.barThumb]) if (b) { b.up.set(0, 0, 1); b.lookAt(cw); }
  }

  _move(d) {
    const n = this.panels.length;
    if (!n) return;
    for (let k = 0; k < n; k++) { this.sel = (this.sel + d + n) % n; if (this.panels[this.sel].interactive) break; }
    this._scrollTo(this.sel);
    this.hasMouse = false;
    this.g.sfx.play('ui');
  }

  // Keep the focused panel inside the visible rows.
  _scrollTo(i) {
    if (!this.maxScroll) return;
    const R = this.room, cols = R.grid ? R.grid.cols : 1, rh = this._rowH();
    const row = Math.floor(i / cols);
    const first = Math.round(this.scrollT / rh);
    if (row < first) this.scrollT = row * rh;
    else if (row > first + this.visRows - 1) this.scrollT = (row - this.visRows + 1) * rh;
    this.scrollT = Math.max(0, Math.min(this.maxScroll, this.scrollT));
  }

  _pick() {
    const cam = this.g.world.camera;
    this.ray.setFromCamera(this.mouse, cam);
    const hits = this.ray.intersectObjects(this.panels.map((p) => p.mesh), false);
    const h = hits.find((x) => x.object.userData.panel && x.object.userData.panel.vis > 0.5);
    const p = h ? h.object.userData.panel : null;
    const i = p ? this.panels.indexOf(p) : -1;
    if (i >= 0 && i !== this.sel && this.panels[i].vis > 0.5) { this.sel = i; this.g.sfx.play('ui'); }
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
    if (this.room.orbit) { this.orbit = Math.sin(this.t * 0.22) * 0.6; this._face(); } // +-35 deg sweep, never behind the panels
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
    // inertial scroll
    if (this.maxScroll) {
      this.scrollT = Math.max(0, Math.min(this.maxScroll, this.scrollT + this.scrollV * dt * 4));
      this.scrollV *= Math.exp(-8 * dt);
      this.scroll += (this.scrollT - this.scroll) * (1 - Math.exp(-12 * dt));
      if (this.barThumb) { const [a, b] = this.barSpan, th = this.barThumb.geometry.parameters.height; this.barThumb.position.z = a - th / 2 - (this.scroll / this.maxScroll) * (a - b - th); }
    }
    const rh = this._rowH(), L = this.room.grid || this.room.list;
    const top = L ? L.at.z : 0, bottom = top - ((this.visRows || 1) - 1) * rh;
    this.panels.forEach((pn, i) => {
      pn.hover = i === this.sel && pn.interactive && (!this.hasMouse || this._mouseOver) && pn.vis > 0.5;
      // fade + slide at the edges of the visible rows
      let vis = 1, z = pn.base ? pn.base.z + this.scroll : pn.mesh.position.z;
      if (this.maxScroll) { const out = Math.max(z - top, bottom - z, 0) / rh; vis = Math.max(0, 1 - out); }
      pn.vis = vis;
      if (pn.base) pn.mesh.position.set(pn.base.x - (1 - vis) * 12, pn.base.y, z);
      pn.mat.opacity = vis;
      pn.mesh.visible = vis > 0.02;
      const target = (pn.hover ? 1.07 : 1) * (0.85 + 0.15 * vis);
      pn.pop += (target - pn.pop) * (1 - Math.exp(-18 * dt));
      pn.mesh.scale.setScalar(pn.pop || 1);
      pn.draw();
    });
    for (const d of this.deco) d.draw();
  }
}

const howto = () => { const K = CFG.KEYS, n = keyName; return `Beat a level and your run becomes a ghost that replays everything and hunts you. Kill it, beat the boss and reach the goal first.
*${n(K.forward)}${n(K.left)}${n(K.back)}${n(K.right)} move, ${n(K.jump)} jump, ${n(K.dodge)} dodge, mouse aim (click to lock).
*${n(K.slash)} sword combo, ${n(K.parry)} parry just before a hit. ${n(K.weapon)} / ${n(K.sword)} / ${n(K.gun)} swap sword and gun (gun: ${n(K.slash)} fire, hold ${n(K.parry)} to aim). ${n(K.shoot)} quick action.
*${n(K.tongue)} tongue (eat pink-marked bugs to heal), ${n(K.ult)} ultimate when the meter is full, ${n(K.pause)} pause, ${n(K.mute)} mute.
Yellow flash = normal attack, parry it. Red glyph = perilous: can't be parried, dodge it (or jump shockwaves). Orange glyph = dodge through it to open a RIPOSTE: slash right away for a guaranteed crit.
Posture: fill a bar to break the target (stunned, edible, deathblow x3). Your own bar fills when you block or get hit.`; };

const CREDITS = `Froggy Ballin, a JetBrains game jam entry built on the "Build a Game with an AI Coding Agent" course (MIT, JetBrains Academy): Tode the Frog, the ant and house models, Three.js + Vite setup.
Game director: Kutkarshhh. Code written with Claude Code (Anthropic).
All other meshes, UI art and comic panels are drawn in code. All sound and music are synthesized live with WebAudio.`;
