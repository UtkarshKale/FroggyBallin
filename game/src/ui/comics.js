// Code-drawn comic panel art (inline SVG). Original artwork, no external assets.
const frog = (x, y, s = 1, color = '#4caf50', op = 1, sword = false) => `
  <g transform="translate(${x} ${y}) scale(${s})" opacity="${op}">
    <ellipse cx="0" cy="12" rx="38" ry="30" fill="${color}"/>
    <circle cx="-18" cy="-14" r="14" fill="${color}"/><circle cx="18" cy="-14" r="14" fill="${color}"/>
    <circle cx="-18" cy="-15" r="8" fill="#fff"/><circle cx="18" cy="-15" r="8" fill="#fff"/>
    <circle cx="-16" cy="-15" r="4" fill="#111"/><circle cx="20" cy="-15" r="4" fill="#111"/>
    <path d="M-16 16 Q0 28 16 16" stroke="#1b5e20" stroke-width="3" fill="none"/>
    ${sword ? '<rect x="38" y="-40" width="6" height="64" fill="#dfe8f0"/><rect x="30" y="20" width="22" height="5" fill="#ffc400"/>' : ''}
  </g>`;

const wrap = (bg, inner) => `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">${bg}${inner}</svg>`;
const sky = (a, b) => `<defs><linearGradient id="g${a.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="240" fill="url(#g${a.slice(1)})"/>`;
const ground = (c) => `<rect y="190" width="400" height="50" fill="${c}"/>`;

const bugs = (n, seed) => {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (i * 97 + seed * 31) % 380 + 10;
    const y = (i * 53 + seed * 17) % 150 + 20;
    out += `<g transform="translate(${x} ${y})"><ellipse rx="9" ry="6" fill="#2b2b3a"/><ellipse cx="-3" cy="-7" rx="8" ry="3" fill="#cde" opacity=".7"/><circle cx="8" cy="-1" r="2" fill="#f45"/></g>`;
  }
  return out;
};

export const INTRO_PANELS = [
  {
    text: 'Tode the frog only wanted one quiet cup of tea.',
    art: wrap(sky('#bfeaff', '#e8ffd9') + ground('#3fa34d'),
      `${frog(140, 160, 1.1)}<rect x="230" y="150" width="46" height="36" rx="8" fill="#fff"/><path d="M276 158 q22 8 0 22" stroke="#fff" stroke-width="6" fill="none"/><path d="M240 140 q-6 -14 4 -22 M256 140 q-6 -14 4 -22" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>`),
  },
  {
    text: 'Then the sky cracked. Time itself came loose.',
    art: wrap(sky('#2a1a4a', '#6a3fa0') + ground('#243a2a'),
      `<path d="M200 0 L180 60 L215 100 L190 160 L210 240" stroke="#fff" stroke-width="6" fill="none"/><circle cx="200" cy="110" r="44" fill="none" stroke="#9ff" stroke-width="4"/><path d="M200 110 L200 84 M200 110 L222 120" stroke="#9ff" stroke-width="4"/>${frog(90, 190, 0.8)}`),
  },
  {
    text: 'Bugs poured out of the seam. Thousands of them.',
    art: wrap(sky('#3a2a5a', '#7a4a6a') + ground('#2a3a2a'), `${bugs(40, 3)}${frog(200, 200, 0.9, '#4caf50', 1, true)}`),
  },
  {
    text: 'Again. And again. And again. Every loop, he must be faster.',
    art: wrap(sky('#102030', '#305070'),
      `<g fill="none" stroke="#9ff" stroke-width="3" opacity=".6"><circle cx="200" cy="120" r="30"/><circle cx="200" cy="120" r="60"/><circle cx="200" cy="120" r="90"/></g>${frog(200, 128, 0.9, '#4caf50', 1, true)}${frog(300, 70, 0.5, '#66ddff', 0.5, true)}`),
  },
];

export const GHOST_PANELS = [
  {
    text: 'A glowing frog stands in the meadow... and it looks exactly like Tode.',
    art: wrap(sky('#bfeaff', '#e8ffd9') + ground('#3fa34d'), `${frog(110, 170, 1, '#4caf50', 1, true)}${frog(290, 170, 1, '#66ddff', 0.55, true)}`),
  },
  {
    text: "It's his own last run, replaying every move. And it swings its sword at him.",
    art: wrap(sky('#2a1a4a', '#4a3fa0') + ground('#243a2a'), `${frog(120, 170, 1, '#4caf50', 1, true)}${frog(280, 170, 1, '#66ddff', 0.55, true)}<path d="M170 110 L230 110" stroke="#fff" stroke-width="5" stroke-dasharray="8 6"/>`),
  },
  {
    text: 'Beat the ghost. Reach the goal first. Be faster than yourself.',
    art: wrap(sky('#102030', '#305070') + ground('#2a4a3a'), `${frog(120, 175, 1, '#4caf50', 1, true)}<rect x="300" y="110" width="8" height="80" fill="#fff"/><path d="M308 110 L350 125 L308 140 Z" fill="#33ff77"/>`),
  },
];
