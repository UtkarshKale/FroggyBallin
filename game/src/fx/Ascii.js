import * as THREE from 'three';
import { CFG } from '../config.js';

// Full-screen ASCII post-process for ultimates. The scene renders into a render target; a full-screen
// shader picks a glyph per cell from a canvas-generated atlas by luminance. The view is monochrome
// (white/grey glyphs on black) except two semantic colours: RED for danger and GREEN for health. Those
// come from a tiny one-texel-per-cell mask pass over objects tagged via World.tag() (layers 1 and 2).
// A glitch term (row shifts + RGB split) drives the transitions in and out.
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
    this.maskRT = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.mBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mMask = { 1: new THREE.MeshBasicMaterial({ color: 0xff0000 }), 2: new THREE.MeshBasicMaterial({ color: 0x00ff00 }) };
    this.sMask = { 1: new Map(), 2: new Map() };
    this._cc = new THREE.Color();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.rt.texture }, tMask: { value: this.maskRT.texture }, tGlyph: { value: glyphAtlas(32) },
        res: { value: new THREE.Vector2(2, 2) }, cell: { value: CFG.ULT.cell }, amount: { value: 0 }, glitch: { value: 0 },
        time: { value: 0 }, nGlyph: { value: RAMP.length }, tint: { value: this.tint },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tScene, tMask, tGlyph; uniform vec2 res; uniform float cell, amount, glitch, time, nGlyph; uniform vec3 tint;
        varying vec2 vUv;
        float rnd(float x) { return fract(sin(x * 91.345) * 43758.5453); }
        void main() {
          vec2 frag = vUv * res;
          float row = floor(frag.y / (cell * 2.0));
          frag.x += (rnd(row + floor(time * 24.0)) - 0.5) * glitch * 90.0 * step(0.55, rnd(row * 3.1 + floor(time * 12.0)));
          vec2 id = floor(frag / cell);
          vec2 cuv = (id + 0.5) * cell / res;
          vec3 col = texture2D(tScene, cuv).rgb;
          vec3 mk = texture2D(tMask, cuv).rgb;
          float lum = pow(dot(col, vec3(0.299, 0.587, 0.114)), 0.6);
          float sem = max(mk.r, mk.g);
          lum = max(lum, sem * 0.55);
          float gi = floor(clamp(lum * 1.05, 0.0, 0.999) * nGlyph);
          vec2 inC = fract(frag / cell);
          float m = texture2D(tGlyph, vec2((gi + inC.x) / nGlyph, inC.y)).r;
          vec3 mono = vec3(0.25 + 0.75 * lum);
          vec3 semc = mk.r > 0.5 ? vec3(1.0, 0.12, 0.12) : vec3(0.2, 1.0, 0.3);
          vec3 asc = mix(mono, semc, step(0.5, sem)) * m;
          vec2 uv = frag / res;
          float sp = 0.008 * glitch;
          vec3 base = vec3(texture2D(tScene, uv + vec2(sp, 0.0)).r, texture2D(tScene, uv).g, texture2D(tScene, uv - vec2(sp, 0.0)).b);
          vec3 outc = mix(base, asc, amount);
          outc += vec3(0.8) * glitch * 0.25 * step(0.92, rnd(row + floor(time * 30.0)));
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
    const c = CFG.ULT.cell * this.renderer.getPixelRatio();
    this.maskRT.setSize(Math.max(1, Math.ceil(s.x / c)), Math.max(1, Math.ceil(s.y / c)));
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

  // Semantic mask: everything black (depth), then danger roots red (layer 1) and heal roots green (layer 2).
  renderMask(scene, camera, tagged) {
    const r = this.renderer;
    r.getClearColor(this._cc); const ca = r.getClearAlpha();
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null;
    r.setRenderTarget(this.maskRT);
    r.setClearColor(0x000000, 1); r.clear();
    scene.overrideMaterial = this.mBlack;
    camera.layers.set(0);
    r.render(scene, camera);
    scene.overrideMaterial = null;
    const auto = r.autoClear; r.autoClear = false;
    for (const layer of [1, 2]) {
      const kind = layer === 1 ? 'danger' : 'heal';
      const swapped = [];
      for (const root of tagged) {
        if (!root.parent) { tagged.delete(root); continue; }
        if (root.userData.tag !== kind) continue;
        root.traverse((o) => {
          if (o.isSprite) {
            let sm = this.sMask[layer].get(o.material.map);
            if (!sm) { sm = new THREE.SpriteMaterial({ map: o.material.map, color: layer === 1 ? 0xff0000 : 0x00ff00, alphaTest: 0.3, depthTest: false }); this.sMask[layer].set(o.material.map, sm); }
            swapped.push([o, o.material]); o.material = sm;
          } else if (o.isMesh) { swapped.push([o, o.material]); o.material = this.mMask[layer]; }
        });
      }
      if (swapped.length) { camera.layers.set(layer); r.render(scene, camera); }
      for (const [o, m] of swapped) o.material = m;
    }
    r.autoClear = auto;
    camera.layers.set(0); camera.layers.enable(3);
    scene.background = bg; scene.fog = fog;
    r.setClearColor(this._cc, ca);
  }

  render(scene, camera, tagged) {
    const r = this.renderer;
    if (tagged) this.renderMask(scene, camera, tagged);
    this.mat.uniforms.amount.value = this.amount;
    this.mat.uniforms.glitch.value = this.glitch;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.qScene, this.qCam);
  }
}
