export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedK = new Set();
    this.mb = new Set();
    this.pressedM = new Set();
    this.dx = 0;
    this.dy = 0;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressedK.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mb.clear(); });
    window.addEventListener('mousedown', (e) => { this.mb.add(e.button); this.pressedM.add(e.button); });
    window.addEventListener('mouseup', (e) => this.mb.delete(e.button));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => this.onLockChange && this.onLockChange(this.locked));
  }
  get locked() { return document.pointerLockElement === this.canvas; }
  requestLock() {
    try {
      const r = this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch { /* ignore */ }
  }
  exitLock() { if (this.locked) document.exitPointerLock(); }
  // Codes may be keyboard codes or 'Mouse0' / 'Mouse1' / 'Mouse2' (rebindable mouse buttons).
  down(c) { return c && c.startsWith('Mouse') ? this.mb.has(+c.slice(5)) : this.keys.has(c); }
  pressed(c) { return c && c.startsWith('Mouse') ? this.pressedM.has(+c.slice(5)) : this.pressedK.has(c); }
  mDown(b) { return this.mb.has(b); }
  mPressed(b) { return this.pressedM.has(b); }
  takeMouse() { const r = [this.dx, this.dy]; this.dx = 0; this.dy = 0; return r; }
  clear() { this.pressedK.clear(); this.pressedM.clear(); this.dx = 0; this.dy = 0; }
  endFrame() { this.pressedK.clear(); this.pressedM.clear(); }
}
