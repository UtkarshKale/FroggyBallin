import * as THREE from 'three';
import { stdMat } from '../core/Assets.js';

// Procedural, code-drawn level dressing. Everything is instanced so it stays cheap; counts drop in Low quality.
const THEMES = {
  meadow:    { grass: 900, flowers: 140, mush: 40, rocks: 18, logs: 0, reeds: 0, pads: 0, crystals: 0, rays: true, particles: 'leaves', sky: [0x5cb8ff, 0xcfeeff], flower: [0xff5f8a, 0xffd23f, 0xffffff, 0xb48cff], grassCol: 0x2f8f2f },
  hollow:    { grass: 500, flowers: 20, mush: 80, rocks: 30, logs: 14, reeds: 0, pads: 0, crystals: 0, rays: false, particles: 'spores', fireflies: 40, sky: [0x0b1418, 0x253b3a], flower: [0xa070ff], grassCol: 0x274d2a, glowMush: true },
  clockpond: { grass: 300, flowers: 30, mush: 20, rocks: 20, logs: 4, reeds: 120, pads: 60, crystals: 0, rays: false, particles: 'motes', fireflies: 60, sky: [0x050b1c, 0x1a3a5e], flower: [0x66ddff, 0xffffff], grassCol: 0x1d3f4f },
  loopsend:  { grass: 120, flowers: 0, mush: 10, rocks: 40, logs: 0, reeds: 0, pads: 0, crystals: 60, rays: false, particles: 'motes', fireflies: 20, sky: [0x070312, 0x3a1a60], flower: [0xffd700], grassCol: 0x3a2a5a },
  mirewood:  { grass: 600, flowers: 30, mush: 50, rocks: 25, logs: 16, reeds: 160, pads: 40, crystals: 0, rays: false, particles: 'spores', fireflies: 50, sky: [0x0d140f, 0x34493a], flower: [0xd8d8ff], grassCol: 0x2f4a30, glowMush: true },
  bossrush:  { grass: 200, flowers: 0, mush: 0, rocks: 40, logs: 0, reeds: 0, pads: 0, crystals: 20, rays: false, particles: 'embers', sky: [0x0a0305, 0x4a1420], flower: [0xff4455], grassCol: 0x4a1a24 },
  survival:  { grass: 700, flowers: 100, mush: 40, rocks: 16, logs: 0, reeds: 0, pads: 0, crystals: 0, rays: true, particles: 'leaves', sky: [0x5cb8ff, 0xcfeeff], flower: [0xff5f8a, 0xffd23f, 0xffffff], grassCol: 0x2f8f2f },
};

function gradientTex(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#' + new THREE.Color(top).getHexString());
  gr.addColorStop(0.55, '#' + new THREE.Color(bottom).getHexString());
  gr.addColorStop(1, '#' + new THREE.Color(bottom).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Checker floor kept (course look) but painted on a canvas with speckle noise and grass strokes.
export function groundTexture(c1, c2, rng) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = c1; g.fillRect(0, 0, N, N); g.fillRect(N / 2, N / 2, N / 2, N / 2);
  g.fillStyle = c2; g.fillRect(N / 2, 0, N / 2, N / 2); g.fillRect(0, N / 2, N / 2, N / 2);
  for (let i = 0; i < 1400; i++) {
    const x = rng.next() * N, y = rng.next() * N, l = rng.next();
    g.fillStyle = l < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    g.fillRect(x, y, 1 + rng.next() * 2, 1 + rng.next() * 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1;
  for (let i = 0; i < 260; i++) { const x = rng.next() * N, y = rng.next() * N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng.next() - 0.5) * 3, y - 3 - rng.next() * 4); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, N / 2 - 1, N, 2); g.fillRect(N / 2 - 1, 0, 2, N);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function scatter(group, geo, mat, count, rng, half, place) {
  if (count <= 0) return null;
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < count * 3 && n < count; i++) {
    const x = rng.range(-half, half), y = rng.range(-half, half);
    const r = place(x, y, rng, col);
    if (!r) continue;
    // ZYX: tilt/lay the mesh first (rx, ry), then yaw it around the world up axis
    p.set(x, y, r.z || 0); e.set(r.rx || 0, r.ry || 0, r.rz ?? rng.range(0, 6.28), 'ZYX'); q.setFromEuler(e); s.set(r.sx ?? r.s, r.sy ?? r.s, r.sz ?? r.s);
    m.compose(p, q, s);
    im.setMatrixAt(n, m);
    if (r.col) im.setColorAt(n, col);
    n++;
  }
  im.count = n;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  group.add(im);
  return im;
}

export function buildDecor(level, group, rng, low, keepOut) {
  const T = THEMES[level.id] || THEMES.meadow;
  const half = level.half || 1000;
  const k = low ? 0.35 : 1;
  const free = (x, y, r = 60) => !keepOut.some((o) => Math.hypot(o.x - x, o.y - y) < (o.r || 0) + r);
  // Sky dome with a vertical gradient
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5200, 24, 12), new THREE.MeshBasicMaterial({ map: gradientTex(T.sky[0], T.sky[1]), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.rotation.x = Math.PI / 2;
  sky.renderOrder = -10;
  group.add(sky);
  // Grass tufts
  scatter(group, new THREE.ConeGeometry(2.4, 13, 4), stdMat(0xffffff, { roughness: 1 }), Math.round(T.grass * k), rng, half, (x, y, r, c) => free(x, y, 30) && (c.setHex(T.grassCol).offsetHSL(0, 0, 0.08 + (r.next() - 0.5) * 0.12), { z: 6, rx: Math.PI / 2 + (r.next() - 0.5) * 0.3, s: 0.7 + r.next() * 0.8, col: true }));
  // Flowers: stem + head
  const fl = Math.round(T.flowers * k);
  if (fl) {
    const pos = [];
    scatter(group, new THREE.CylinderGeometry(0.6, 0.6, 10, 4), stdMat(0x2e6b2a), fl, rng, half, (x, y) => { if (!free(x, y, 30)) return null; pos.push([x, y]); return { z: 5, rx: Math.PI / 2, s: 1 }; });
    const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.6, 0), stdMat(0xffffff), pos.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    pos.forEach(([x, y], i) => { m.makeTranslation(x, y, 11); heads.setMatrixAt(i, m); heads.setColorAt(i, col.setHex(T.flower[i % T.flower.length])); });
    heads.instanceMatrix.needsUpdate = true; if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    group.add(heads);
  }
  // Mushrooms (stems + caps), glowing in dark levels
  const mu = Math.round(T.mush * k);
  if (mu) {
    const pos = [];
    scatter(group, new THREE.CylinderGeometry(2, 2.4, 14, 6), stdMat(0xf5f5dc), mu, rng, half, (x, y, r) => { if (!free(x, y, 40)) return null; const s = 0.6 + r.next() * 1.2; pos.push([x, y, s]); return { z: 7 * s, rx: Math.PI / 2, s }; });
    const capMat = T.glowMush ? stdMat(0x9a6cff, { emissive: 0x3a1a88 }) : stdMat(0xff5577);
    const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat, pos.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    pos.forEach(([x, y, s], i) => { m.compose(new THREE.Vector3(x, y, 14 * s), q, new THREE.Vector3(s, s, s)); caps.setMatrixAt(i, m); });
    caps.instanceMatrix.needsUpdate = true;
    group.add(caps);
  }
  // Rocks
  scatter(group, new THREE.DodecahedronGeometry(10, 0), stdMat(0xffffff, { roughness: 0.95 }), Math.round(T.rocks * k), rng, half, (x, y, r, c) => free(x, y, 70) && (c.setHex(0x9a9aa4).offsetHSL(0, 0, (r.next() - 0.5) * 0.2), { z: 3, s: 0.6 + r.next() * 2.2, sz: 0.5 + r.next() * 0.7, rx: r.next(), col: true }));
  // Logs
  scatter(group, new THREE.CylinderGeometry(9, 10, 80, 10), stdMat(0x5a3a26), Math.round(T.logs * k), rng, half, (x, y, r) => free(x, y, 110) && { z: 8, s: 0.7 + r.next() * 0.6 });
  // Reeds
  scatter(group, new THREE.CylinderGeometry(1.2, 2, 60, 4), stdMat(0x3d5a2a), Math.round(T.reeds * k), rng, half, (x, y, r) => free(x, y, 40) && { z: 25, rx: Math.PI / 2 + (r.next() - 0.5) * 0.25, s: 0.6 + r.next() * 0.9 });
  // Lily pads
  scatter(group, new THREE.CylinderGeometry(18, 18, 1.5, 18, 1, false, 0.3, 5.6), stdMat(0x3f9a44), Math.round(T.pads * k), rng, half, (x, y, r) => free(x, y, 50) && { z: 0.6, rx: Math.PI / 2, s: 0.5 + r.next() * 1.4 });
  // Crystals (final / rush)
  scatter(group, new THREE.OctahedronGeometry(8, 0), stdMat(0xb08cff, { emissive: 0x4a2a9a, metalness: 0.3, roughness: 0.2 }), Math.round(T.crystals * k), rng, half, (x, y, r) => free(x, y, 60) && { z: 10, s: 0.8 + r.next() * 1.8, sz: 1.5 + r.next() * 2, rx: (r.next() - 0.5) * 0.4 });
  // Boss arena: ring of standing stones with flickering lanterns
  const torches = [];
  if (level.bossZone) {
    const bz = level.bossZone, R = Math.min(bz.r * 0.9, 380);
    const n = low ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = bz.x + Math.cos(a) * R, y = bz.y + Math.sin(a) * R;
      if (Math.abs(x) > half - 20 || Math.abs(y) > half - 20) continue;
      const st = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 46 + (i % 3) * 10), stdMat(0x6a6a72));
      st.position.set(x, y, 23 + (i % 3) * 5); st.rotation.z = a;
      const fl = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
      fl.position.set(x, y, 60 + (i % 3) * 10);
      group.add(st, fl);
      torches.push(fl);
    }
  }
  // God rays (daylight levels)
  const rays = [];
  if (T.rays && !low) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,250,220,0.0)'); gr.addColorStop(0.3, 'rgba(255,250,220,0.35)'); gr.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 900), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.position.set(rng.range(-half, half), rng.range(-half, half), 380);
      m.rotation.set(Math.PI / 2 - 0.35, 0, rng.range(0, 3.14));
      group.add(m);
      rays.push(m);
    }
  }
  // Ambient particles: leaves / spores / motes / embers + fireflies
  const parts = [];
  const pCount = low ? 0 : 160;
  if (T.particles && pCount) {
    const col = { leaves: 0x9adf5a, spores: 0xc8ff9a, motes: 0xfff2a0, embers: 0xff7a3a }[T.particles];
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(pCount * 3), sp = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) { arr[i * 3] = rng.range(-half, half); arr[i * 3 + 1] = rng.range(-half, half); arr[i * 3 + 2] = rng.range(10, 300); sp[i] = rng.range(0.5, 1.5); }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size: T.particles === 'leaves' ? 5 : 3.5, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.userData = { sp, kind: T.particles, half };
    group.add(pts);
    parts.push(pts);
  }
  const fc = Math.round((T.fireflies || 0) * k);
  if (fc && !low) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(fc * 3), sp = new Float32Array(fc);
    for (let i = 0; i < fc; i++) { arr[i * 3] = rng.range(-half, half); arr[i * 3 + 1] = rng.range(-half, half); arr[i * 3 + 2] = rng.range(15, 90); sp[i] = rng.range(0, 6.28); }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe27a, size: 6, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.userData = { sp, kind: 'fireflies', half };
    group.add(pts);
    parts.push(pts);
  }
  return { parts, rays, torches, t: 0 };
}

export function updateDecor(d, dt) {
  if (!d) return;
  d.t += dt;
  for (const p of d.parts) {
    const a = p.geometry.attributes.position, sp = p.userData.sp, h = p.userData.half, kind = p.userData.kind;
    for (let i = 0; i < sp.length; i++) {
      if (kind === 'fireflies') { a.array[i * 3] += Math.cos(d.t * 0.7 + sp[i]) * 14 * dt; a.array[i * 3 + 1] += Math.sin(d.t * 0.9 + sp[i]) * 14 * dt; a.array[i * 3 + 2] += Math.sin(d.t * 2 + sp[i]) * 6 * dt; continue; }
      const fall = kind === 'embers' ? -18 : kind === 'motes' ? -4 : 14;
      a.array[i * 3] += Math.sin(d.t * sp[i] + i) * 12 * dt + 8 * dt;
      a.array[i * 3 + 2] -= fall * sp[i] * dt;
      if (a.array[i * 3 + 2] < 2) a.array[i * 3 + 2] = 300;
      if (a.array[i * 3 + 2] > 320) a.array[i * 3 + 2] = 5;
      if (a.array[i * 3] > h) a.array[i * 3] = -h;
    }
    a.needsUpdate = true;
    if (kind === 'fireflies') p.material.opacity = 0.6 + 0.35 * Math.sin(d.t * 3);
  }
  for (const r of d.rays) r.material.opacity = 0.6 + 0.4 * Math.sin(d.t * 0.4 + r.position.x);
  for (const tch of d.torches) tch.scale.setScalar(0.85 + 0.3 * Math.abs(Math.sin(d.t * 9 + tch.position.x)));
}
