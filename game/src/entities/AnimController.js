import { CFG } from '../config.js';

// Small animation controller with weighted pose states and cross-fades.
// Each state is a function returning a pose { px, py, pz, rx, ry, rz, sx, sy, sz } (offsets / multipliers on a body
// group). The active state's weight rises to 1 over its blend time while the others fade out, and the result is the
// weighted average. Additive layers (flinch, recoil, squash impulses) are summed on top by the caller.
export const ZERO = () => ({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 });
const KEYS = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'];

export class AnimController {
  constructor(states, blend = CFG.ANIM.blend) {
    this.states = states;        // name -> (t, ctx) => pose
    this.blend = blend;          // name -> seconds
    this.w = {};
    this.t = {};                 // time since each state became active
    for (const s of Object.keys(states)) { this.w[s] = 0; this.t[s] = 0; }
    this.active = Object.keys(states)[0];
    this.w[this.active] = 1;
    this.pose = ZERO();
  }

  set(name) {
    if (name === this.active || !this.states[name]) return;
    this.active = name;
    this.t[name] = 0;
  }

  update(dt, ctx) {
    const bt = Math.max(0.01, this.blend[this.active] ?? 0.12);
    const rate = dt / bt;
    let sum = 0;
    for (const s in this.w) {
      const target = s === this.active ? 1 : 0;
      const d = target - this.w[s];
      this.w[s] += Math.max(-rate, Math.min(rate, d));
      this.t[s] += dt;
      sum += this.w[s];
    }
    const out = this.pose;
    for (const k of KEYS) out[k] = 0;
    for (const s in this.w) {
      const w = this.w[s];
      if (w <= 0.0001) continue;
      const p = this.states[s](this.t[s], ctx);
      for (const k of KEYS) out[k] += (p[k] ?? (k[0] === 's' ? 1 : 0)) * w;
    }
    if (sum > 0) for (const k of KEYS) out[k] /= sum;
    return out;
  }
}

// Apply a pose (plus optional additive layer) to an Object3D.
export function applyPose(o, p, add = null) {
  o.position.set(p.px + (add ? add.px : 0), p.py + (add ? add.py : 0), p.pz + (add ? add.pz : 0));
  o.rotation.set(p.rx + (add ? add.rx : 0), p.ry + (add ? add.ry : 0), p.rz + (add ? add.rz : 0));
  o.scale.set(p.sx * (add ? add.sx : 1), p.sy * (add ? add.sy : 1), p.sz * (add ? add.sz : 1));
}
