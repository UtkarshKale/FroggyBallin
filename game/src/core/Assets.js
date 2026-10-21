import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { CFG } from '../config.js';

const raw = {};
const loader = new GLTFLoader();

export async function preload(names, onEach = null) {
  let done = 0;
  await Promise.all(names.map(async (n) => {
    try {
      const g = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${n}.glb`);
      raw[n] = g.scene;
    } catch (e) {
      console.warn('Model failed to load, using fallback:', n, e);
      raw[n] = null;
    }
    done++;
    if (onEach) onEach(done / names.length, n);
  }));
}

// Z-up actor: root -> holder (facing offset) -> model. Forward of root is +X, feet on z = 0.
export function makeModel(name, targetH, facing = CFG.MODEL_FACING) {
  const src = raw[name];
  if (!src) return null;
  const model = skClone(src);
  model.traverse((o) => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      o.frustumCulled = false;
    }
  });
  model.rotation.x = Math.PI / 2;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.z - box.min.z || 1;
  model.scale.setScalar(targetH / h);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -c.y, -box.min.z);
  const holder = new THREE.Group();
  holder.rotation.z = facing;
  holder.add(model);
  const root = new THREE.Group();
  root.add(holder);
  root.userData.size = box.getSize(new THREE.Vector3());
  return root;
}

export function stdMat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
}

export function blob(color, r, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), stdMat(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

// Primitive frog used if tode.glb cannot load.
export function fallbackFrog(h, color = 0x4caf50) {
  const g = new THREE.Group();
  g.add(blob(color, h * 0.4, 1.1, 1, 0.9, 0, 0, h * 0.4));
  g.add(blob(0xffffff, h * 0.1, 1, 1, 1, h * 0.3, h * 0.17, h * 0.75));
  g.add(blob(0xffffff, h * 0.1, 1, 1, 1, h * 0.3, -h * 0.17, h * 0.75));
  g.add(blob(0x111111, h * 0.05, 1, 1, 1, h * 0.38, h * 0.17, h * 0.77));
  g.add(blob(0x111111, h * 0.05, 1, 1, 1, h * 0.38, -h * 0.17, h * 0.77));
  const root = new THREE.Group();
  root.add(g);
  return root;
}

export function makeActor(name, h, color) {
  return makeModel(name, h) || fallbackFrog(h, color);
}

export function collectFlash(root) {
  const list = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach((m) => {
      if (m.emissive) { m.userData.e0 = m.emissive.getHex(); list.push(m); }
    });
  });
  return list;
}

export function setFlash(list, hex) {
  for (const m of list) m.emissive.setHex(hex == null ? m.userData.e0 : hex);
}

export function ghostify(root, color = 0x66ddff, opacity = 0.5) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  root.traverse((o) => { if (o.isMesh) o.material = mat; });
  return mat;
}
