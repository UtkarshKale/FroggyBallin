import { fmtTime } from '../core/math.js';
import { LEVELS } from '../levels/levels.js';
import { Storage } from '../core/Storage.js';
import { DIFFICULTY } from '../config.js';

// Menu, pause, stats, comic cutscenes, boss prelude. All DOM overlays.
export class Screens {
  constructor(root, game) {
    this.g = game;
    this.root = root;
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    root.appendChild(this.overlay);
    this.cut = null;
    this.prel = null;
    // Run-transition wipe and CRT overlay live outside the overlay so they survive screen swaps.
    this.wipeEl = document.createElement('div'); this.wipeEl.className = 'runwipe'; this.wipeEl.innerHTML = '<i></i><i></i>';
    root.appendChild(this.wipeEl);
    const crt = document.createElement('div'); crt.className = 'crtfx'; document.body.appendChild(crt);
    this.applySettings();
    window.addEventListener('keydown', (e) => {
      if (this.cut && (e.code === 'Space' || e.code === 'Enter')) this.cut.next();
      else if (this.cut && e.code === 'Escape') this.cut.skip();
      else if (this.prel && !e.repeat && this.prel.ready()) this.prel.skip();
    });
    window.addEventListener('mousedown', (e) => {
      if (this.prel && this.prel.ready()) this.prel.skip();
    });
  }

  _set(html, cls = '') {
    this.overlay.className = 'overlay show ' + cls;
    this.overlay.innerHTML = html + '<div class="hlbar"></div>';
    // Skewed highlight bar that snaps to whichever button is hovered.
    const bar = this.overlay.querySelector('.hlbar');
    this.overlay.querySelectorAll('.menu-btn, .diff-btn').forEach((b) => b.addEventListener('mouseenter', () => {
      const o = this.overlay.getBoundingClientRect(), r = b.getBoundingClientRect();
      bar.style.left = `${r.left - o.left + this.overlay.scrollLeft - 6}px`; bar.style.top = `${r.top - o.top + this.overlay.scrollTop + 4}px`;
      bar.style.width = `${r.width + 12}px`; bar.style.height = `${r.height}px`;
      bar.classList.add('on');
    }));
  }

  // Red/black skewed wipe; fn runs while the screen is covered.
  wipe(fn) {
    if (Storage.get('set.reduce', false)) { fn(); return; }
    const w = this.wipeEl;
    w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
    setTimeout(fn, 330);
  }

  applySettings() {
    const reduce = Storage.get('set.reduce', false), crt = Storage.get('set.crt', true);
    document.body.classList.toggle('reduce', reduce);
    document.body.classList.toggle('crt', crt);
    if (this.g.hud) this.g.hud.reduce = reduce;
    if (this.g.fx) this.g.fx.shakeMul = reduce ? 0.35 : 1;
  }

  showSettings() {
    const reduce = Storage.get('set.reduce', false), crt = Storage.get('set.crt', true);
    this._set(`<div class="card" style="min-width:min(480px,90vw)"><h2>Settings</h2>
      <div class="setrow"><span>CRT overlay (scanlines, vignette, colour fringe on big hits)</span><button class="menu-btn small ${crt ? '' : 'alt'}" id="s-crt">${crt ? 'ON' : 'OFF'}</button></div>
      <div class="setrow"><span>Reduce flashing / effects (no screen flashes, softer shake, short wipes)</span><button class="menu-btn small ${reduce ? '' : 'alt'}" id="s-red">${reduce ? 'ON' : 'OFF'}</button></div>
      <div class="setrow"><span>Sound</span><button class="menu-btn small ${this.g.sfx.muted ? 'alt' : ''}" id="s-snd">${this.g.sfx.muted ? 'OFF' : 'ON'}</button></div>
      <div class="btnrow"><button class="menu-btn small" id="b-back">Back</button></div></div>`, 'menu');
    this._btn('s-crt', () => { Storage.set('set.crt', !crt); this.applySettings(); this.showSettings(); });
    this._btn('s-red', () => { Storage.set('set.reduce', !reduce); this.applySettings(); this.showSettings(); });
    this._btn('s-snd', () => { this.g.sfx.toggleMute(); this.showSettings(); });
    this._btn('b-back', () => this.showMenu());
  }
  hide() { this.overlay.className = 'overlay'; this.overlay.innerHTML = ''; }
  _btn(id, fn) {
    const b = this.overlay.querySelector('#' + id);
    if (b) b.onclick = () => { this.g.sfx.init(); this.g.sfx.play('ui'); fn(); };
  }

  showMenu() {
    const cards = LEVELS.map((l) => {
      const pb = Storage.get(this.g.sk('pb', l.id), null);
      return `<div class="lvl"><h3>${l.name}</h3><p>${l.blurb}</p>
        <div class="pb">${pb ? `Best ${fmtTime(pb.best)} · ${pb.wins} win${pb.wins === 1 ? '' : 's'}` : 'No record yet'}</div>
        <button class="menu-btn small" id="play-${l.id}">Time Loop</button>
        ${pb ? `<button class="menu-btn small alt" id="reset-${l.id}">Reset ghost</button>` : ''}</div>`;
    }).join('');
    const cur = this.g.diffKey;
    const diffs = Object.entries(DIFFICULTY).map(([k, v]) => `<button class="diff-btn ${k === cur ? 'on' : ''}" id="d-${k}">${v.label}</button>`).join('');
    const rush = Storage.get(this.g.sk('pb', 'bossrush'), null);
    this._set(`
      <h1 class="title">FROGGY BALLIN</h1>
      <div class="tagline">Race your past self. Parry. Slash. Eat. Don't lose to the ghost of you.</div>
      <div class="diffrow">${diffs}</div>
      <div class="diffdesc">${DIFFICULTY[cur].desc}</div>
      <div class="levels">${cards}</div>
      <button class="menu-btn alt" id="b-rush">Boss Rush${rush ? ' (best ' + fmtTime(rush.best) + ')' : ''}</button>
      <button class="menu-btn alt" id="b-surv">Classic Survival</button>
      <button class="menu-btn alt" id="b-how">How to Play</button>
      <button class="menu-btn alt" id="b-cred">Credits</button>
      <button class="menu-btn alt" id="b-set">Settings</button>`, 'menu');
    for (const l of LEVELS) {
      this._btn(`play-${l.id}`, () => this.wipe(() => this.g.startRun('timeloop', l.id)));
      this._btn(`reset-${l.id}`, () => { Storage.set(this.g.sk('ghost', l.id), null); Storage.set(this.g.sk('pb', l.id), null); this.showMenu(); });
    }
    for (const k of Object.keys(DIFFICULTY)) this._btn(`d-${k}`, () => { this.g.setDifficulty(k); this.showMenu(); });
    this._btn('b-rush', () => this.wipe(() => this.g.startRun('bossrush')));
    this._btn('b-surv', () => this.wipe(() => this.g.startRun('survival')));
    this._btn('b-how', () => this.showHow());
    this._btn('b-cred', () => this.showCredits());
    this._btn('b-set', () => this.showSettings());
  }

  showHow() {
    this._set(`<div class="card"><h2>How to Play</h2>
      <p><b>Time Loop:</b> Beat the level and your run becomes a <b style="color:#66ddff">ghost</b>. Next iteration it replays every move, slash and shot, and it hunts you with echo bolts. Kill the ghost, defeat the boss, and reach the goal before the ghost does. If the ghost reaches the goal first, it's over.</p>
      <table>
        <tr><td>Move / Jump / Dodge</td><td>WASD / Space / Shift</td></tr>
        <tr><td>Aim camera</td><td>Mouse (click to lock pointer) or arrow keys</td></tr>
        <tr><td>Sword combo (3 hits)</td><td>Left click</td></tr>
        <tr><td>Parry</td><td>Right click, just before a hit lands</td></tr>
        <tr><td>Equip gun / sword</td><td>Q (or 1 / 2). Gun: LMB fire, hold RMB to aim</td></tr>
        <tr><td>Quick shot (any weapon)</td><td>F</td></tr>
        <tr><td>Tongue: eat bugs, heals</td><td>E (pink E marker = edible)</td></tr>
        <tr><td>Ultimate (when the meter is full)</td><td>G</td></tr>
        <tr><td>Pause / Mute</td><td>P or Esc / M</td></tr>
      </table>
      <p><b>Posture:</b> every enemy has a stance bar. Hits and parries fill it; when it's full the enemy is <b>broken</b>: stunned, edible, and a hit becomes a <b>deathblow</b> (x3). Your own bar (bottom centre) fills when you block or get hit. Perfect-parrying something big freezes time for a moment.</p>
      <p><b>Perfect parry</b> (first 0.15s) staggers melee attackers, reflects projectiles and opens a <b>Counter</b>: your next slash crits for x3. Green <b>juicebugs</b> burst into healing droplets; weakened bugs can be eaten too. Shellbacks and the Stag King reflect bullets from the front.</p>
      <p><b>Read the telegraph colour.</b> <b style="color:#ffdd44">Yellow/white flash</b>: normal attack, parry it. <b style="color:#ff2233">Red glyph</b>: perilous, it can't be parried and hits hard, dodge it (Shift) or jump shockwave sweeps. <b style="color:#ff9a1a">Orange glyph</b>: perilous counter, dodge through it to open a short <b>RIPOSTE</b> window: slash right away for a guaranteed crit with huge posture damage.</p>
      <p><b>Ultimate:</b> style, kills and parries fill the ULT meter. Press <b>G</b> when it's full: 10 seconds of ASCII mode where everything you do is x3. Bosses have their own ult once per phase. Break their posture to cancel it.</p>
      <p><b>Difficulty:</b> BABY, NORMAL, MAYHEM or TORTURE, chosen on the menu. Records are kept per difficulty.</p>
      <p><b>Bomber Beetles</b> light a fuse and hop at you: perfect-parry them to bat them into other bugs. <b>Leeches</b> latch on and drain you: slash or eat them. <b>Webs</b> on the ground slow you down. Chain hits, kills and parries to raise your <b>style rank</b> (D to S).</p>
      <div class="btnrow"><button class="menu-btn small" id="b-back">Back</button></div></div>`, 'menu');
    this._btn('b-back', () => this.showMenu());
  }

  showCredits() {
    this._set(`<div class="card"><h2>Credits</h2>
      <p><b>Froggy Ballin</b>, a JetBrains game jam entry. Built on the "Build a Game with an AI Coding Agent" course baseline by JetBrains Academy (MIT License): Tode the Frog, the ant enemy and house models, and the Three.js + Vite setup.</p>
      <p>Game director: Kutkarshhh. Code written with Claude Code (Anthropic). Cutscene art is drawn in code. All sound effects and music are synthesized in your browser with WebAudio. See <code>AI_DISCLOSURE.md</code> and <code>THIRD_PARTY_ASSETS.md</code> in the repository.</p>
      <div class="btnrow"><button class="menu-btn small" id="b-back">Back</button></div></div>`, 'menu');
    this._btn('b-back', () => this.showMenu());
  }

  showPause() {
    this._set(`<div class="card" style="text-align:center"><h2>Paused</h2><p>Click Resume to lock the mouse and continue.</p>
      <div class="btnrow"><button class="menu-btn" id="b-res">Resume</button><button class="menu-btn alt" id="b-restart">Restart Iteration</button><button class="menu-btn alt" id="b-menu">Main Menu</button></div></div>`);
    this._btn('b-res', () => this.g.resume());
    this._btn('b-restart', () => this.g.restart());
    this._btn('b-menu', () => this.g.toMenu());
  }

  showStats(d) {
    const rows = [
      ['Difficulty', d.diff],
      ['Time', fmtTime(d.time)],
      ...(d.mode === 'timeloop' ? [['Personal best', fmtTime(d.pb)], ['Iteration', d.loopNo]] : d.mode === 'bossrush' ? [['Personal best', fmtTime(d.pb)]] : [['Score', Math.floor(d.score)]]),
      ['Bugs slain (you / ghost)', `${d.kills} / ${d.ghostKills}`],
      ['Bugs eaten', d.eaten],
      ['Perfect parries', d.perfectParries],
      ['Best style rank / max combo', `${d.bestRank} / x${d.maxCombo}`],
      ['Gun accuracy', d.shots ? `${Math.round((d.hits / d.shots) * 100)}%` : '-'],
      ['Damage taken', Math.round(d.damageTaken)],
      ...(d.mode === 'timeloop' && d.hadGhost ? [['Ghost', d.ghostKilledAt != null ? `killed at ${fmtTime(d.ghostKilledAt)}` : d.ghostWon ? 'reached the goal first' : 'still alive']] : []),
    ];
    this._set(`<div class="card" style="min-width:min(520px,90vw)">
      <div class="stats-head"><h1 class="${d.win ? 'win' : 'lose'}">${d.title}</h1><div class="why">${d.why}${d.newPB ? ' <span class="newpb">NEW PERSONAL BEST!</span>' : ''}</div></div>
      <table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
      <div class="btnrow"><button class="menu-btn" id="b-again">${d.mode === 'timeloop' ? 'Next Iteration (R)' : 'Try Again (R)'}</button><button class="menu-btn alt" id="b-menu">Main Menu</button></div></div>`);
    this._btn('b-again', () => this.g.restart());
    this._btn('b-menu', () => this.g.toMenu());
  }

  // Comic panels. done() is called when finished or skipped.
  cutscene(panels, done) {
    let i = 0;
    const render = () => {
      const p = panels[i];
      this._set(`<div class="panel">${p.art}<div class="caption" id="cap"></div></div><div class="hint">Space / click: next · Esc: skip (${i + 1}/${panels.length})</div>`, 'comic');
      this.overlay.onclick = () => this.cut && this.cut.next();
      const cap = this.overlay.querySelector('#cap');
      let n = 0;
      clearInterval(this.cut.timer);
      this.cut.timer = setInterval(() => {
        n += 2;
        cap.textContent = p.text.slice(0, n);
        if (n >= p.text.length) clearInterval(this.cut.timer);
      }, 28);
    };
    const finish = () => {
      clearInterval(this.cut.timer);
      this.cut = null;
      this.overlay.onclick = null;
      this.hide();
      done();
    };
    this.cut = {
      timer: null,
      next: () => { i++; if (i >= panels.length) finish(); else render(); },
      skip: finish,
    };
    render();
  }

  // Boss prelude: letterbox bars, title card. Returns { skip, t } controller.
  preludeStart(boss, onDone) {
    this.hide();
    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; this.root.appendChild(d); return d; };
    const top = mk('letterbox top'), bot = mk('letterbox bottom');
    const title = mk('prelude-title');
    title.innerHTML = `<h1>${boss.name}</h1><h2>${boss.title}</h2>`;
    const skipEl = mk('skip panel-shadow');
    skipEl.textContent = 'Press any key to skip';
    requestAnimationFrame(() => { top.classList.add('on'); bot.classList.add('on'); });
    const slam = setTimeout(() => title.classList.add('slam'), 1700);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(slam);
      top.classList.remove('on'); bot.classList.remove('on');
      title.remove(); skipEl.remove();
      setTimeout(() => { top.remove(); bot.remove(); }, 650);
      this.prel = null;
      onDone();
    };
    // Ignore the movement key that was already held when the prelude started.
    const t0 = performance.now();
    this.prel = { skip: finish, ready: () => performance.now() - t0 > 400 };
    return this.prel;
  }
}
