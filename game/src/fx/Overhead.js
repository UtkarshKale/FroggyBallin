import * as THREE from 'three';

const W = 64;
const geo = new THREE.PlaneGeometry(1, 1);
geo.translate(0.5, 0, 0);
const mk = (color, op = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthTest: false, depthWrite: false });
const bgMat = mk(0x000000, 0.65);
const hpMat = mk(0xff4a4a);
const postMat = mk(0xffffff);
const brokenMat = mk(0xffaa00);

let eTex = null;
function eSprite() {
  if (!eTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ff5f8a'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 38px sans-serif'; g.textAlign = 'center'; g.fillText('E', 32, 45);
    eTex = new THREE.CanvasTexture(c);
  }
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: eTex, transparent: true, depthTest: false }));
}

// Floating HP + posture bar (and an "E" eat prompt) above a bug. Billboarded to the camera.
export class Overhead {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    const part = (mat, y, h, order) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(-W / 2, y, 0);
      m.scale.set(W, h, 1);
      m.renderOrder = order;
      this.group.add(m);
      return m;
    };
    part(bgMat, 0, 12, 990);
    this.hp = part(hpMat, 6.5, 4.5, 991);
    this.post = part(postMat, 1, 4.5, 991);
    this.eat = eSprite();
    this.eat.scale.set(16, 16, 1);
    this.eat.position.set(0, 20, 0);
    this.eat.renderOrder = 992;
    this.group.add(this.eat);
    this.group.visible = false;
    scene.add(this.group);
  }

  update(camera, x, y, z, hpFrac, postFrac, broken, eatable) {
    const showBars = hpFrac < 0.999 || postFrac > 0.01 || broken;
    this.group.visible = showBars || eatable;
    if (!this.group.visible) return;
    this.group.position.set(x, y, z);
    this.group.quaternion.copy(camera.quaternion);
    this.hp.scale.x = Math.max(0.001, W * hpFrac);
    this.post.scale.x = Math.max(0.001, W * (broken ? 1 : postFrac));
    this.post.material = broken ? brokenMat : postMat;
    this.hp.visible = this.post.visible = showBars;
    this.group.children[0].visible = showBars;
    this.eat.visible = eatable;
    this.eat.position.y = showBars ? 22 : 8;
  }

  remove() { this.scene.remove(this.group); }
}
