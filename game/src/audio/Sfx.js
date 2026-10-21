// All sound is synthesized at runtime with WebAudio. No recorded or third-party audio.
class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.intensity = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }
  tone({ f = 440, f2 = null, d = 0.1, type = 'square', v = 0.15, delay = 0, bus = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(bus || this.master);
    o.start(t); o.stop(t + d + 0.02);
  }
  noise({ d = 0.1, v = 0.2, lp = 3000, hp = 0, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass';
    f.frequency.value = hp || lp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + d + 0.02);
  }
  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'slash': this.noise({ d: 0.14, v: 0.18, hp: 1800 }); this.tone({ f: 500, f2: 200, d: 0.12, type: 'sawtooth', v: 0.05 }); break;
      case 'slam': this.noise({ d: 0.3, v: 0.3, lp: 600 }); this.tone({ f: 140, f2: 40, d: 0.3, type: 'sine', v: 0.3 }); break;
      case 'hit': this.noise({ d: 0.08, v: 0.2, lp: 1500 }); this.tone({ f: 180, f2: 80, d: 0.08, type: 'square', v: 0.1 }); break;
      case 'crit': this.tone({ f: 900, f2: 300, d: 0.2, type: 'sawtooth', v: 0.2 }); this.noise({ d: 0.2, v: 0.25, lp: 2500 }); break;
      case 'parry': this.tone({ f: 1400, d: 0.2, type: 'triangle', v: 0.18 }); this.tone({ f: 2100, d: 0.15, type: 'sine', v: 0.1 }); break;
      case 'perfect': this.tone({ f: 1800, d: 0.35, type: 'triangle', v: 0.25 }); this.tone({ f: 2700, d: 0.3, type: 'sine', v: 0.15, delay: 0.03 }); this.noise({ d: 0.12, v: 0.2, hp: 4000 }); break;
      case 'block': this.tone({ f: 210, f2: 130, d: 0.09, type: 'square', v: 0.09 }); this.noise({ d: 0.07, v: 0.12, lp: 700 }); break;
      case 'shoot': this.tone({ f: 900, f2: 120, d: 0.12, type: 'square', v: 0.15 }); this.noise({ d: 0.05, v: 0.12, lp: 4000 }); break;
      case 'empty': this.tone({ f: 200, d: 0.05, type: 'square', v: 0.08 }); break;
      case 'tongue': this.tone({ f: 300, f2: 900, d: 0.1, type: 'sine', v: 0.15 }); break;
      case 'gulp': this.tone({ f: 250, f2: 90, d: 0.15, type: 'sine', v: 0.2 }); this.tone({ f: 180, f2: 70, d: 0.15, type: 'sine', v: 0.15, delay: 0.1 }); break;
      case 'hurt': this.tone({ f: 220, f2: 60, d: 0.25, type: 'sawtooth', v: 0.2 }); this.noise({ d: 0.15, v: 0.15, lp: 800 }); break;
      case 'jump': this.tone({ f: 250, f2: 520, d: 0.12, type: 'sine', v: 0.1 }); break;
      case 'dodge': this.noise({ d: 0.15, v: 0.12, hp: 900 }); break;
      case 'pickup': this.tone({ f: 600, d: 0.07, type: 'square', v: 0.1 }); this.tone({ f: 900, d: 0.1, type: 'square', v: 0.1, delay: 0.07 }); break;
      case 'heal': this.tone({ f: 500, f2: 800, d: 0.1, type: 'sine', v: 0.1 }); break;
      case 'power': [400, 500, 650, 800].forEach((f, i) => this.tone({ f, d: 0.1, type: 'square', v: 0.1, delay: i * 0.06 })); break;
      case 'ghost': this.tone({ f: 330, f2: 220, d: 0.4, type: 'sine', v: 0.12 }); this.tone({ f: 335, f2: 225, d: 0.4, type: 'sine', v: 0.1 }); break;
      case 'echo': this.tone({ f: 700, f2: 200, d: 0.3, type: 'sine', v: 0.15 }); break;
      case 'shatter': for (let i = 0; i < 5; i++) this.tone({ f: 1200 + i * 300, f2: 400, d: 0.3, type: 'triangle', v: 0.1, delay: i * 0.04 }); break;
      case 'boss': this.tone({ f: 90, f2: 40, d: 1.0, type: 'sawtooth', v: 0.3 }); this.noise({ d: 0.8, v: 0.25, lp: 400 }); break;
      case 'buzz': this.tone({ f: 120, f2: 140, d: 0.3, type: 'sawtooth', v: 0.08 }); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, d: 0.25, type: 'square', v: 0.14, delay: i * 0.12 })); break;
      case 'lose': [400, 300, 220, 150].forEach((f, i) => this.tone({ f, d: 0.3, type: 'sawtooth', v: 0.15, delay: i * 0.15 })); break;
      case 'break': this.noise({ d: 0.3, v: 0.3, hp: 2500 }); this.tone({ f: 1500, f2: 300, d: 0.35, type: 'sawtooth', v: 0.2 }); this.tone({ f: 600, f2: 90, d: 0.4, type: 'square', v: 0.15, delay: 0.05 }); break;
      case 'equip': this.tone({ f: 500, d: 0.05, type: 'square', v: 0.08 }); this.tone({ f: 800, d: 0.06, type: 'square', v: 0.08, delay: 0.05 }); this.noise({ d: 0.05, v: 0.1, hp: 3000, delay: 0.1 }); break;
      case 'rewind': for (let i = 0; i < 8; i++) this.tone({ f: 1400 - i * 150, f2: 1200 - i * 150, d: 0.08, type: 'triangle', v: 0.1, delay: i * 0.045 }); break;
      case 'rank': [660, 880, 1320].forEach((f, i) => this.tone({ f, d: 0.09, type: 'triangle', v: 0.1, delay: i * 0.05 })); break;
      case 'ui': this.tone({ f: 700, d: 0.05, type: 'square', v: 0.08 }); break;
      case 'warn': this.tone({ f: 440, d: 0.08, type: 'square', v: 0.07 }); break;
      default: break;
    }
  }
  // Layered perfect-parry: metallic clang partials + low thump. Pitch climbs with the parry streak.
  parry(streak = 1, big = false) {
    if (!this.ctx || this.muted) return;
    const p = Math.pow(2, (Math.min(streak, 9) - 1) * 2 / 12);
    [1, 2.76, 5.4].forEach((m, i) => this.tone({ f: 880 * p * m, d: 0.5 - i * 0.12, type: i ? 'sine' : 'triangle', v: 0.22 / (i + 1) }));
    this.noise({ d: 0.06, v: 0.32, hp: 5000 });
    this.tone({ f: big ? 120 : 160, f2: 40, d: big ? 0.5 : 0.24, type: 'sine', v: big ? 0.55 : 0.38 });
    this.noise({ d: 0.14, v: 0.25, lp: 320 });
    if (big) { this.tone({ f: 62, f2: 28, d: 0.9, type: 'sawtooth', v: 0.14, delay: 0.05 }); this.tone({ f: 1760 * p, d: 0.7, type: 'sine', v: 0.08, delay: 0.08 }); }
  }
  // Tiny original procedural loop: bass + arpeggio. intensity 0 = calm, 1 = boss.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 110, 165, 147];
    const arp = [440, 523, 659, 784, 659, 523];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const i = this.step++;
      const bar = Math.floor(i / 8) % bass.length;
      const mul = this.intensity > 0.5 ? 0.89 : 1;
      if (i % 4 === 0) this.tone({ f: bass[bar] * mul, d: 0.22, type: 'triangle', v: 0.07 });
      if (i % 2 === 0 || this.intensity > 0.5) this.tone({ f: arp[i % arp.length] * mul * (bar % 2 ? 1.125 : 1), d: 0.12, type: 'square', v: 0.018 });
      if (this.intensity > 0.5 && i % 2 === 1) this.noise({ d: 0.04, v: 0.03, hp: 6000 });
    }, 150);
  }
  stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; }
}

export const Sfx = new SfxEngine();
