import { CFG } from '../config.js';

const r1 = (v) => Math.round(v * 10) / 10;

// Records the player's transform (20 Hz) and action events so the run can be replayed as a ghost.
// Event types: 's' slash(step), 'g' shoot(yaw), 'p' parry, 't' tongue(yaw), 'd' dodge.
export class Recorder {
  constructor() { this.reset(); }
  reset() { this.samples = []; this.events = []; this.next = 0; this.t = 0; }
  sample(t, p) {
    this.t = t;
    if (t >= this.next) {
      this.samples.push([r1(t), r1(p.x), r1(p.y), r1(p.z), +p.yaw.toFixed(2), p.moving ? 1 : 0]);
      this.next = t + CFG.SAMPLE_DT;
    }
  }
  event(type, arg = 0) { this.events.push([r1(this.t * 10) / 10, type, arg]); }
  finish(duration, p) {
    this.samples.push([r1(duration), r1(p.x), r1(p.y), r1(p.z), +p.yaw.toFixed(2), 0]);
    return { duration, samples: this.samples, events: this.events };
  }
}
