import * as THREE from 'three';
import { TAU } from '../core/math.js';

const sphere = new THREE.SphereGeometry(1, 6, 5);
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
const discGeo = new THREE.CircleGeometry(1, 32);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const mats = new Map();
function pmat(color) {
  if (!mats.has(color)) {
    mats.set(color, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
  }
  return mats.get(color);
}
const arcCache = new Map();
const HEAL = new Set([0x55ff55, 0x66ff66, 0x7dff6a, 0x9dff8a]);

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.flats = [];
    this.dis = [];
    this.streakList = [];
    this.shake = 0;
    this.tagger = null; // (object, kind) => World.tag, set by Game
    this.shakeMul = 1; // 'Reduce flashing/effects' lowers it
  }

  burst(x, y, z, color, n = 8, speed = 180, life = 0.5, size = 3, grav = 300) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 350) return;
      const m = new THREE.Mesh(sphere, pmat(color));
      if (this.tagger && HEAL.has(color)) this.tagger(m, 'heal');
      const a = Math.random() * TAU;
      const el = Math.random() * 1.2;
      const v = speed * (0.4 + Math.random() * 0.6);
      m.position.set(x, y, z);
      m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      this.scene.add(m);
      this.parts.push({ m, vx: Math.cos(a) * Math.cos(el) * v, vy: Math.sin(a) * Math.cos(el) * v, vz: Math.sin(el) * v, life, max: life, grav });
    }
  }

  _flat(mesh, mat, life, s0, s1, op) {
    this.scene.add(mesh);
    const f = { m: mesh, mat, life, max: life, s0, s1, op };
    this.flats.push(f);
    return f;
  }

  ring(x, y, z, color, r0, r1, life = 0.4, op = 0.9) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(ringGeo, mat);
    m.position.set(x, y, z);
    m.scale.setScalar(r0);
    return this._flat(m, mat, life, r0, r1, op);
  }

  disc(x, y, z, color, r0, r1, life = 0.3, op = 0.5) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(discGeo, mat);
    m.position.set(x, y, z);
    m.scale.setScalar(r0);
    return this._flat(m, mat, life, r0, r1, op);
  }

  // Curved sword-slash ribbon on the ground plane in front of (x,y).
  slash(x, y, z, yaw, range, half, color = 0xffffff) {
    const key = `${range}|${half}`;
    let geo = arcCache.get(key);
    if (!geo) {
      geo = new THREE.RingGeometry(range * 0.45, range, 28, 1, -half, half * 2);
      arcCache.set(key, geo);
    }
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.z = yaw;
    return this._flat(m, mat, 0.22, 0.85, 1.08, 0.85);
  }

  // Persistent telegraph marker; call .remove() on the returned handle.
  marker(x, y, r, color = 0xff2200) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(discGeo, mat);
    m.position.set(x, y, 2);
    m.scale.setScalar(r);
    // Neon outline ring on top of the fill so boss telegraphs read at a glance.
    const edge = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    edge.position.z = 0.5;
    m.add(edge);
    const f = this._flat(m, mat, Infinity, r, r, 0.5);
    f.edge = edge;
    if (this.tagger) this.tagger(m, 'danger');
    f.pulse = true;
    f.remove = () => { f.life = 0; f.max = 0.0001; f.pulse = false; };
    return f;
  }

  // Shrinks a dead actor away (optionally pulled toward a point, e.g. eaten by the tongue).
  // spin > 0: death pop (swell, spin up and shrink away).
  dissolve(root, life = 0.3, tx = null, ty = null, spin = 0) {
    this.dis.push({ root, life, max: life, tx, ty, spin, x0: root.position.x, y0: root.position.y, z0: root.position.z, s0: root.scale.x });
  }

  // Radial speed lines bursting out of a contact point (perfect parry).
  streaks(x, y, z, color, n = 10, len = 100, life = 0.22) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, el = (Math.random() - 0.3) * 0.9;
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el), Math.sin(el));
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(boxGeo, mat);
      m.quaternion.setFromUnitVectors(X_AXIS, d);
      m.position.set(x, y, z);
      this.scene.add(m);
      this.streakList.push({ m, mat, d, x, y, z, len: len * (0.6 + Math.random() * 0.7), life, max: life });
    }
  }

  // Bullet tracer: a thin glowing line from the muzzle along the shot.
  tracer(x0, y0, z0, x1, y1, z1, color = 0xffee88, life = 0.09) {
    const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0);
    const len = d.length() || 1;
    d.normalize();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(boxGeo, mat);
    m.quaternion.setFromUnitVectors(X_AXIS, d);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.scale.set(len, 1.6, 1.6);
    this.scene.add(m);
    this.streakList.push({ m, mat, d, x: x0, y: y0, z: z0, len, life, max: life, tracer: true });
  }

  // Single short-lived glowing dot (sword trails).
  dot(x, y, z, color, size = 3, life = 0.15) {
    if (this.parts.length > 350) return;
    const m = new THREE.Mesh(sphere, pmat(color));
    m.position.set(x, y, z);
    m.scale.setScalar(size);
    this.scene.add(m);
    this.parts.push({ m, vx: 0, vy: 0, vz: 0, life, max: life, grav: 0 });
  }

  addShake(a) { this.shake = Math.max(this.shake, a * this.shakeMul); }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.m); this.parts.splice(i, 1); continue; }
      p.vz -= p.grav * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z = Math.max(1, p.m.position.z + p.vz * dt);
      const k = p.life / p.max;
      p.m.scale.multiplyScalar(0.5 + 0.5 * k > 0.99 ? 1 : 0.97);
    }
    for (let i = this.flats.length - 1; i >= 0; i--) {
      const f = this.flats[i];
      if (f.life !== Infinity) f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.m);
        f.mat.dispose();
        if (f.edge) f.edge.material.dispose();
        this.flats.splice(i, 1);
        continue;
      }
      if (f.life === Infinity) {
        f.mat.opacity = f.pulse ? 0.3 + 0.25 * Math.sin(performance.now() / 90) : f.op;
        if (f.edge) f.edge.scale.setScalar(1 + 0.04 * Math.sin(performance.now() / 60));
      } else {
        const t = 1 - f.life / f.max;
        f.m.scale.setScalar(f.s0 + (f.s1 - f.s0) * t);
        f.mat.opacity = f.op * (1 - t);
      }
    }
    for (let i = this.dis.length - 1; i >= 0; i--) {
      const d = this.dis[i];
      d.life -= dt;
      const k = Math.min(1, 1 - d.life / d.max);
      if (d.life <= 0) { this.scene.remove(d.root); this.dis.splice(i, 1); continue; }
      if (d.spin) {
        const sw = k < 0.2 ? 1 + k * 1.2 : 1.24 * (1 - (k - 0.2) / 0.8);
        d.root.scale.setScalar(Math.max(0.01, d.s0 * sw));
        d.root.rotation.z += d.spin * dt * (0.4 + k);
        d.root.position.z = d.z0 + 40 * Math.sin(k * Math.PI);
      } else {
        d.root.scale.setScalar(Math.max(0.01, d.s0 * (1 - k)));
        d.root.position.z = d.z0 + 24 * k;
      }
      if (d.tx != null) {
        d.root.position.x = d.x0 + (d.tx - d.x0) * k * 0.7;
        d.root.position.y = d.y0 + (d.ty - d.y0) * k * 0.7;
      }
    }
    for (let i = this.streakList.length - 1; i >= 0; i--) {
      const s = this.streakList[i];
      s.life -= dt;
      if (s.life <= 0) { this.scene.remove(s.m); s.mat.dispose(); this.streakList.splice(i, 1); continue; }
      const k = 1 - s.life / s.max;
      if (s.tracer) { s.mat.opacity = 1 - k; s.m.scale.y = s.m.scale.z = 1.6 * (1 - k * 0.6); continue; }
      const L = s.len * (1 - (1 - k) * (1 - k));
      const th = 3 * (1 - k) + 0.5;
      s.m.scale.set(Math.max(1, L * 0.7), th, th);
      const off = L * 0.35 + s.len * 0.45 * k + 10;
      s.m.position.set(s.x + s.d.x * off, s.y + s.d.y * off, s.z + s.d.z * off);
      s.mat.opacity = 1 - k;
    }
    this.shake *= Math.exp(-9 * dt);
    if (this.shake < 0.05) this.shake = 0;
  }

  clear() {
    for (const p of this.parts) this.scene.remove(p.m);
    for (const f of this.flats) { this.scene.remove(f.m); f.mat.dispose(); }
    for (const d of this.dis) this.scene.remove(d.root);
    for (const s of this.streakList) { this.scene.remove(s.m); s.mat.dispose(); }
    this.streakList.length = 0;
    this.dis.length = 0;
    this.parts.length = 0;
    this.flats.length = 0;
  }
}
