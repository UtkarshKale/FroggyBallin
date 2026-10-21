import * as THREE from 'three';
import { CFG } from '../config.js';
import { makeModel, stdMat } from '../core/Assets.js';
import { Rng } from '../core/Rng.js';
import { clamp } from '../core/math.js';

// Owns renderer, scene, lights, camera rig, floor, obstacles (houses) and the goal pad.
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 9000);
    this.camera.up.set(0, 0, 1);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-300, -400, 800);
    this.scene.add(sun);

    this.level = null;
    this.obstacles = [];
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.cam = { yaw: Math.PI / 4, pitch: 0.55, dist: 270, pos: new THREE.Vector3(), shoulder: 0, shakeOffset: new THREE.Vector3() };

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  buildLevel(level) {
    this.level = level;
    this.scene.remove(this.levelGroup);
    this.levelGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
    });
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.obstacles = [];
    const half = level.half || CFG.ARENA_HALF;
    const th = level.theme;
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.sky, 1400, 3600);

    // Checkerboard floor
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const g = c.getContext('2d');
    g.fillStyle = th.c1; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
    g.fillStyle = th.c2; g.fillRect(1, 0, 1, 1); g.fillRect(0, 1, 1, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const tiles = (half * 2) / 100 / 2;
    tex.repeat.set(tiles, tiles);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), new THREE.MeshBasicMaterial({ map: tex }));
    floor.position.z = -0.5;
    this.levelGroup.add(floor);
    // Outer ground skirt
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ color: th.skirt || th.c1 }));
    skirt.position.z = -2;
    this.levelGroup.add(skirt);

    // Boundary posts
    const postMat = stdMat(th.post || 0x8d6e63);
    for (let i = -half; i <= half; i += 200) {
      for (const [x, y] of [[i, -half], [i, half], [-half, i], [half, i]]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 50, 8), postMat);
        p.rotation.x = Math.PI / 2;
        p.position.set(x, y, 25);
        this.levelGroup.add(p);
      }
    }

    // Start pad + goal pad
    this.startPad = this._pad(level.start.x, level.start.y, 0x55ccff, 60);
    this.goalPad = this._pad(level.goal.x, level.goal.y, 0xff3355, 75);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(45, 45, 420, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.set(level.goal.x, level.goal.y, 210);
    this.levelGroup.add(beam);
    this.goalBeam = beam;

    // Houses / obstacles (seeded so every loop has the same map)
    const rng = new Rng(level.seed);
    const keepOut = [level.start, level.goal, ...(level.zones || []).map((z) => ({ x: z.x, y: z.y }))];
    let tries = 0;
    while (this.obstacles.length < (level.houses ?? 4) && tries++ < 200) {
      const x = rng.range(-half + 150, half - 150);
      const y = rng.range(-half + 150, half - 150);
      if (keepOut.some((k) => Math.hypot(k.x - x, k.y - y) < 230)) continue;
      if (this.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < 320)) continue;
      const house = makeModel('small_house', 130, 0) || this._fallbackHouse();
      house.position.set(x, y, 0);
      house.rotation.z = Math.floor(rng.range(0, 4)) * (Math.PI / 2);
      this.levelGroup.add(house);
      const s = house.userData.size;
      this.obstacles.push({ x, y, r: s ? Math.max(s.x, s.y) * 0.42 : 70 });
    }
    // Decorative props (mushrooms / flowers) for flavour
    for (let i = 0; i < 40; i++) {
      const x = rng.range(-half, half), y = rng.range(-half, half);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 14, 6), stdMat(0xf5f5dc));
      stem.rotation.x = Math.PI / 2; stem.position.set(x, y, 7);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), stdMat(th.prop || 0xff5577));
      cap.rotation.x = Math.PI / 2; cap.position.set(x, y, 14);
      this.levelGroup.add(stem, cap);
    }
    this.setGoalOpen(false);
  }

  _pad(x, y, color, r) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 4, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
    );
    pad.rotation.x = Math.PI / 2;
    pad.position.set(x, y, 2);
    this.levelGroup.add(pad);
    return pad;
  }

  _fallbackHouse() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(110, 110, 70), stdMat(0xd7b98e));
    body.position.z = 35;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(90, 60, 4), stdMat(0xb23a48));
    roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI / 4; roof.position.z = 100;
    g.add(body, roof);
    g.userData.size = new THREE.Vector3(110, 110, 130);
    return g;
  }

  setGoalOpen(open) {
    const c = open ? 0x33ff77 : 0xff3355;
    this.goalPad.material.color.setHex(c);
    this.goalBeam.material.color.setHex(c);
  }

  // Push an entity (x, y, radius) out of houses and keep it inside the arena.
  resolve(e) {
    for (const o of this.obstacles) {
      const dx = e.x - o.x, dy = e.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = o.r + e.radius;
      if (d < min) {
        const k = d < 0.001 ? 1 : 1 / d;
        e.x = o.x + (d < 0.001 ? min : dx * k * min);
        e.y = o.y + (d < 0.001 ? 0 : dy * k * min);
        e.hitWall = true;
      }
    }
    const half = (this.level?.half || CFG.ARENA_HALF) - 30;
    const cx = clamp(e.x, -half, half), cy = clamp(e.y, -half, half);
    if (cx !== e.x || cy !== e.y) e.hitWall = true;
    e.x = cx; e.y = cy;
  }

  blocked(x, y, r = 4) {
    return this.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r);
  }

  // Third-person follow camera.
  followCamera(target, dt, shake = 0, lookZ = 34) {
    const c = this.cam;
    const fx = Math.cos(c.yaw), fy = Math.sin(c.yaw);
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const rx = Math.sin(c.yaw), ry = -Math.cos(c.yaw);
    const tx = target.x + rx * c.shoulder, ty = target.y + ry * c.shoulder, tz = lookZ + (target.z || 0) * 0.5;
    const want = new THREE.Vector3(tx - fx * c.dist * cp, ty - fy * c.dist * cp, tz + c.dist * sp);
    // Keep camera over the arena floor.
    want.z = Math.max(want.z, 25);
    if (!c.init) { c.pos.copy(want); c.init = true; }
    c.pos.lerp(want, 1 - Math.exp(-16 * dt));
    this.camera.position.copy(c.pos);
    if (shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.camera.position.z += (Math.random() - 0.5) * shake;
    }
    this.camera.lookAt(tx, ty, tz);
  }

  snapCamera() { this.cam.init = false; }

  render() { this.renderer.render(this.scene, this.camera); }
}
