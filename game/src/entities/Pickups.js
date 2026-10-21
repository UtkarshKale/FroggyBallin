import * as THREE from 'three';
import { POWERUPS } from '../config.js';

const geo = new THREE.SphereGeometry(1, 12, 10);
const ringGeo = new THREE.TorusGeometry(1, 0.12, 6, 20);

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
    }
    group.position.set(x, y, 30);
    this.g.world.scene.add(group);
    this.g.world.tag(group, type === 'droplet' ? 'heal' : 'actor');
    const homing = type === 'droplet';
    this.list.push({ type, x, y, group, t: Math.random() * 6, age: 0, homing, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: homing ? 12 : 40 });
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
      p.group.position.set(p.x, p.y, 30 + Math.sin(p.t * 4) * 6);
      if (p.group.userData.ring) p.group.userData.ring.rotation.x += dt * 3;
      const d = Math.hypot(pl.x - p.x, pl.y - p.y);
      if (p.life <= 0 || (d < pl.radius + 26 && !pl.dead && p.age > 0.2)) {
        if (p.life > 0) this.g.collect(p.type);
        this.g.world.scene.remove(p.group);
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.list) this.g.world.scene.remove(p.group);
    this.list.length = 0;
  }
}
