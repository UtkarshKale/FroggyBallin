import * as THREE from 'three';
import { CFG } from '../config.js';

// Sticky spider-web patches on the ground. Standing in one slows the frog.
const discGeo = new THREE.CircleGeometry(1, 28);
const ringGeo = new THREE.RingGeometry(0.96, 1, 28);
const spokeGeo = new THREE.PlaneGeometry(1, 0.03);

export class Webs {
  constructor(game) {
    this.g = game;
    this.list = [];
  }

  add(x, y, r = CFG.WEB.r, life = CFG.WEB.life) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xeef0ff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const fill = new THREE.MeshBasicMaterial({ color: 0xc8c8e8, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(discGeo, fill));
    for (const k of [0.35, 0.68, 1]) { const m = new THREE.Mesh(ringGeo, mat); m.scale.setScalar(k); grp.add(m); }
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(spokeGeo, mat);
      s.rotation.z = (i / 8) * Math.PI;
      s.scale.set(2, 1, 1);
      grp.add(s);
    }
    grp.position.set(x, y, 1.5);
    grp.scale.setScalar(r * 0.2);
    this.g.world.scene.add(grp);
    this.g.world.tag(grp, 'danger');
    const w = { x, y, r, life, max: life, grp, mats: [mat, fill], grow: 0 };
    this.list.push(w);
    return w;
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      w.life -= dt;
      w.grow = Math.min(1, w.grow + dt * 5);
      w.grp.scale.setScalar(w.r * (0.2 + 0.8 * w.grow));
      if (w.life < 1) { w.mats[0].opacity = 0.55 * w.life; w.mats[1].opacity = 0.14 * w.life; }
      if (w.life <= 0) this._remove(i);
    }
  }

  slowAt(x, y) {
    for (const w of this.list) if (Math.hypot(x - w.x, y - w.y) < w.r) return CFG.WEB.slow;
    return 1;
  }

  _remove(i) {
    const w = this.list[i];
    this.g.world.scene.remove(w.grp);
    w.mats.forEach((m) => m.dispose());
    this.list.splice(i, 1);
  }

  clear() { for (let i = this.list.length - 1; i >= 0; i--) this._remove(i); }
}
