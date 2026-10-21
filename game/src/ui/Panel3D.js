import * as THREE from 'three';

// In-world UI panel: a plane with a canvas texture, drawn in the angular black/red/white style.
// Hovered panels flip to a white fill with dark text (high contrast, never red-on-red).
const PX = 4; // canvas pixels per world unit

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export class Panel3D {
  // item: { label, sub?, value?() , body?, kind: 'button'|'option'|'card'|'title', accent? }
  constructor(item, w, h) {
    this.item = item;
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * PX); this.canvas.height = Math.round(h * PX);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    // depthTest off + high render order: scene geometry (houses, the frog, bugs) can never hide a UI panel
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.mesh.renderOrder = 20;
    this.mesh.userData.panel = this;
    this.hover = false;
    this.pop = 0;
    this._key = '';
    this.draw();
  }

  get interactive() { return this.item.kind !== 'card' && this.item.kind !== 'title'; }

  draw() {
    const it = this.item;
    const val = it.value ? String(it.value()) : '';
    const key = `${this.hover}|${it.label}|${val}|${it.sub || ''}|${it.body || ''}`;
    if (key === this._key) return;
    this._key = key;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    const sk = it.kind === 'card' ? 0 : Math.min(H * 0.35, 40);
    const fit = (txt, size, maxW, fam) => { let s = size; c.font = fam(s); while (s > 10 && c.measureText(txt).width > maxW) { s -= 2; c.font = fam(s); } return s; };
    const accent = it.accent || '#ff2a3a';
    // body shape
    c.beginPath();
    c.moveTo(sk, 0); c.lineTo(W, 0); c.lineTo(W - sk, H); c.lineTo(0, H); c.closePath();
    if (it.kind === 'title') { c.fillStyle = 'rgba(0,0,0,0)'; }
    else if (this.hover) { c.fillStyle = '#f4f1ea'; c.shadowColor = accent; c.shadowOffsetX = 10; c.shadowOffsetY = 10; }
    else c.fillStyle = 'rgba(8,8,10,0.88)';
    c.fill();
    c.shadowColor = 'transparent'; c.shadowOffsetX = c.shadowOffsetY = 0;
    if (it.kind !== 'title') {
      c.lineWidth = Math.max(5, H * 0.05); c.strokeStyle = this.hover ? '#000' : accent; c.stroke();
      // halftone corner
      c.fillStyle = this.hover ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.08)';
      const st = Math.max(10, H * 0.08);
      for (let y = st; y < H * 0.5; y += st) for (let x = W - st * 12; x < W - sk * (y / H) - 6; x += st) { c.beginPath(); c.arc(x, y, st * 0.2, 0, 6.3); c.fill(); }
    }
    const fg = this.hover ? '#0a0a0a' : '#ffffff';
    const pad = sk + 18;
    if (it.kind === 'title') {
      fit(it.label, Math.round(H * 0.62), W - 30, (s) => `italic 900 ${s}px 'Arial Black', Impact, sans-serif`);
      c.textBaseline = 'middle';
      c.lineWidth = 10; c.strokeStyle = '#000'; c.strokeText(it.label, 10, H / 2);
      c.fillStyle = accent; c.fillText(it.label, 18, H / 2 + 8);
      c.fillStyle = '#fff'; c.fillText(it.label, 10, H / 2);
    } else if (it.kind === 'card') {
      c.fillStyle = '#fff';
      const m = W * 0.04;
      const ts = fit(it.label, W * 0.075, W - 2 * m, (s) => `italic 900 ${s}px 'Arial Black', Impact, sans-serif`);
      c.textBaseline = 'top';
      c.fillText(it.label, m, m);
      c.fillStyle = accent; c.fillRect(m, m + ts * 1.15, Math.min(W - 2 * m, c.measureText(it.label).width), Math.max(4, W * 0.006));
      const bs = W * 0.04;
      c.font = `600 ${bs}px 'Segoe UI', Arial, sans-serif`;
      let y = m + ts * 1.15 + bs * 0.9;
      for (const ln of wrap(c, it.body || '', W - 2 * m)) { c.fillStyle = ln.startsWith('*') ? '#ffd23f' : '#e8e8e8'; c.fillText(ln.replace(/^\*/, ''), m, y); y += bs * 1.3; if (y > H - bs) break; }
    } else {
      c.textBaseline = 'middle';
      const avail = W - pad - sk - 20;
      let vw = 0, vs = 0;
      if (val) { vs = Math.round(H * 0.36); c.font = `900 ${vs}px Consolas, 'Courier New', monospace`; vw = c.measureText(`< ${val} >`).width + 20; }
      const big = fit(it.label, Math.round(H * (it.sub ? 0.36 : 0.5)), avail - vw, (s) => `italic 900 ${s}px 'Arial Black', Impact, sans-serif`);
      c.fillStyle = fg;
      const ty = it.sub ? H * 0.34 : H / 2;
      c.fillText(it.label, pad, ty);
      if (val) {
        c.font = `900 ${vs}px Consolas, 'Courier New', monospace`;
        c.fillStyle = this.hover ? '#c8101e' : '#ffd23f';
        c.fillText(`< ${val} >`, W - sk - 16 - (vw - 20), ty);
      }
      if (it.sub) {
        c.font = `600 ${Math.round(H * 0.16)}px 'Segoe UI', Arial, sans-serif`;
        c.fillStyle = this.hover ? '#333' : '#bbb';
        let y = H * 0.62;
        for (const ln of wrap(c, it.sub, W - pad - sk - 20).slice(0, 3)) { c.fillText(ln, pad, y); y += H * 0.18; }
      }
    }
    this.tex.needsUpdate = true;
  }

  dispose() { this.tex.dispose(); this.mat.dispose(); this.mesh.geometry.dispose(); }
}
