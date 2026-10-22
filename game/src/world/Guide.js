import * as THREE from 'three';
import { CFG } from '../config.js';
import { Settings } from '../core/Settings.js';

// Objective arrow: a small glowing 3D triangle that circles Tode at his feet and points to what to do next
// (the next swarm, the boss arena, the ghost, or the open goal). Hidden while bugs are close or a boss fight is on.
export class Guide {
  constructor(game) {
    this.g = game;
    const shape = new THREE.Shape();
    shape.moveTo(14, 0); shape.lineTo(-8, 9); shape.lineTo(-3, 0); shape.lineTo(-8, -9); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthTest: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 8;
    this.mesh.scale.setScalar(CFG.GUIDE.scale);
    this.t = 0;
    this.alpha = 0;
    // distance readout
    const c = document.createElement('canvas'); c.width = 128; c.height = 40;
    this.lab = { c, ctx: c.getContext('2d'), tex: new THREE.CanvasTexture(c), key: '' };
    this.lab.tex.colorSpace = THREE.SRGBColorSpace;
    this.spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.lab.tex, transparent: true, depthTest: false }));
    this.spr.scale.set(28, 9, 1); this.spr.renderOrder = 9;
    game.world.scene.add(this.mesh, this.spr);
    game.world.tag(this.mesh, 'actor');
  }

  target() {
    const g = this.g, lv = g.levelCfg, p = g.player;
    if (!lv || g.mode === 'survival' || g.mode === 'bossrush') return null;
    if (g.boss && g.boss.active && !g.boss.dead) return null;
    for (const e of g.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < CFG.GUIDE.clearRadius) return null;
    if (g.waves && g.waves.length) return { ...g.waves[0].z, kind: 'swarm' };
    const zi = (lv.zones || []).findIndex((z, i) => !g.zoneDone[i]);
    if (zi >= 0) return { ...lv.zones[zi], kind: 'swarm' };
    if (lv.boss && !g.bossStarted) return { ...lv.bossZone, kind: 'boss' };
    if (g.ghost && !g.ghost.dead) return { x: g.ghost.x, y: g.ghost.y, kind: 'ghost' };
    return { ...lv.goal, kind: 'goal' };
  }

  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    const tg = g.state === 'PLAYING' && !p.dead && Settings.get('guide') ? this.target() : null;
    this.alpha += ((tg ? 1 : 0) - this.alpha) * (1 - Math.exp(-6 * dt));
    this.mesh.visible = this.spr.visible = this.alpha > 0.02;
    if (!this.mesh.visible) return;
    if (tg) this.lastT = tg;
    const t = this.lastT;
    const a = Math.atan2(t.y - p.y, t.x - p.x);
    const R = CFG.GUIDE.radius + Math.sin(this.t * 5) * 4;
    this.mesh.position.set(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, CFG.GUIDE.height + Math.sin(this.t * 3) * 2);
    this.mesh.rotation.set(0, 0, a);
    this.mat.opacity = 0.9 * this.alpha * (0.75 + 0.25 * Math.sin(this.t * 6));
    // colour per objective: yellow = swarm, red = boss, cyan = ghost, green = goal
    const col = { swarm: 0xffd23f, boss: 0xff3344, ghost: 0x66ddff, goal: 0x33ff77 }[t.kind] || 0xffd23f;
    this.mat.color.setHex(col);
    this.spr.position.set(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z + 16);
    this.spr.material.opacity = this.alpha;
    const dm = Math.round(Math.hypot(t.x - p.x, t.y - p.y) / 10);
    const key = `${dm}|${col}`;
    if (key !== this.lab.key) {
      const L = this.lab, c = L.ctx; L.key = key;
      c.clearRect(0, 0, 128, 40);
      c.font = "900 26px Consolas, 'Courier New', monospace"; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = '#000'; c.strokeText(`${dm}m`, 64, 21);
      c.fillStyle = '#' + col.toString(16).padStart(6, '0'); c.fillText(`${dm}m`, 64, 21);
      L.tex.needsUpdate = true;
    }
  }
}
