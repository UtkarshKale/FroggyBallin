import { fmtTime } from '../core/math.js';
import { LEVELS } from '../levels/levels.js';
import { Storage } from '../core/Storage.js';
import { DIFFICULTY } from '../config.js';
import { Settings } from '../core/Settings.js';
import { ACTIONS, Keybinds, keyName } from '../core/Keybinds.js';
import { CFG } from '../config.js';
import { tip } from './Tips.js';

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
      // Arrow keys move focus between buttons of the visible DOM screen (Enter activates natively).
      if (!this.cut && !this.prel && this.overlay.classList.contains('show') && (e.code === 'ArrowDown' || e.code === 'ArrowUp')) {
        const bs = [...this.overlay.querySelectorAll('button')];
        if (bs.length) { e.preventDefault(); const i = bs.indexOf(document.activeElement); const n = e.code === 'ArrowDown' ? (i + 1) % bs.length : (i - 1 + bs.length) % bs.length; bs[n].focus(); bs[n].scrollIntoView({ block: 'nearest' }); }
        return;
      }
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
      bar.style.left = `${r.left - o.left + this.overlay.scrollLeft}px`; bar.style.top = `${r.bottom - o.top + this.overlay.scrollTop + 3}px`;
      bar.style.width = `${r.width}px`;
      bar.classList.add('on');
    }));
  }

  // Red/black skewed wipe; fn runs while the screen is covered.
  wipe(fn) {
    if (Settings.get('reduce')) { fn(); return; }
    const w = this.wipeEl;
    w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
    setTimeout(fn, 330);
  }

  applySettings() {
    const reduce = Settings.get('reduce'), crt = Settings.get('crt');
    document.body.classList.toggle('reduce', reduce);
    document.body.classList.toggle('crt', crt);
    document.documentElement.style.setProperty('--crt', Settings.get('crtStrength'));
    if (this.g.hud) this.g.hud.reduce = reduce;
    if (this.g.fx) this.g.fx.shakeMul = reduce ? 0.35 : 1;
  }

  showSettings(back = () => this.showMenu()) {
    const reduce = Settings.get('reduce'), crt = Settings.get('crt');
    this._set(`<div class="card" style="min-width:min(480px,90vw)"><h2>Settings</h2>
      <div class="setrow"><span>CRT overlay (scanlines, vignette, colour fringe on big hits)</span><button class="menu-btn small ${crt ? '' : 'alt'}" id="s-crt">${crt ? 'ON' : 'OFF'}</button></div>
      <div class="setrow"><span>Reduce flashing / effects (no screen flashes, softer shake, short wipes)</span><button class="menu-btn small ${reduce ? '' : 'alt'}" id="s-red">${reduce ? 'ON' : 'OFF'}</button></div>
      <div class="setrow"><span>3D menus and in-world HUD</span><button class="menu-btn small alt" id="s-3d">Switch to 3D</button></div>
      <div class="setrow"><span>Sound</span><button class="menu-btn small ${this.g.sfx.muted ? 'alt' : ''}" id="s-snd">${this.g.sfx.muted ? 'OFF' : 'ON'}</button></div>
      <div class="btnrow"><button class="menu-btn small" id="b-back">Back</button></div></div>`, 'menu');
    this._btn('s-crt', () => { Settings.set('crt', !crt); this.g.applySettings(); this.showSettings(back); });
    this._btn('s-red', () => { Settings.set('reduce', !reduce); this.g.applySettings(); this.showSettings(back); });
    this._btn('s-3d', () => { Settings.set('ui3d', true); this.g.applySettings(); if (this.g.state !== 'PAUSED') this.g.toMenu(); else this.showSettings(back); });
    this._btn('s-snd', () => { this.g.sfx.toggleMute(); this.showSettings(back); });
    this._btn('b-back', back);
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
      <button class="menu-btn alt" id="b-set">Settings</button>
      <button class="menu-btn alt" id="b-keys">Keybinds</button>`, 'menu');
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
    this._btn('b-keys', () => this.showKeybinds());
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
        <tr><td>Quick sword flurry (any weapon)</td><td>${keyName(CFG.KEYS.shoot)}</td></tr>
        <tr><td>Tongue: eat bugs, heals</td><td>E (pink E marker = edible)</td></tr>
        <tr><td>Ultimate (when the meter is full; again to end it)</td><td>${keyName(CFG.KEYS.ult)}</td></tr>
        <tr><td>Use a stored power-up (2 slots)</td><td>${keyName(CFG.KEYS.power)}</td></tr>
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
      <p><b style="color:#ffd23f;font-size:18px">Utkarsh Kale</b><br>Game director and developer (github.com/UtkarshKale)</p>
      <p><b>Froggy Ballin</b>, a JetBrains game jam entry built on the "Build a Game with an AI Coding Agent" course baseline by JetBrains Academy (MIT License): Tode the Frog, the ant enemy and house models, and the Three.js + Vite setup.</p>
      <p><b>License:</b> evaluation and playtesting only, no public use. Original work &copy; 2026 Utkarsh Kale, all rights reserved. Course baseline portions remain MIT. See <code>LICENSE</code>.</p>
      <p>Tools: Three.js and Vite. Made with AI assistance, see <code>AI_DISCLOSURE.md</code>.</p>
      <p>Assets: all other meshes, the UI art and the comic panels are drawn in code; all sound effects and music are synthesized in your browser with WebAudio (see <code>THIRD_PARTY_ASSETS.md</code>).</p>
      <div class="btnrow"><button class="menu-btn small" id="b-back">Back</button></div></div>`, 'menu');
    this._btn('b-back', () => this.showMenu());
  }

  showPause() {
    this._set(`<div class="card pausecard"><h2>Paused</h2><p>Resume locks the mouse again. ${keyName(CFG.KEYS.pause)} or Esc pauses.</p><p class="tipline"><b>TIP</b> ${tip()}</p>
      <div class="vbtns"><button class="menu-btn" id="b-res">Resume</button><button class="menu-btn alt" id="b-restart">Restart</button>
      <button class="menu-btn alt" id="b-set">Settings</button><button class="menu-btn alt" id="b-keys">Keybinds</button><button class="menu-btn alt" id="b-menu">Main Menu</button></div></div>`);
    this._btn('b-res', () => this.g.resume());
    this._btn('b-restart', () => this.g.restart());
    this._btn('b-set', () => this.showSettings(() => this.showPause()));
    this._btn('b-keys', () => this.showKeybinds(() => this.showPause()));
    this._btn('b-menu', () => this.wipe(() => this.g.toMenu()));
  }

  // Keybinds card (pause menu and classic menu): one row per action; conflicts swap; per-action and full reset.
  showKeybinds(back = () => this.showMenu(), msg = '') {
    const rows = ACTIONS.map(([a, n]) => `<tr><td>${n}</td><td><button class="menu-btn small kb" id="kb-${a}">${keyName(CFG.KEYS[a])}</button> <button class="menu-btn small alt kr" id="kr-${a}" title="Reset to default">Reset</button></td></tr>`).join('');
    this._set(`<div class="card" style="min-width:min(560px,92vw)"><h2>Keybinds</h2><p class="kbmsg">${msg || 'Click a key, then press a key or mouse button. Esc cancels. A key already in use swaps with the other action.'}</p>
      <table>${rows}</table>
      <div class="btnrow"><button class="menu-btn small alt" id="kb-all">Reset all keybinds</button><button class="menu-btn small" id="b-back">Back</button></div></div>`);
    for (const [a, n] of ACTIONS) {
      this._btn(`kb-${a}`, () => {
        const btn = this.overlay.querySelector(`#kb-${a}`);
        btn.textContent = 'Press...';
        const done = (code) => {
          window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onMouse, true);
          if (!code) { this.showKeybinds(back, 'Cancelled.'); return; }
          const sw = Keybinds.bind(a, code);
          this.g.applySettings();
          this.showKeybinds(back, sw ? `${keyName(code)} was used by ${Keybinds.label(sw)}: swapped.` : `${n} -> ${keyName(code)}`);
        };
        const onKey = (e) => { e.preventDefault(); e.stopPropagation(); done(e.code === 'Escape' ? null : e.code); };
        const onMouse = (e) => { e.preventDefault(); e.stopPropagation(); done('Mouse' + e.button); };
        setTimeout(() => { window.addEventListener('keydown', onKey, true); window.addEventListener('mousedown', onMouse, true); }, 120);
      });
      this._btn(`kr-${a}`, () => { Keybinds.reset(a); this.g.applySettings(); this.showKeybinds(back, `${n} reset.`); });
    }
    this._btn('kb-all', () => { Keybinds.resetAll(); this.g.applySettings(); this.showKeybinds(back, 'All keybinds reset.'); });
    this._btn('b-back', back);
  }

  statsRows(d) {
    return [
      ['Difficulty', d.diff],
      ['Time', fmtTime(d.time)],
      ...(d.mode === 'timeloop' ? [['Personal best', fmtTime(d.pb)], ['Iteration', d.loopNo]] : d.mode === 'bossrush' ? [['Personal best', fmtTime(d.pb)]] : [['Score', Math.floor(d.score)]]),
      ['Bugs slain (you / ghost)', `${d.kills} / ${d.ghostKills}`],
      ['Bugs eaten', d.eaten],
      ['Perfect parries', d.perfectParries],
      ['Best style rank / max combo', `${d.bestRank} / x${d.maxCombo}`],
      ['Gun accuracy', d.shots ? `${Math.round((d.hits / d.shots) * 100)}%` : '-'],
      ['Damage taken', Math.round(d.damageTaken)],
      ['Gilded Flies / Croak earned', `${d.gfEarned || 0} / ${d.croakEarned || 0}`],
      ['Ribbit Rank / Gilded Flies', `${d.rank} / ${d.gfTotal}`],
      ['Toad Shop upgrades used', d.upgrades ? `${d.upgrades} levels` : 'none'],
      ...(d.mode === 'timeloop' && d.hadGhost ? [['Ghost', d.ghostKilledAt != null ? `killed at ${fmtTime(d.ghostKilledAt)}` : d.ghostWon ? 'reached the goal first' : 'still alive']] : []),
    ];
  }

  showStats(d) {
    const rows = this.statsRows(d);
    this._set(`<div class="card" style="min-width:min(520px,90vw)">
      <div class="stats-head"><h1 class="${d.win ? 'win' : 'lose'}">${d.title}</h1><div class="why">${d.why}${d.newPB ? ' <span class="newpb">NEW PERSONAL BEST!</span>' : ''}</div></div>
      <table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
      <p class="tipline"><b>TIP</b> ${tip()}</p>
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
