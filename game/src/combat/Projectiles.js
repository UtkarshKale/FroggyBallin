import * as THREE from 'three';
import { CFG } from '../config.js';

const geo = new THREE.SphereGeometry(1, 10, 8);

// Shared projectile system. Teams: 'player' (also reflected shots), 'bug', 'ghost'.
export class Projectiles {
  constructor(game) {
    this.g = game;
    this.list = [];
  }

  spawn({ x, y, z = 26, angle, speed, dmg, team, radius = 9, life = 2.6, color = 0xffffff, owner = null, fromBoss = false, burn = false, tag = '' }) {
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(radius);
    mesh.position.set(x, y, z);
    const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }));
    glow.scale.setScalar(1.9);
    mesh.add(glow);
    this.g.world.scene.add(mesh);
    if (team !== 'player') this.g.world.tag(mesh, 'danger');
    const p = { x, y, z, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, dmg, team, radius, life, mesh, mat, owner, fromBoss, burn, reflected: false, dead: false, tag, color };
    this.list.push(p);
    return p;
  }

  _remove(p, fxColor) {
    p.dead = true;
    this.g.world.scene.remove(p.mesh);
    p.mat.dispose();
    p.mesh.children[0].material.dispose();
    if (fxColor !== false) this.g.fx.burst(p.x, p.y, p.z, fxColor ?? p.color, 5, 110, 0.3, 2.2);
  }

  reflect(p, newTeam, aimAt, mult = 2) {
    const speed = Math.hypot(p.vx, p.vy) * 1.5;
    let ang;
    if (aimAt && !aimAt.dead) ang = Math.atan2(aimAt.y - p.y, aimAt.x - p.x);
    else ang = Math.atan2(-p.vy, -p.vx);
    p.vx = Math.cos(ang) * speed;
    p.vy = Math.sin(ang) * speed;
    p.team = newTeam;
    this.g.world.tag(p.mesh, newTeam === 'player' ? null : 'danger');
    p.dmg *= p.fromBoss ? 3 : mult;
    p.reflected = true;
    p.life = 3;
    p.mat.color.setHex(0xffffff);
    p.mesh.scale.multiplyScalar(1.25);
    this.g.fx.ring(p.x, p.y, p.z, 0xffffff, 6, 40, 0.25);
  }

  update(dt, esc = 1) {
    const g = this.g;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.dead) { this.list.splice(i, 1); continue; }
      const k = p.team === 'player' ? 1 : esc;
      p.x += p.vx * dt * k;
      p.y += p.vy * dt * k;
      p.life -= dt;
      p.mesh.position.set(p.x, p.y, p.z);
      // Boss 'shift' ult: hostile shots are drawn off from where they really are.
      if (p.team === 'bug' && g.bossUltOn('shift')) { const s = g.simT; p.mesh.position.x += Math.sin(s * 3 + p.y * 0.01) * 45; p.mesh.position.y += Math.cos(s * 2.3 + p.x * 0.01) * 45; }
      const half = g.world.level?.half || CFG.ARENA_HALF;
      if (p.life <= 0 || Math.abs(p.x) > half + 100 || Math.abs(p.y) > half + 100 || g.world.blocked(p.x, p.y, p.radius * 0.5)) {
        this._remove(p);
        continue;
      }
      if (p.team === 'player') this._hitBugsAndGhost(p);
      else if (p.team === 'bug') this._hitPlayerOrGhost(p);
      else if (p.team === 'ghost') this._hitPlayerOrBugs(p);
    }
  }

  _touch(p, t) { return !t.dead && Math.hypot(p.x - t.x, p.y - t.y) < p.radius + t.radius; }

  _front(t, p) {
    if (!t.shell) return false;
    const m = Math.hypot(p.vx, p.vy) || 1;
    return (p.vx / m) * Math.cos(t.yaw) + (p.vy / m) * Math.sin(t.yaw) < -0.35;
  }

  _hitBug(p, t) {
    const g = this.g;
    if (this._front(t, p)) {
      // Shell reflects our shot back at the frog.
      g.sfx.play('parry');
      g.fx.burst(p.x, p.y, p.z, 0xffffff, 6, 150, 0.25, 2);
      this.reflect(p, 'bug', g.player, 1);
      p.fromBoss = false;
      p.dmg = Math.min(p.dmg, 12);
      return true;
    }
    if (!p.reflected && p.owner === g.player) g.stats.hits++;
    g.damageTarget(t, p.dmg, { team: 'player', burn: p.burn, from: p });
    if (p.reflected) g.addPosture(t, CFG.POSTURE.reflectHit);
    this._remove(p);
    return true;
  }

  _hitBugsAndGhost(p) {
    const g = this.g;
    for (const e of g.enemies) {
      if (this._touch(p, e) && this._hitBug(p, e)) return;
    }
    if (g.boss && g.boss.active && this._touch(p, g.boss) && this._hitBug(p, g.boss)) return;
    if (g.ghost && this._touch(p, g.ghost)) {
      if (!p.reflected) g.stats.hits++;
      g.damageTarget(g.ghost, p.dmg, { team: 'player', burn: p.burn });
      if (p.reflected) g.addPosture(g.ghost, CFG.POSTURE.reflectHit);
      this._remove(p);
    }
  }

  _hitPlayerOrGhost(p) {
    const g = this.g;
    if (this._touch(p, g.player)) {
      const res = g.player.takeHit(p.dmg, p.owner || p, { parryable: true, proj: p });
      if (res === 'perfect') this.reflect(p, 'player', p.owner && !p.owner.dead ? p.owner : null);
      else {
        if (p.tag === 'web' && res === 'hit') { g.player.webbedT = CFG.WEB.shotSlowTime; g.hud.flash('Webbed!', '#d8d8ff'); }
        this._remove(p);
      }
      return;
    }
    if (g.ghost && this._touch(p, g.ghost)) {
      g.damageTarget(g.ghost, p.dmg, { team: 'bug' });
      this._remove(p);
    }
  }

  _hitPlayerOrBugs(p) {
    const g = this.g;
    if (this._touch(p, g.player)) {
      const res = g.player.takeHit(p.dmg, g.ghost || p, { parryable: true, proj: p });
      if (res === 'perfect') this.reflect(p, 'player', g.ghost);
      else this._remove(p);
      return;
    }
    for (const e of g.enemies) {
      if (this._touch(p, e)) { g.damageTarget(e, p.dmg, { team: 'ghost' }); this._remove(p); return; }
    }
    if (g.boss && g.boss.active && this._touch(p, g.boss)) { g.damageTarget(g.boss, p.dmg, { team: 'ghost' }); this._remove(p); }
  }

  clear() {
    for (const p of this.list) if (!p.dead) this._remove(p, false);
    this.list.length = 0;
  }
}
