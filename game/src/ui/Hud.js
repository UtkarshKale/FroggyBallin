import * as THREE from 'three';
import { CFG, POWERUPS } from '../config.js';
import { fmtTime } from '../core/math.js';

const tmp = new THREE.Vector3();

export class Hud {
  constructor(root) {
    this.root = document.createElement('div');
    this.root.style.display = 'none';
    this.root.innerHTML = `
      <div class="abs vignette"></div><div class="abs lowhp"></div><div class="abs sflash" id="h-sflash"></div><div class="abs pdim" id="h-pdim"></div><div class="abs perilv" id="h-perilv"></div>
      <div class="abs hud-tl panel-shadow">
        <div class="bar hp"><i id="h-hp"></i></div>
        <div class="row"><span id="h-hptxt">100</span><span class="ammo" id="h-ammo"></span></div>
        <div class="row"><span class="wpn" id="h-wpn"></span></div>
        <div class="ultbox" id="h-ultbox"><div class="bar ult"><i id="h-ult"></i></div><span class="ultlbl">ULT [G]</span></div>
      </div>
      <div class="abs hud-top panel-shadow">
        <div class="timer" id="h-time">00:00.00</div>
        <div class="sub" id="h-pb"></div>
        <div class="objective" id="h-obj"></div>
      </div>
      <div class="abs hud-tr panel-shadow" id="h-ghostbox">
        <div class="tag" id="h-ghosttag">GHOST</div>
        <div class="bar ghost"><i id="h-ghp"></i></div>
        <div class="stance" id="h-gstance" style="margin:5px 0 0 auto"><i class="sl"></i><i class="sr"></i></div>
        <div class="sub" style="margin:6px 0 2px;color:#ffd23f">Ghost reaches the goal</div>
        <div class="bar prog"><i id="h-gprog"></i></div>
      </div>
      <div class="abs bossbar panel-shadow" id="h-boss"><div class="name" id="h-bossname"></div><div class="bar boss"><i id="h-bosshp"></i></div><div class="stance" id="h-bossstance" style="margin:6px auto 0"><i class="sl"></i><i class="sr"></i></div></div>
      <div class="abs crosshair" id="h-cross"></div>
      <div class="abs stance pstance" id="h-stance"><i class="sl"></i><i class="sr"></i></div>
      <div class="abs stamina" id="h-stam"><div class="bar stam"><i id="h-stami"></i></div></div>
      <div class="abs powers panel-shadow" id="h-powers"></div>
      <div class="abs help panel-shadow">WASD move · Mouse aim · LMB slash · RMB parry · F shoot · E tongue · Space jump · Shift dodge · P pause · Q gun/sword · RMB hold (gun) aim · M mute</div>
      <div class="abs stylebox panel-shadow" id="h-style"><div class="rank" id="h-rank">D</div><div class="bar srank"><i id="h-srank"></i></div><div class="combo" id="h-combo"></div></div>
      <div class="abs counterp panel-shadow" id="h-counter">COUNTER!</div>
      <div class="abs pstreak panel-shadow" id="h-streak"></div>
      <div class="abs ink" id="h-ink"><b></b><i class="sub"></i></div>
      <div class="abs pslash" id="h-pslash"></div>
      <div class="abs flourish" id="h-flourish"><b>S-RANK RAMPAGE!</b></div>
      <div class="abs pwipe" id="h-pwipe"></div>
      <div class="abs dmgs" id="h-dmgs"></div>
      <div class="abs cutin" id="h-cutin"><div class="cpanel"><b></b><small></small></div></div>
      <div class="abs banner panel-shadow" id="h-banner"></div>
      <div class="abs toast panel-shadow" id="h-toast"></div>`;
    root.appendChild(this.root);
    const q = (id) => this.root.querySelector('#' + id);
    this.el = {
      hp: q('h-hp'), hptxt: q('h-hptxt'), ammo: q('h-ammo'), time: q('h-time'), pb: q('h-pb'), obj: q('h-obj'),
      ghostbox: q('h-ghostbox'), ghosttag: q('h-ghosttag'), ghp: q('h-ghp'), gprog: q('h-gprog'),
      boss: q('h-boss'), bossname: q('h-bossname'), bosshp: q('h-bosshp'), cross: q('h-cross'),
      stance: q('h-stance'), bossstance: q('h-bossstance'), gstance: q('h-gstance'), wpn: q('h-wpn'), sflash: q('h-sflash'),
      stam: q('h-stam'), pdim: q('h-pdim'), pslash: q('h-pslash'), flourish: q('h-flourish'), pwipe: q('h-pwipe'), dmgs: q('h-dmgs'), perilv: q('h-perilv'), ink: q('h-ink'), ult: q('h-ult'), ultbox: q('h-ultbox'), cutin: q('h-cutin'), style: q('h-style'), rank: q('h-rank'), srank: q('h-srank'), combo: q('h-combo'), counter: q('h-counter'), streak: q('h-streak'), stami: q('h-stami'), powers: q('h-powers'), banner: q('h-banner'), toast: q('h-toast'),
    };
    this.vig = this.root.querySelector('.vignette');
    this.low = this.root.querySelector('.lowhp');
    this.toastT = 0; this.bannerT = 0;
    this.lastPow = '';
    this.reduce = false;
    // Floating damage number pool
    this.nums = [];
    for (let i = 0; i < CFG.FEEL.dmgNumbers; i++) { const d = document.createElement('div'); d.className = 'dmgn'; this.el.dmgs.appendChild(d); this.nums.push(d); }
    this.numI = 0;
  }

  _replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // Tilted, outlined damage number popping at a world position.
  dmgNum(camera, x, y, z, amount, kind = '') {
    tmp.set(x, y, z).project(camera);
    if (tmp.z > 1) return;
    const d = this.nums[this.numI++ % this.nums.length];
    d.textContent = Math.round(amount);
    d.className = `dmgn ${kind}`;
    d.style.left = `${(tmp.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 30}px`;
    d.style.top = `${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px`;
    d.style.setProperty('--r', `${(Math.random() - 0.5) * 24}deg`);
    void d.offsetWidth;
    d.classList.add('go');
  }

  // Posture break: a red/white slash across the screen.
  postureSlash() { this.el.pslash.style.setProperty('--a', `${-20 + Math.random() * 40}deg`); this._replay(this.el.pslash, 'go'); }

  // S-rank flourish: flash, halftone dots, speed streaks and a big skewed word.
  flourish(word = 'S-RANK RAMPAGE!') {
    this.el.flourish.querySelector('b').textContent = word;
    this.el.flourish.classList.toggle('calm', this.reduce);
    this._replay(this.el.flourish, 'go');
  }

  // Quick skewed red bar sweep (boss phase changes).
  wipeFlash() { this._replay(this.el.pwipe, 'go'); }

  hitConfirm(strong) {
    this._replay(this.el.cross, strong ? 'hitc2' : 'hitc');
    if (!this.reduce && strong && document.body.classList.contains('crt')) {
      const c = document.querySelector('canvas.game');
      c.classList.add('fringe');
      clearTimeout(this._fr);
      this._fr = setTimeout(() => c.classList.remove('fringe'), CFG.FEEL.hitFringe * 1000);
    }
  }

  show(v) { this.root.style.display = v ? 'block' : 'none'; }

  hurt() {
    this.vig.style.opacity = 1;
    setTimeout(() => { this.vig.style.opacity = 0; }, 120);
  }

  screenFlash() {
    if (this.reduce) return;
    this.el.sflash.style.transition = 'none';
    this.el.sflash.style.opacity = 0.85;
    requestAnimationFrame(() => { this.el.sflash.style.transition = 'opacity .5s'; this.el.sflash.style.opacity = 0; });
  }

  // Perfect parry: desaturate + darken the screen edges for a beat (no black bars).
  parryDim(dur = 0.35) {
    const el = this.el.pdim;
    el.style.transition = 'none';
    el.style.opacity = 1;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = `opacity ${dur}s ease-out`; el.style.opacity = 0; }));
  }

  // Skewed panel that slides in from the side with a big italic word (ults, boss cards, level clear).
  cutIn(word, sub = '', kind = 'player') {
    const el = this.el.cutin;
    el.querySelector('b').textContent = word;
    el.querySelector('small').textContent = sub;
    el.className = `abs cutin ${kind}`;
    void el.offsetWidth;
    el.classList.add('go');
  }

  perilFlash(type) {
    if (this.reduce) return;
    const el = this.el.perilv;
    el.className = `abs perilv ${type}`;
    void el.offsetWidth;
    el.classList.add('go');
  }

  // Big centered ink-brush word (DEATHBLOW, RIPOSTE, POSTURE BROKEN, ...). kind: '' | 'counter' | 'death' | 'clear'
  ink(word, kind = '', sub = '') {
    const el = this.el.ink;
    el.querySelector('b').textContent = word;
    el.querySelector('.sub').textContent = sub;
    el.className = `abs ink ${kind}`;
    void el.offsetWidth;
    el.classList.add('go');
  }

  rankUp(letter, color) {
    const el = this.el.rank;
    el.classList.remove('up');
    void el.offsetWidth;
    el.classList.add('up');
  }

  parryStreak(n) {
    const el = this.el.streak;
    if (n < 2) return;
    el.textContent = `PARRY x${n}`;
    el.style.color = n >= 5 ? '#ffd23f' : n >= 3 ? '#9ff' : '#fff';
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  flash(text, color = '#fff') {
    this.el.toast.textContent = text;
    this.el.toast.style.color = color;
    this.el.toast.style.opacity = 1;
    this.toastT = 0.9;
  }

  banner(text, sub = '', color = '#fff', time = 2.2) {
    this.el.banner.innerHTML = `${text}<small>${sub}</small>`;
    this.el.banner.style.color = color;
    this.el.banner.style.opacity = 1;
    this.bannerT = time;
  }

  setBoss(boss) {
    this.el.boss.style.display = boss ? 'block' : 'none';
    if (boss) this.el.bossname.textContent = boss.name;
  }

  update(g, dt) {
    const e = this.el, p = g.player;
    e.hp.style.width = `${Math.max(0, p.hp)}%`;
    e.hptxt.textContent = Math.ceil(p.hp);
    this.low.style.opacity = p.hp < 30 ? 0.5 + 0.5 * Math.sin(performance.now() / 150) : 0;
    e.ammo.innerHTML = `<b>${'●'.repeat(p.ammo)}</b>${'○'.repeat(Math.max(0, CFG.PLAYER.maxAmmo - p.ammo))}`;
    e.time.textContent = fmtTime(g.simT);
    e.cross.style.display = 'block';
    const cc = 'abs crosshair' + (p.weapon === 'gun' ? ' gun' : '') + (p.aiming ? ' aim' : '');
    if (this._cc !== cc) { this._cc = cc; e.cross.className = cc; }
    e.wpn.innerHTML = p.weapon === 'gun' ? '[Q] <b style="color:#ffd23f">GUN</b> · RMB aim' : '[Q] <b style="color:#dfe8f0">SWORD</b> · RMB parry';
    const setStance = (el, frac, broken) => {
      el.firstElementChild.style.width = el.lastElementChild.style.width = `${(broken ? 1 : Math.min(1, frac)) * 50}%`;
      el.classList.toggle('broken', !!broken);
      el.classList.toggle('hot', frac > 0.7);
    };
    setStance(e.stance, p.posture / 100, p.broken > 0);

    const tl = g.mode === 'timeloop';
    e.ghostbox.style.display = tl && g.ghost ? 'block' : 'none';
    if (tl) {
      const best = g.pb;
      let pbtxt = best != null ? `PB ${fmtTime(best)}` : 'PB --';
      if (best != null) {
        const dd = g.simT - best;
        pbtxt += ` <span class="delta ${dd <= 0 ? 'good' : 'bad'}">${dd <= 0 ? '' : '+'}${dd.toFixed(1)}s</span>`;
      }
      e.pb.innerHTML = `<span class="dtag">${g.D.label}</span> ITERATION ${g.loopNo} · ${pbtxt}`;
    } else if (g.mode === 'bossrush') {
      e.pb.innerHTML = `<span class="dtag">${g.D.label}</span> BOSS RUSH · PB ${g.pb != null ? fmtTime(g.pb) : '--'}`;
    } else {
      e.pb.innerHTML = `<span class="dtag">${g.D.label}</span> SCORE ${Math.floor(g.score)} · BEST ${Math.floor(g.survBest || 0)}`;
    }
    e.obj.textContent = g.objective();

    if (g.ghost) {
      const gh = g.ghost;
      e.ghosttag.textContent = gh.dead ? 'GHOST DEFEATED' : `PAST SELF · ITERATION ${g.loopNo - 1}`;
      e.ghp.style.width = `${Math.max(0, (gh.hp / gh.maxHp) * 100)}%`;
      e.gprog.style.width = `${gh.dead ? 0 : gh.progress * 100}%`;
    }
    if (g.ghost && !g.ghost.dead) setStance(e.gstance, g.ghost.posture / g.ghost.postureMax, g.ghost.stunned);
    if (g.boss && g.boss.active && !g.boss.dead) setStance(e.bossstance, g.boss.posture / g.boss.postureMax, g.boss.stunned);
    if (g.boss && g.boss.active && !g.boss.dead) e.bosshp.style.width = `${Math.max(0, (g.boss.hp / g.boss.maxHp) * 100)}%`;

    // Floating stamina bar above the frog's head
    tmp.set(p.x, p.y, p.z + CFG.PLAYER.height + 24).project(g.world.camera);
    if (tmp.z < 1 && p.stamina < 99.5) {
      e.stam.style.display = 'block';
      e.stam.style.left = `${(tmp.x * 0.5 + 0.5) * window.innerWidth}px`;
      e.stam.style.top = `${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px`;
      e.stami.style.width = `${p.stamina}%`;
    } else e.stam.style.display = 'none';
    // Floating COUNTER! prompt while the counter window is open
    tmp.set(p.x, p.y, p.z + CFG.PLAYER.height + 46).project(g.world.camera);
    if (tmp.z < 1 && p.counterT > 0) {
      e.counter.style.display = 'block';
      e.counter.style.left = `${(tmp.x * 0.5 + 0.5) * window.innerWidth}px`;
      e.counter.style.top = `${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px`;
    } else e.counter.style.display = 'none';

    // Ult meter
    if (g.ult) {
      e.ult.style.width = `${g.ult.meter}%`;
      e.ultbox.classList.toggle('full', g.ult.meter >= 100 && g.ult.t <= 0);
      e.ultbox.classList.toggle('on', g.ult.t > 0);
    }

    // Style rank + combo
    if (g.style) {
      const R = CFG.STYLE.ranks, st = g.style, r = st.rank;
      const lo = R[r][0], hi = r + 1 < R.length ? R[r + 1][0] : CFG.STYLE.max;
      if (e.rank.textContent !== R[r][1]) e.rank.textContent = R[r][1];
      e.rank.style.color = R[r][2];
      e.srank.style.width = `${Math.min(100, ((st.pts - lo) / (hi - lo)) * 100)}%`;
      e.srank.style.background = R[r][2];
      e.combo.textContent = st.combo >= 2 ? `x${st.combo} COMBO` : '';
      e.style.style.opacity = st.pts > 0 || st.combo > 0 ? 1 : 0.45;
    }

    // Power-up chips
    let html = '';
    const chip = (key, label, val) => {
      const def = POWERUPS[key];
      html += `<div class="chip" style="border-color:#${def.color.toString(16).padStart(6, '0')}">${label} ${val}</div>`;
    };
    if (p.pu.fire > 0) chip('firefly', 'Firefly', p.pu.fire.toFixed(0) + 's');
    if (p.pu.dragon > 0) chip('dragon', 'Dragonfly', p.pu.dragon.toFixed(0) + 's');
    if (p.pu.big > 0) chip('bigmouth', 'Big Mouth', p.pu.big.toFixed(0) + 's');
    if (p.pu.shell > 0) chip('shell', 'Beetle Shell', 'x' + p.pu.shell);
    if (g.snailT > 0) chip('snail', 'Time Snail', g.snailT.toFixed(0) + 's');
    if (p.pu.over > 0) chip('over', 'Overclock', p.pu.over.toFixed(0) + 's');
    if (p.counterT > 0) html += `<div class="chip" style="border-color:#fff">COUNTER READY</div>`;
    if (html !== this.lastPow) { e.powers.innerHTML = html; this.lastPow = html; }

    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) e.toast.style.opacity = 0; }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) e.banner.style.opacity = 0; }
  }
}
