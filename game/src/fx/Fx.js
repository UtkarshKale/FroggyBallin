import * as THREE from 'three';
import { TAU } from '../core/math.js';

const sphere = new THREE.SphereGeometry(1, 6, 5);
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
const discGeo = new THREE.CircleGeometry(1, 32);
const mats = new Map();
function pmat(color) {
  if (!mats.has(color)) {
    mats.set(color, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
  }
  return mats.get(color);
}
const arcCache = new Map();

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.flats = [];
    this.dis = [];
    this.shake = 0;
  }

  burst(x, y, z, color, n = 8, speed = 180, life = 0.5, size = 3, grav = 300) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 350) return;
      const m = new THREE.Mesh(sphere, pmat(color));
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
    const f = this._flat(m, mat, Infinity, r, r, 0.5);
    f.pulse = true;
    f.remove = () => { f.life = 0; f.max = 0.0001; f.pulse = false; };
    return f;
  }

  // Shrinks a dead actor away (optionally pulled toward a point, e.g. eaten by the tongue).
  dissolve(root, life = 0.3, tx = null, ty = null) {
    this.dis.push({ root, life, max: life, tx, ty, x0: root.position.x, y0: root.position.y, z0: root.position.z, s0: root.scale.x });
  }

  addShake(a) { this.shake = Math.max(this.shake, a); }

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
        this.flats.splice(i, 1);
        continue;
      }
      if (f.life === Infinity) {
        f.mat.opacity = f.pulse ? 0.3 + 0.25 * Math.sin(performance.now() / 90) : f.op;
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
      d.root.scale.setScalar(Math.max(0.01, d.s0 * (1 - k)));
      d.root.position.z = d.z0 + 24 * k;
      if (d.tx != null) {
        d.root.position.x = d.x0 + (d.tx - d.x0) * k * 0.7;
        d.root.position.y = d.y0 + (d.ty - d.y0) * k * 0.7;
      }
    }
    this.shake *= Math.exp(-9 * dt);
    if (this.shake < 0.05) this.shake = 0;
  }

  clear() {
    for (const p of this.parts) this.scene.remove(p.m);
    for (const f of this.flats) { this.scene.remove(f.m); f.mat.dispose(); }
    for (const d of this.dis) this.scene.remove(d.root);
    this.dis.length = 0;
    this.parts.length = 0;
    this.flats.length = 0;
  }
}
