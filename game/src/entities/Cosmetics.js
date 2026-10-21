import * as THREE from 'three';
import { Storage } from '../core/Storage.js';
import { stdMat, blob } from '../core/Assets.js';

// Wardrobe: everything is drawn in code. Each slot has options [id, label, value, unlock?].
// Unlocks are achievements stored in localStorage ('ach').
export const ACH = {
  boss: 'Defeat any boss',
  allbosses: 'Clear Boss Rush',
  srank: 'Reach S rank',
  torture: 'Win a run on TORTURE',
};

export const SLOTS = {
  skin: { label: 'SKIN', opts: [['classic', 'CLASSIC', null], ['crimson', 'CRIMSON', 0xd23a3a], ['midnight', 'MIDNIGHT', 0x3a4cc8], ['ivory', 'IVORY', 0xf0ead8], ['toxic', 'TOXIC', 0xb6ff3a], ['coral', 'CORAL', 0xff8a6a], ['violet', 'VIOLET', 0x9a5cff], ['gold', 'GOLD', 0xffcc33, 'srank']] },
  glow: { label: 'PATTERN GLOW', opts: [['none', 'NONE', 0x000000], ['ember', 'EMBER', 0x441000], ['frost', 'FROST', 0x003344], ['venom', 'VENOM', 0x113300], ['void', 'VOID', 0x220033, 'torture']] },
  eyes: { label: 'EYES', opts: [['normal', 'NORMAL'], ['angry', 'ANGRY'], ['sleepy', 'SLEEPY'], ['shades', 'SHADES'], ['glow', 'GLOWING', null, 'boss']] },
  hat: { label: 'HAT', opts: [['none', 'NONE'], ['bandana', 'BANDANA'], ['headband', 'HEADBAND'], ['party', 'PARTY HAT'], ['flower', 'FLOWER'], ['tophat', 'TOP HAT'], ['cape', 'CAPE'], ['crown', 'CROWN', null, 'boss'], ['halo', 'HALO', null, 'allbosses']] },
  blade: { label: 'BLADE', opts: [['silver', 'SILVER', 0xdfe8f0], ['crimson', 'CRIMSON', 0xff3344], ['neon', 'NEON CYAN', 0x55ffee], ['obsidian', 'OBSIDIAN', 0x2a2630], ['gold', 'GOLD', 0xffd23f, 'srank']] },
  hilt: { label: 'HILT', opts: [['gold', 'GOLD GUARD', 0xffc400], ['red', 'RED GUARD', 0xc8101e], ['black', 'BLACK GUARD', 0x1a1a1a], ['jade', 'JADE GUARD', 0x2fbf71]] },
  trail: { label: 'SLASH TRAIL', opts: [['white', 'WHITE', 0xffffff], ['red', 'RED', 0xff2a3a], ['cyan', 'CYAN', 0x66ddff], ['gold', 'GOLD', 0xffd23f], ['violet', 'VIOLET', 0xb48cff]] },
  gun: { label: 'GUN', opts: [['gunmetal', 'GUNMETAL', 0x444a55], ['red', 'RED', 0xc8101e], ['white', 'WHITE', 0xe8e8e8], ['toxic', 'TOXIC', 0x7dff3a], ['gold', 'GOLD', 0xffcc33, 'boss']] },
  tongue: { label: 'TONGUE', opts: [['pink', 'PINK', 0xff5f8a], ['red', 'RED', 0xe02030], ['cyan', 'CYAN', 0x55ddff], ['gold', 'GOLD', 0xffd23f]] },
  parry: { label: 'PARRY FLASH', opts: [['white', 'WHITE', 0xffffff], ['cyan', 'CYAN', 0x66ddff], ['gold', 'GOLD', 0xffd23f], ['red', 'RED', 0xff3344]] },
  splat: { label: 'DEATH SPLAT', opts: [['green', 'GREEN', 0x4caf50], ['red', 'RED', 0xc8101e], ['ink', 'INK', 0x111111], ['gold', 'GOLD', 0xffd23f]] },
};

const DEFAULT = Object.fromEntries(Object.entries(SLOTS).map(([k, s]) => [k, s.opts[0][0]]));

export const Cosmetics = {
  get() { return { ...DEFAULT, ...(Storage.get('cosmetics', {}) || {}) }; },
  set(slot, id) { const c = this.get(); c[slot] = id; Storage.set('cosmetics', c); },
  opt(slot, id) { const s = SLOTS[slot]; return s.opts.find((o) => o[0] === id) || s.opts[0]; },
  val(c, slot) { return this.opt(slot, c[slot])[2]; },
  unlocked(o) { return !o[3] || !!(Storage.get('ach', {}) || {})[o[3]]; },
  cycle(slot, d) {
    const s = SLOTS[slot], c = this.get();
    let i = s.opts.findIndex((o) => o[0] === c[slot]);
    i = (i + d + s.opts.length) % s.opts.length;
    this.set(slot, s.opts[i][0]);
  },
  // Locked selections fall back to the slot default when worn.
  worn() {
    const c = this.get();
    for (const k of Object.keys(SLOTS)) if (!this.unlocked(this.opt(k, c[k]))) c[k] = DEFAULT[k];
    return c;
  },
};

// Returns true if newly unlocked.
export function unlock(key) {
  const a = Storage.get('ach', {}) || {};
  if (a[key]) return false;
  a[key] = true;
  Storage.set('ach', a);
  return true;
}

// ------------------------------------------------------------------ meshes
// Head anchor for Tode (height 46, forward +X). Built to sit on the frog's head.
export const HEAD = { x: 4, z: 44 };

export function buildHat(id) {
  const g = new THREE.Group();
  g.position.set(HEAD.x, 0, HEAD.z);
  switch (id) {
    case 'crown': {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 7, 10, 1, true), stdMat(0xffcc33, { metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide }));
      band.rotation.x = Math.PI / 2; band.position.z = 3;
      g.add(band);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 5), stdMat(0xffcc33, { metalness: 0.8 })); sp.rotation.x = Math.PI / 2; sp.position.set(Math.cos(a) * 10, Math.sin(a) * 10, 9); g.add(sp); }
      g.add(blob(0xff2244, 2.2, 1, 1, 1, 10, 0, 4));
      break;
    }
    case 'tophat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.5, 20), stdMat(0x151515));
      brim.rotation.x = Math.PI / 2; brim.position.z = 1;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9, 16, 20), stdMat(0x151515));
      top.rotation.x = Math.PI / 2; top.position.z = 9;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(9.1, 9.1, 3, 20), stdMat(0xc8101e));
      band.rotation.x = Math.PI / 2; band.position.z = 3.5;
      g.add(brim, top, band);
      break;
    }
    case 'party': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(8, 20, 14), stdMat(0xff5fb0));
      cone.rotation.x = Math.PI / 2; cone.position.z = 10;
      const pom = blob(0xffee55, 3, 1, 1, 1, 0, 0, 20);
      g.add(cone, pom);
      break;
    }
    case 'bandana': {
      const b = new THREE.Mesh(new THREE.TorusGeometry(12, 2.6, 6, 20), stdMat(0xc8101e));
      b.position.z = -4; b.scale.set(1.15, 1.25, 1);
      const knot = blob(0xc8101e, 3, 1, 1, 1, -14, 0, -4);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 5), stdMat(0xc8101e));
      tail.position.set(-20, 3, -7); tail.rotation.z = 0.4;
      g.add(b, knot, tail);
      break;
    }
    case 'headband': {
      const b = new THREE.Mesh(new THREE.TorusGeometry(12, 1.6, 6, 20), stdMat(0xffffff));
      b.position.z = -2; b.scale.set(1.15, 1.25, 1);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 8, 5), stdMat(0xb0b8c8, { metalness: 0.8 }));
      plate.position.set(13, 0, -2);
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(12, 1.5, 3), stdMat(0xffffff));
      t1.position.set(-19, 4, -4); t1.rotation.z = 0.5;
      g.add(b, plate, t1);
      break;
    }
    case 'flower': {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(blob(0xff8ad8, 3, 1, 0.6, 0.6, 6 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 2)); }
      g.add(blob(0xffee55, 2.4, 1, 1, 1, 6, 8, 2.5));
      break;
    }
    case 'cape': {
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(30, 34, 1, 4), stdMat(0xc8101e, { side: THREE.DoubleSide }));
      cape.rotation.y = Math.PI / 2 - 0.25; cape.position.set(-18, 0, -24);
      g.userData.cape = cape;
      g.add(cape, blob(0xffcc33, 2.5, 1, 1, 1, -6, 12, -12), blob(0xffcc33, 2.5, 1, 1, 1, -6, -12, -12));
      break;
    }
    case 'halo': {
      const h = new THREE.Mesh(new THREE.TorusGeometry(10, 1.4, 6, 24), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
      h.position.z = 12;
      g.add(h);
      break;
    }
    default: break;
  }
  return g;
}

// Eye overlays on Tode's two big front eyes.
export function buildEyes(id) {
  const g = new THREE.Group();
  const eyes = [[16, 9, 34], [16, -9, 34]];
  const add = (m) => g.add(m);
  if (id === 'angry') for (const [x, y, z] of eyes) { const b = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 2), stdMat(0x111111)); b.position.set(x + 1, y, z + 6); b.rotation.x = y > 0 ? 0.45 : -0.45; add(b); }
  if (id === 'sleepy') for (const [x, y, z] of eyes) { const l = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stdMat(0x3a8f3a)); l.position.set(x - 1, y, z); add(l); }
  if (id === 'shades') {
    for (const [x, y, z] of eyes) { const l = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 6), stdMat(0x0a0a0a, { metalness: 0.6, roughness: 0.1 })); l.position.set(x + 3, y, z); add(l); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 1.5), stdMat(0x0a0a0a)); br.position.set(19, 0, 34); add(br);
  }
  if (id === 'glow') for (const [x, y, z] of eyes) { const s = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a3a })); s.position.set(x + 2.5, y, z); add(s); }
  return g;
}
