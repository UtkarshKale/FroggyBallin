import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeActor, ghostify } from '../core/Assets.js';
import { lerp, lerpAngle } from '../core/math.js';
import { initPosture, tickPosture } from '../combat/Posture.js';

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 36px sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#9ff';
  g.strokeStyle = '#046';
  g.lineWidth = 6;
  g.strokeText(text, 128, 44);
  g.fillText(text, 128, 44);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  spr.scale.set(80, 20, 1);
  spr.position.z = 70;
  return spr;
}

// Replays a recorded run. Its sword swings and bullets are real and hurt the player and bugs.
export class Ghost {
  constructor(game, run, loopNo) {
    this.g = game;
    this.team = 'ghost';
    this.run = run;
    this.radius = 16;
    this.hp = this.maxHp = CFG.GHOST.hp;
    this.dead = false;
    this.arrived = false;
    this.playT = 0;
    this.si = 0;
    this.ei = 0;
    this.slowT = 0;
    this.flashT = 0;
    this.burn = 0;
    this.stagger = 0;
    this.big = true;
    this.frozenT = 0;
    this.stunned = false;
    initPosture(this, 90);
    this.echoCd = CFG.GHOST.echoEvery;
    this.echoWind = 0;
    this.trailT = 0;
    this.t = 0;
    const s = run.samples[0];
    this.x = s[1]; this.y = s[2]; this.z = 0; this.yaw = s[4];
    this.root = makeActor('tode', CFG.PLAYER.height, 0x66ddff);
    this.mat = ghostify(this.root, 0x66ddff, 0.5);
    this.root.add(makeLabel(`LOOP ${loopNo - 1}`));
    game.world.scene.add(this.root);
    this.sync();
  }

  get progress() { return Math.min(1, this.playT / this.run.duration); }

  onParried() {
    this.g.damageTarget(this, 25, { team: 'player' });
    this.g.addPosture(this, 35);
  }

  // Posture break: the replay freezes for a few seconds.
  stun(t) {
    this.frozenT = t;
    this.stunned = true;
  }

  update(dt) {
    if (this.dead) return;
    const g = this.g;
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    tickPosture(this, dt, 10);
    if (this.frozenT > 0) {
      this.frozenT -= dt;
      if (this.frozenT <= 0) this.stunned = false;
      this.sync();
      return;
    }
    if (this.burn > 0) {
      this.burn -= dt; this.hp -= 6 * dt;
      if (this.hp <= 0) { this.die('player'); return; }
    }
    // Playback time (slowed by the Time Snail or a tongue lash)
    this.playT += dt * (this.slowT > 0 ? 0.5 : 1);
    const S = this.run.samples;
    while (this.si < S.length - 2 && S[this.si + 1][0] <= this.playT) this.si++;
    const a = S[this.si], b = S[Math.min(this.si + 1, S.length - 1)];
    const k = b[0] > a[0] ? Math.min(1, Math.max(0, (this.playT - a[0]) / (b[0] - a[0]))) : 1;
    this.x = lerp(a[1], b[1], k);
    this.y = lerp(a[2], b[2], k);
    this.z = lerp(a[3], b[3], k);
    this.yaw = lerpAngle(a[4], b[4], k);

    const E = this.run.events;
    while (this.ei < E.length && E[this.ei][0] <= this.playT) {
      this.fire(E[this.ei]);
      this.ei++;
    }

    // Afterimage trail
    this.trailT -= dt;
    if (this.trailT <= 0) { this.trailT = 0.06; g.fx.burst(this.x, this.y, 20, 0x66ddff, 1, 20, 0.5, 4, 0); }

    // Echo bolt: the past self actively hunts the player.
    const p = g.player;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (this.echoWind > 0) {
      this.echoWind -= dt;
      if (this.echoWind <= 0) {
        g.projectiles.spawn({ x: this.x, y: this.y, z: 30, angle: Math.atan2(p.y - this.y, p.x - this.x), speed: 300, dmg: CFG.GHOST.echoDmg, team: 'ghost', radius: 10, color: 0x66ddff, owner: this });
        g.sfx.play('echo');
      }
    } else {
      this.echoCd -= dt;
      if (this.echoCd <= 0 && d < CFG.GHOST.echoRange && !p.dead) {
        this.echoCd = CFG.GHOST.echoEvery;
        this.echoWind = 0.45;
        g.sfx.play('warn');
      }
    }

    if (!this.arrived && this.playT >= this.run.duration) {
      this.arrived = true;
      g.onGhostArrived();
    }
    this.sync();
  }

  fire(ev) {
    const g = this.g;
    const [, type, arg] = ev;
    if (type === 's') {
      g.sfx.play('slash');
      g.swordStrike({ team: 'ghost', x: this.x, y: this.y, yaw: this.yaw, step: arg, src: this });
    } else if (type === 'g') {
      g.projectiles.spawn({ x: this.x + Math.cos(arg) * 30, y: this.y + Math.sin(arg) * 30, z: 26, angle: arg, speed: CFG.GUN.speed, dmg: CFG.GUN.dmg, team: 'ghost', radius: CFG.GUN.radius, color: 0x66ddff, owner: this });
    } else if (type === 'p') {
      g.fx.ring(this.x, this.y, 25, 0x66ddff, 8, 50, 0.3);
    } else if (type === 't') {
      g.fx.ring(this.x + Math.cos(arg) * 60, this.y + Math.sin(arg) * 60, 22, 0xff88aa, 4, 20, 0.2);
    }
  }

  sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.z = this.yaw;
    this.mat.color.setHex(this.flashT > 0 ? 0xffffff : 0x66ddff);
    this.mat.opacity = 0.45 + 0.1 * Math.sin(this.t * 6);
  }

  die(team) {
    if (this.dead) return;
    this.dead = true;
    const g = this.g;
    g.world.scene.remove(this.root);
    g.fx.burst(this.x, this.y, 30, 0xffd700, 40, 380, 1.0, 4);
    g.fx.burst(this.x, this.y, 30, 0x66ddff, 30, 260, 0.8, 3);
    g.fx.ring(this.x, this.y, 20, 0xffd700, 20, 300, 0.6);
    g.fx.addShake(14);
    g.sfx.play('shatter');
    if (team === 'player') g.stats.ghostKilledAt = g.simT;
    g.onGhostDead();
  }
}
