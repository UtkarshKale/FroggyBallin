import * as THREE from 'three';
import { CFG } from '../config.js';

// Full-screen ASCII post-process for ultimates. The scene renders into a render target; a single
// full-screen shader picks a glyph per cell from a canvas-generated atlas by luminance and tints it
// with the cell's colour. Two passes total, so it stays cheap. A glitch term (row shifts + RGB split)
// drives the transitions in and out.
const RAMP = ' .:-=+*#%@';

function glyphAtlas(px) {
  const c = document.createElement('canvas');
  c.width = px * RAMP.length; c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.font = `bold ${Math.round(px * 0.95)}px monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < RAMP.length; i++) g.fillText(RAMP[i], i * px + px / 2, px / 2 + 1);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

export class AsciiPass {
  constructor(renderer) {
    this.renderer = renderer;
    this.amount = 0;
    this.target = 0;
    this.glitch = 0;
    this.kickT = 0;
    this.extra = 0; // constant glitch on top (boss 'shift' ult)
    this.tint = new THREE.Color(0x66ffcc);
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.rt.texture }, tGlyph: { value: glyphAtlas(32) },
        res: { value: new THREE.Vector2(2, 2) }, cell: { value: CFG.ULT.cell }, amount: { value: 0 }, glitch: { value: 0 },
        time: { value: 0 }, nGlyph: { value: RAMP.length }, tint: { value: this.tint },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tScene, tGlyph; uniform vec2 res; uniform float cell, amount, glitch, time, nGlyph; uniform vec3 tint;
        varying vec2 vUv;
        float rnd(float x) { return fract(sin(x * 91.345) * 43758.5453); }
        void main() {
          vec2 frag = vUv * res;
          float row = floor(frag.y / (cell * 2.0));
          frag.x += (rnd(row + floor(time * 24.0)) - 0.5) * glitch * 90.0 * step(0.55, rnd(row * 3.1 + floor(time * 12.0)));
          vec2 id = floor(frag / cell);
          vec3 col = texture2D(tScene, (id + 0.5) * cell / res).rgb;
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          float gi = floor(clamp(pow(lum, 0.6) * 1.05, 0.0, 0.999) * nGlyph);
          vec2 inC = fract(frag / cell);
          float m = texture2D(tGlyph, vec2((gi + inC.x) / nGlyph, inC.y)).r;
          vec3 asc = mix(col * 1.8 + 0.05, tint, 0.4) * m;
          vec2 uv = frag / res;
          float sp = 0.008 * glitch;
          vec3 base = vec3(texture2D(tScene, uv + vec2(sp, 0.0)).r, texture2D(tScene, uv).g, texture2D(tScene, uv - vec2(sp, 0.0)).b);
          vec3 outc = mix(base, asc, amount);
          outc += tint * glitch * 0.25 * step(0.92, rnd(row + floor(time * 30.0)));
          gl_FragColor = vec4(outc, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt.setSize(s.x, s.y);
    this.mat.uniforms.res.value.copy(s);
    this.mat.uniforms.cell.value = CFG.ULT.cell * this.renderer.getPixelRatio();
  }

  set(on, color) {
    this.target = on ? 1 : 0;
    if (color != null) this.tint.setHex(color);
    this.kickT = CFG.ULT.glitchTime;
  }

  // Short glitch burst without changing the mode (ult end flash, boss ult shift effect).
  kick(t = CFG.ULT.glitchTime) { this.kickT = Math.max(this.kickT, t); }

  update(dt) {
    const k = 1 - Math.exp(-dt / Math.max(0.01, CFG.ULT.glitchTime * 0.4));
    this.amount += (this.target - this.amount) * k;
    if (Math.abs(this.target - this.amount) < 0.002) this.amount = this.target;
    this.kickT = Math.max(0, this.kickT - dt);
    this.glitch = Math.min(1, this.kickT / CFG.ULT.glitchTime + this.extra);
    this.mat.uniforms.time.value += dt;
  }

  get active() { return this.amount > 0.001 || this.glitch > 0.001; }

  render(scene, camera) {
    const r = this.renderer;
    this.mat.uniforms.amount.value = this.amount;
    this.mat.uniforms.glitch.value = this.glitch;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.qScene, this.qCam);
  }
}
