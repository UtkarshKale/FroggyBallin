import * as THREE from 'three';
import { CFG } from '../config.js';

// Full-screen ASCII post-process for ultimates. The scene renders into a render target; a full-screen
// shader picks a glyph per cell from a canvas-generated atlas by luminance. The view is monochrome
// (white/grey glyphs on black) except two semantic colours: RED for danger and GREEN for health. Those
// come from a tiny one-texel-per-cell mask pass over objects tagged via World.tag(). The mask also separates
// brightness layers (CFG.ASCII): enemies/ghost and effects brightest, Tode a notch below, scenery dimmed;
// enemies and attacks get thicker glyphs plus a glow halo of glyphs around them.
// A glitch term (row shifts + RGB split) drives the transitions in and out.
const RAMP = ' .:-=+*#%@';
// mask colour per World.tag layer (see renderMask)
// soft danger (marker fills) uses r = 0.5 so the area reads without flooding the screen
const MASK = { 1: 0xff0000, 2: 0x00ff00, 4: 0x000080, 7: 0x0000c0, 6: 0x0000ff };
// The mask target is linear, so these are set as linear values (no sRGB conversion of the encoded levels).
const maskColor = (hex) => new THREE.Color().setRGB((hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255, THREE.LinearSRGBColorSpace);
const KIND = { 1: 'danger', 2: 'heal', 4: 'actor', 6: 'enemy', 7: 'fx' };

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
    // Mask colour per tag layer: 1 danger (red), 2 health (green); blue channel encodes the brightness layer:
    // 4 player/friendly (0.5), 7 effects (0.75), 6 enemies + ghost (1.0).
    this.mMask = {}; this.sMask = {};
    for (const [l, c] of Object.entries(MASK)) { this.mMask[l] = new THREE.MeshBasicMaterial({ color: maskColor(c) }); this.sMask[l] = new Map(); }
    this.mSoft = new THREE.MeshBasicMaterial({ color: maskColor(0x800000) });
    this._cc = new THREE.Color();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.rt.texture }, tMask: { value: this.maskRT.texture }, tGlyph: { value: glyphAtlas(32) },
        black: { value: CFG.ULT.black }, cutoff: { value: CFG.ULT.cutoff }, mTexel: { value: new THREE.Vector2(0.5, 0.5) },
        kMin: { value: new THREE.Vector4() }, kTone: { value: new THREE.Vector4() }, kFx: { value: new THREE.Vector4() },
        dangerCol: { value: new THREE.Color() }, kMisc: { value: new THREE.Vector3() }, kSoft: { value: new THREE.Vector2() },
        res: { value: new THREE.Vector2(2, 2) }, cell: { value: CFG.ULT.cell }, amount: { value: 0 }, glitch: { value: 0 },
        time: { value: 0 }, nGlyph: { value: RAMP.length }, tint: { value: this.tint },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tScene, tMask, tGlyph; uniform vec2 res, mTexel; uniform float cell, amount, glitch, time, nGlyph, black, cutoff;
        // kMin = min glyph density (player, enemy, fx, danger), kTone = colour (player, enemy, fx, danger),
        // kFx = (scene cap, scene tone, halo, halo tone), kMisc = (bold px, glow fill, heal tone)
        uniform vec4 kMin, kTone, kFx; uniform vec3 kMisc, tint, dangerCol; uniform vec2 kSoft; // (density, tone) of soft danger areas
        varying vec2 vUv;
        float rnd(float x) { return fract(sin(x * 91.345) * 43758.5453); }
        float glyph(float gi, vec2 inC) { return texture2D(tGlyph, vec2((gi + clamp(inC.x, 0.0, 1.0)) / nGlyph, clamp(inC.y, 0.0, 1.0))).r; }
        void main() {
          vec2 frag = vUv * res;
          float row = floor(frag.y / (cell * 2.0));
          frag.x += (rnd(row + floor(time * 24.0)) - 0.5) * glitch * 90.0 * step(0.55, rnd(row * 3.1 + floor(time * 12.0)));
          vec2 id = floor(frag / cell);
          vec2 cuv = (id + 0.5) * cell / res;
          vec3 col = texture2D(tScene, cuv).rgb;
          vec4 mk4 = texture2D(tMask, cuv);
          vec3 mk = mk4.rgb;
          float isD = step(0.75, mk.r), isS = step(0.3, mk.r) * (1.0 - isD), isH = step(0.5, mk.g) * (1.0 - isD - isS);
          float isE = step(0.87, mk.b), isF = step(0.62, mk.b) * (1.0 - isE), isP = step(0.3, mk.b) * (1.0 - step(0.62, mk.b));
          float sem = max(max(isD, isH), isS), hot = max(max(isD, isE), isF);
          // Halo: cells next to an enemy / attack light up faintly (glow bloom made of glyphs).
          float hD = 0.0, hE = 0.0;
          for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) {
            vec4 n = texture2D(tMask, cuv + vec2(float(dx), float(dy)) * mTexel);
            hD = max(hD, step(0.75, n.r)); hE = max(hE, max(step(0.87, n.b), step(0.62, n.b) * 0.7));
          }
          // Contrast curve: darks crush to black, then fade by coverage/distance; below the cutoff no glyph at all.
          float lum = pow(dot(col, vec3(0.299, 0.587, 0.114)), 1.0 / 2.2); // linear RT -> perceptual
          lum = pow(clamp((lum - black) / (1.0 - black), 0.0, 1.0), 0.8) * mk4.a;
          float tagged = max(max(sem, hot), isP);
          lum = mix(lum * kFx.x, lum, tagged); // scenery (untagged) capped low so it recedes
          lum = max(lum, isP * max(kMin.x, lum * 0.4 + 0.6));
          lum = max(lum, isE * max(kMin.y, lum * 0.3 + 0.7));
          lum = max(lum, isF * max(kMin.z, lum));
          lum = max(lum, isD * kMin.w);
          lum = max(lum, isH * 0.8);
          lum = mix(lum, kSoft.x, isS);
          float halo = (1.0 - tagged) * max(hD, hE);
          lum = max(lum, halo * kFx.z);
          lum *= step(cutoff, lum);
          float gi = floor(clamp(lum * 1.05, 0.0, 0.999) * nGlyph);
          vec2 inC = fract(frag / cell);
          float m = glyph(gi, inC);
          // Bold: thicken glyphs of enemies and attacks by dilating the atlas lookup.
          vec2 bo = vec2(kMisc.x / 32.0, 0.0) * hot;
          m = max(m, max(max(glyph(gi, inC + bo), glyph(gi, inC - bo)), max(glyph(gi, inC + bo.yx), glyph(gi, inC - bo.yx))));
          vec3 mono = vec3(0.25 + 0.75 * lum);
          float tone = isP > 0.5 ? kTone.x : isE > 0.5 ? kTone.y : isF > 0.5 ? kTone.z : mix(kFx.y, 1.0, tagged);
          vec3 c = mono * tone;
          c = mix(c, dangerCol * kTone.w, isD);
          c = mix(c, dangerCol * kSoft.y, isS);
          c = mix(c, vec3(0.2, 1.0, 0.3) * kMisc.z, isH);
          c = mix(c, mix(vec3(0.85), dangerCol, hD) * kFx.w, halo); // halo: dim red near danger, dim white near enemies
          vec3 asc = c * m;
          // faint cell fill behind enemies / attacks so they glow between glyph strokes too
          asc += mix(vec3(0.8), dangerCol, isD) * kMisc.y * hot + mix(vec3(0.6), dangerCol, hD) * kMisc.y * 0.4 * halo;
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
    this.mat.uniforms.mTexel.value.set(1 / this.maskRT.width, 1 / this.maskRT.height);
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
    for (const layer of [4, 7, 6, 1, 2]) {
      const kind = KIND[layer];
      const swapped = [];
      for (const root of tagged) {
        if (!root.parent) { tagged.delete(root); continue; }
        if (root.userData.tag !== kind) continue;
        root.traverse((o) => {
          if (o.isSprite) {
            let sm = this.sMask[layer].get(o.material.map);
            if (!sm) { sm = new THREE.SpriteMaterial({ map: o.material.map, color: maskColor(MASK[layer]), alphaTest: 0.3, depthTest: false }); this.sMask[layer].set(o.material.map, sm); }
            swapped.push([o, o.material]); o.material = sm;
          } else if (o.isMesh) { swapped.push([o, o.material]); o.material = layer === 1 && o.userData.softMask ? this.mSoft : this.mMask[layer]; }
        });
      }
      if (swapped.length) { camera.layers.set(layer); r.render(scene, camera); }
      for (const [o, m] of swapped) o.material = m;
    }
    r.autoClear = auto;
    camera.layers.set(0); camera.layers.enable(3); camera.layers.enable(5);
    scene.background = bg; scene.fog = fog;
    r.setClearColor(this._cc, ca);
  }

  render(scene, camera, tagged) {
    const r = this.renderer;
    if (tagged) this.renderMask(scene, camera, tagged);
    this.mat.uniforms.amount.value = this.amount;
    const A = CFG.ASCII, u = this.mat.uniforms; // read live from config so tuning applies without a reload
    u.kMin.value.set(A.playerMin, A.enemyMin, A.fxMin, A.dangerMin);
    u.kTone.value.set(A.player, A.enemy, A.fx, A.danger);
    u.kFx.value.set(A.scene, A.sceneTone, A.halo, A.haloTone);
    u.kMisc.value.set(A.bold, A.glow, A.heal);
    u.dangerCol.value.setHex(A.dangerColor);
    u.kSoft.value.set(A.areaMin, A.area);
    this.mat.uniforms.glitch.value = this.glitch;
    camera.layers.disable(5); // UI panels (layer 5) stay out of the ASCII image...
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.qScene, this.qCam);
    // ...and are drawn normally on top, so menus / stats stay readable while the world is ASCII.
    const auto = r.autoClear, bg = scene.background, fog = scene.fog;
    r.autoClear = false; scene.background = null; scene.fog = null;
    r.clearDepth();
    camera.layers.set(5);
    r.render(scene, camera);
    r.autoClear = auto; scene.background = bg; scene.fog = fog;
    camera.layers.set(0); camera.layers.enable(3); camera.layers.enable(5);
  }
}
