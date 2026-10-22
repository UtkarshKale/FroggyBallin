import * as THREE from 'three';
import { POWERUPS, CFG } from '../config.js';

const geo = new THREE.SphereGeometry(1, 12, 10);
const ringGeo = new THREE.TorusGeometry(1, 0.12, 6, 20);
const flatRing = new THREE.RingGeometry(0.8, 1, 32);
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
let haloTex = null;
function halo() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

const EXTRA = {
  droplet: { color: 0x55ff55, size: 5 },
  bullet:  { color: 0xffd23f, size: 7 },
};

// Power-ups, ammo and healing droplets.
export class Pickups {
  constructor(game) {
    this.g = game;
    this.list = [];
  }

  spawn(type, x, y) {
    const def = POWERUPS[type] || EXTRA[type];
    if (!def) return;
    const size = def.size || 14;
    const group = new THREE.Group();
    const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: def.color }));
    core.scale.setScalar(size);
    group.add(core);
    if (POWERUPS[type]) {
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      ring.scale.setScalar(size * 1.7);
      group.add(ring);
      group.userData.ring = ring;
      // glow halo + spinning core shape + pulsing ground ring + a light beam when it drops
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: def.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      h.scale.setScalar(size * 4.5);
      group.add(h);
      core.geometry = new THREE.OctahedronGeometry(1, 0);
      const gring = new THREE.Mesh(flatRing, new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      gring.scale.setScalar(size * 2.2);
      this.g.world.scene.add(gring);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.rotation.x = Math.PI / 2; beam.scale.set(size * 0.8, 600, size * 0.8);
      this.g.world.scene.add(beam);
      group.userData.extra = { gring, beam, core };
      this.g.sfx.play('drop');
    }
    group.position.set(x, y, 30);
    this.g.world.scene.add(group);
    this.g.world.tag(group, type === 'droplet' ? 'heal' : 'actor');
    const homing = type === 'droplet';
    this.list.push({ type, x, y, group, t: Math.random() * 6, age: 0, homing, size, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: homing ? 12 : 40 });
  }

  update(dt) {
    const pl = this.g.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt; p.age += dt; p.life -= dt;
      if (p.homing) {
        if (p.age > 0.35) {
          const a = Math.atan2(pl.y - p.y, pl.x - p.x);
          const sp = 520;
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        } else { p.vx *= 0.94; p.vy *= 0.94; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      // Magnet Tongue: every pickup in range drifts to the frog
      if (!p.homing && pl.pu.mag > 0) {
        const dm = Math.hypot(pl.x - p.x, pl.y - p.y);
        if (dm < CFG.POWERUP.magnetRange) { const a = Math.atan2(pl.y - p.y, pl.x - p.x); p.x += Math.cos(a) * 380 * dt; p.y += Math.sin(a) * 380 * dt; }
      }
      p.group.position.set(p.x, p.y, 30 + Math.sin(p.t * 4) * 6);
      if (p.group.userData.ring) p.group.userData.ring.rotation.x += dt * 3;
      const ex = p.group.userData.extra;
      if (ex) {
        ex.core.rotation.z += dt * 2.5; ex.core.rotation.x = 0.4;
        ex.gring.position.set(p.x, p.y, 1.5);
        ex.gring.scale.setScalar(p.size * (2 + 0.35 * Math.sin(p.t * 5)));
        ex.beam.position.set(p.x, p.y, 300);
        ex.beam.material.opacity = Math.max(0, 0.45 * (1 - p.age / 1.2));
        ex.beam.visible = p.age < 1.2;
      }
      const d = Math.hypot(pl.x - p.x, pl.y - p.y);
      if (p.life <= 0 || (d < pl.radius + 26 && !pl.dead && p.age > 0.2)) {
        if (p.life > 0) this.g.collect(p.type);
        this._rmExtra(p);
        this.g.world.scene.remove(p.group);
        this.list.splice(i, 1);
      }
    }
  }

  _rmExtra(p) {
    const ex = p.group.userData.extra;
    if (!ex) return;
    this.g.world.scene.remove(ex.gring, ex.beam);
    ex.gring.material.dispose(); ex.beam.material.dispose();
  }

  clear() {
    for (const p of this.list) { this._rmExtra(p); this.g.world.scene.remove(p.group); }
    this.list.length = 0;
  }
}
