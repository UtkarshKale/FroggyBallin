import { fmtTime } from '../core/math.js';
import { LEVELS } from '../levels/levels.js';
import { Storage } from '../core/Storage.js';

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
    window.addEventListener('keydown', (e) => {
      if (this.cut && (e.code === 'Space' || e.code === 'Enter')) this.cut.next();
      else if (this.cut && e.code === 'Escape') this.cut.skip();
      else if (this.prel && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) this.prel.skip();
    });
    window.addEventListener('mousedown', (e) => {
      if (this.prel && e.button === 0) this.prel.skip();
    });
  }

  _set(html, cls = '') {
    this.overlay.className = 'overlay show ' + cls;
    this.overlay.innerHTML = html;
  }
  hide() { this.overlay.className = 'overlay'; this.overlay.innerHTML = ''; }
  _btn(id, fn) {
    const b = this.overlay.querySelector('#' + id);
    if (b) b.onclick = () => { this.g.sfx.init(); this.g.sfx.play('ui'); fn(); };
  }

  showMenu() {
    const cards = LEVELS.map((l) => {
      const pb = Storage.get(`pb.${l.id}`, null);
      return `<div class="lvl"><h3>${l.name}</h3><p>${l.blurb}</p>
        <div class="pb">${pb ? `Best ${fmtTime(pb.best)} · ${pb.wins} win${pb.wins === 1 ? '' : 's'}` : 'No record yet'}</div>
        <button class="menu-btn small" id="play-${l.id}">Time Loop</button>
        ${pb ? `<button class="menu-btn small alt" id="reset-${l.id}">Reset ghost</button>` : ''}</div>`;
    }).join('');
    this._set(`
      <h1 class="title">FROGGY BALLIN</h1>
      <div class="tagline">Race your past self. Parry. Slash. Eat. Don't lose to the ghost of you.</div>
      <div class="levels">${cards}</div>
      <button class="menu-btn alt" id="b-surv">Classic Survival</button>
      <button class="menu-btn alt" id="b-how">How to Play</button>
      <button class="menu-btn alt" id="b-cred">Credits</button>
      <button class="menu-btn small alt" id="b-mute">Sound: ${this.g.sfx.muted ? 'OFF' : 'ON'}</button>`, 'menu');
    for (const l of LEVELS) {
      this._btn(`play-${l.id}`, () => this.g.startRun('timeloop', l.id));
      this._btn(`reset-${l.id}`, () => { Storage.set(`ghost.${l.id}`, null); Storage.set(`pb.${l.id}`, null); this.showMenu(); });
    }
    this._btn('b-surv', () => this.g.startRun('survival'));
    this._btn('b-how', () => this.showHow());
    this._btn('b-cred', () => this.showCredits());
    this._btn('b-mute', () => { this.g.sfx.toggleMute(); this.showMenu(); });
  }

  showHow() {
    this._set(`<div class="card"><h2>How to Play</h2>
      <p><b>Time Loop:</b> Beat the level and your run becomes a <b style="color:#66ddff">ghost</b>. Next loop it replays every move, slash and shot, and it hunts you with echo bolts. Kill the ghost, defeat the boss, and reach the goal before the ghost does. If the ghost reaches the goal first, it's over.</p>
      <table>
        <tr><td>Move / Jump / Dodge</td><td>WASD / Space / Shift</td></tr>
        <tr><td>Aim camera</td><td>Mouse (click to lock pointer) or arrow keys</td></tr>
        <tr><td>Sword combo (3 hits)</td><td>Left click</td></tr>
        <tr><td>Parry</td><td>Right click, just before a hit lands</td></tr>
        <tr><td>Gun (limited ammo)</td><td>F</td></tr>
        <tr><td>Tongue: eat bugs, heals</td><td>E (uses stamina bar)</td></tr>
        <tr><td>Pause / Mute</td><td>P or Esc / M</td></tr>
      </table>
      <p><b>Perfect parry</b> (first 0.15s) staggers melee attackers, reflects projectiles and opens a <b>Counter</b>: your next slash crits for x3. Green <b>juicebugs</b> burst into healing droplets; weakened bugs can be eaten too. Shellbacks and the Stag King reflect bullets from the front.</p>
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
      <div class="btnrow"><button class="menu-btn" id="b-res">Resume</button><button class="menu-btn alt" id="b-restart">Restart Loop</button><button class="menu-btn alt" id="b-menu">Main Menu</button></div></div>`);
    this._btn('b-res', () => this.g.resume());
    this._btn('b-restart', () => this.g.restart());
    this._btn('b-menu', () => this.g.toMenu());
  }

  showStats(d) {
    const rows = [
      ['Time', fmtTime(d.time)],
      ...(d.mode === 'timeloop' ? [['Personal best', fmtTime(d.pb)], ['Loop', d.loopNo]] : [['Score', Math.floor(d.score)]]),
      ['Bugs slain (you / ghost)', `${d.kills} / ${d.ghostKills}`],
      ['Bugs eaten', d.eaten],
      ['Perfect parries', d.perfectParries],
      ['Gun accuracy', d.shots ? `${Math.round((d.hits / d.shots) * 100)}%` : '-'],
      ['Damage taken', Math.round(d.damageTaken)],
      ...(d.mode === 'timeloop' && d.hadGhost ? [['Ghost', d.ghostKilledAt != null ? `killed at ${fmtTime(d.ghostKilledAt)}` : d.ghostWon ? 'reached the goal first' : 'still alive']] : []),
    ];
    this._set(`<div class="card" style="min-width:min(520px,90vw)">
      <div class="stats-head"><h1 class="${d.win ? 'win' : 'lose'}">${d.title}</h1><div class="why">${d.why}${d.newPB ? ' <span class="newpb">NEW PERSONAL BEST!</span>' : ''}</div></div>
      <table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
      <div class="btnrow"><button class="menu-btn" id="b-again">${d.mode === 'timeloop' ? 'Loop Again (R)' : 'Try Again (R)'}</button><button class="menu-btn alt" id="b-menu">Main Menu</button></div></div>`);
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
    skipEl.textContent = 'Space / click to skip';
    requestAnimationFrame(() => { top.classList.add('on'); bot.classList.add('on'); });
    const slam = setTimeout(() => title.classList.add('slam'), 2400);
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
    this.prel = { skip: finish };
    return this.prel;
  }
}
