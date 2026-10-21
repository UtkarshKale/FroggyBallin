import * as THREE from 'three';

// Attack types: 'normal' (parryable), 'dodge' (perilous: must be dodged/jumped, parry fails),
// 'counter' (perilous: dodge it with i-frames to open a RIPOSTE window).
export function hitOpts(type, extra = {}) {
  return type && type !== 'normal' ? { parryable: false, peril: type, ...extra } : { parryable: true, ...extra };
}

// Telegraph flash colours per attack type (bright / dark alternate).
export const TELE_COLORS = { normal: [0xffdd44, 0x554400], dodge: [0xff1122, 0x440000], counter: [0xff8811, 0x442200] };

// Original brush-stroke danger sigil: a jagged, tapering '!' with ink splatter, drawn on a canvas.
function sigil(color, glow) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.shadowColor = glow; g.shadowBlur = 18;
  g.fillStyle = color;
  // tapered slash body
  g.beginPath();
  g.moveTo(52, 10); g.lineTo(82, 8); g.lineTo(76, 30); g.lineTo(71, 52); g.lineTo(67, 76); g.lineTo(58, 80);
  g.lineTo(56, 60); g.lineTo(51, 38); g.lineTo(47, 22);
  g.closePath(); g.fill();
  // ragged bristle edges
  for (let i = 0; i < 6; i++) { g.fillRect(48 + i * 5, 6 + (i % 2) * 4, 3, 10); }
  // dot with drip
  g.beginPath(); g.ellipse(62, 100, 12, 10, -0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(70, 104); g.quadraticCurveTo(84, 112, 80, 122); g.lineTo(74, 110); g.fill();
  // splatter
  for (const [x, y, r] of [[28, 40, 4], [96, 30, 3], [36, 92, 3], [100, 86, 5], [88, 60, 2], [24, 70, 2]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class PerilFx {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.tex = { dodge: sigil('#ff1a2a', '#ff0000'), counter: sigil('#ff9a1a', '#ff6600') };
  }

  // Glyph floats above the attacker for `dur` seconds.
  show(ent, type, dur = 0.8, h = 90) {
    if (!this.tex[type]) return;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex[type], transparent: true, depthTest: false }));
    spr.renderOrder = 10;
    this.g.world.scene.add(spr);
    this.g.world.tag(spr, 'danger');
    this.list.push({ spr, ent, t: dur, max: dur, h });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.t -= dt;
      if (s.t <= 0 || s.ent.dead) { this._rm(i); continue; }
      const k = 1 - s.t / s.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.7 : 1.3 - Math.min(0.3, (k - 0.15) * 0.6);
      const sz = 46 * pop;
      s.spr.scale.set(sz, sz, 1);
      s.spr.position.set(s.ent.x, s.ent.y, (s.ent.z || 0) + s.h + Math.sin(k * 20) * 2);
      s.spr.material.opacity = s.t < 0.15 ? s.t / 0.15 : 1;
    }
  }

  _rm(i) { const s = this.list[i]; this.g.world.scene.remove(s.spr); s.spr.material.dispose(); this.list.splice(i, 1); }
  clear() { for (let i = this.list.length - 1; i >= 0; i--) this._rm(i); }
}
