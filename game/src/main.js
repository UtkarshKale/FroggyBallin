import './style.css';
import './ui/ui.css';
import { Game } from './Game.js';

const canvas = document.querySelector('canvas.game');
const ui = document.getElementById('ui');
const game = new Game(canvas, ui);
game.init().catch((e) => {
  console.error(e);
  ui.innerHTML = `<div class="overlay show"><div class="card"><h2>Something broke</h2><p>${String(e)}</p></div></div>`;
});
window.__game = game;
