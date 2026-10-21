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
    // Depth/coverage pass material: black RGB, alpha = 1 near the action fading to 0 with distance from `center`.
    // Background (cleared to alpha 0) and far-away geometry therefore emit no glyphs.
    this.center = new THREE.Vector2();
    this.mBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mBlack.onBeforeCompile = (sh) => {
      sh.uniforms.uCenter = { value: this.center };
      sh.uniforms.uFade = { value: new THREE.Vector2(CFG.ULT.fadeNear, CFG.ULT.fadeFar) };
      sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform vec2 uCenter; uniform vec2 uFade; varying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - smoothstep(uFade.x, uFade.y, distance(vWPos.xy, uCenter)));');
    };
    // layer 1 danger (red), 2 health (green), 4 actors (blue = always drawn bright white)
    this.mMask = { 1: new THREE.MeshBasicMaterial({ color: 0xff0000 }), 2: new THREE.MeshBasicMaterial({ color: 0x00ff00 }), 4: new THREE.MeshBasicMaterial({ color: 0x0000ff }) };
    this.sMask = { 1: new Map(), 2: new Map(), 4: new Map() };
    this._cc = new THREE.Color();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.rt.texture }, tMask: { value: this.maskRT.texture }, tGlyph: { value: glyphAtlas(32) },
        black: { value: CFG.ULT.black }, cutoff: { value: CFG.ULT.cutoff }, actorMin: { value: CFG.ULT.actorMin },
        res: { value: new THREE.Vector2(2, 2) }, cell: { value: CFG.ULT.cell }, amount: { value: 0 }, glitch: { value: 0 },
        time: { value: 0 }, nGlyph: { value: RAMP.length }, tint: { value: this.tint },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tScene, tMask, tGlyph; uniform vec2 res; uniform float cell, amount, glitch, time, nGlyph, black, cutoff, actorMin; uniform vec3 tint;
        varying vec2 vUv;
        float rnd(float x) { return fract(sin(x * 91.345) * 43758.5453); }
        void main() {
          vec2 frag = vUv * res;
          float row = floor(frag.y / (cell * 2.0));
          frag.x += (rnd(row + floor(time * 24.0)) - 0.5) * glitch * 90.0 * step(0.55, rnd(row * 3.1 + floor(time * 12.0)));
          vec2 id = floor(frag / cell);
          vec2 cuv = (id + 0.5) * cell / res;
          vec3 col = texture2D(tScene, cuv).rgb;
          vec4 mk4 = texture2D(tMask, cuv);
          vec3 mk = mk4.rgb;
          float sem = max(mk.r, mk.g);
          // Contrast curve: darks crush to black, then fade by coverage/distance; below the cutoff no glyph at all.
          float lum = pow(dot(col, vec3(0.299, 0.587, 0.114)), 1.0 / 2.2); // linear RT -> perceptual
          lum = pow(clamp((lum - black) / (1.0 - black), 0.0, 1.0), 0.8) * mk4.a;
          lum = max(lum, sem * 0.55);
          lum = max(lum, step(0.5, mk.b) * max(actorMin, lum * 0.4 + 0.6));
          lum *= step(cutoff, lum);
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
    r.setClearColor(0x000000, 0); r.clear();
    scene.overrideMaterial = this.mBlack;
    camera.layers.set(0);
    r.render(scene, camera);
    scene.overrideMaterial = null;
    const auto = r.autoClear; r.autoClear = false;
    for (const layer of [4, 1, 2]) {
      const kind = layer === 1 ? 'danger' : layer === 2 ? 'heal' : 'actor';
      const swapped = [];
      for (const root of tagged) {
        if (!root.parent) { tagged.delete(root); continue; }
        if (root.userData.tag !== kind) continue;
        root.traverse((o) => {
          if (o.isSprite) {
            let sm = this.sMask[layer].get(o.material.map);
            if (!sm) { sm = new THREE.SpriteMaterial({ map: o.material.map, color: layer === 1 ? 0xff0000 : layer === 2 ? 0x00ff00 : 0x0000ff, alphaTest: 0.3, depthTest: false }); this.sMask[layer].set(o.material.map, sm); }
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
