// Level definitions. Zones spawn their bugs (seeded) when the frog gets close.
export const LEVELS = [
  {
    id: 'meadow',
    name: 'Teatime Meadow',
    blurb: "Tode's garden. Something is buzzing in the flowers.",
    seed: 101,
    half: 1000,
    houses: 4,
    theme: { c1: '#228B22', c2: '#90EE90', sky: 0x9fe3ff, post: 0x8d6e63, prop: 0xff5577 },
    start: { x: -850, y: -850 },
    goal: { x: 850, y: 850 },
    zones: [
      { x: -380, y: -430, r: 430, spawns: [['gnat', 8], ['juicebug', 1], ['ant', 3]], pickups: [['ammo', 40, 40]] },
      { x: 160, y: -60, r: 450, spawns: [['gnat', 6], ['wasp', 2], ['ant', 3], ['shellback', 1], ['juicebug', 2]], pickups: [['ammo', 0, 80], ['dragon', -80, -60]] },
    ],
    bossZone: { x: 560, y: 560, r: 420 },
    boss: { type: 'hornet', x: 600, y: 600 },
  },
  {
    id: 'hollow',
    name: 'Rotwood Hollow',
    blurb: 'A dark log forest. The ground shakes with heavy steps.',
    seed: 777,
    half: 1100,
    houses: 6,
    theme: { c1: '#1d3b24', c2: '#3b5d3a', sky: 0x1a2a2f, skirt: 0x14221a, post: 0x4e342e, prop: 0xa070ff },
    start: { x: 900, y: -900 },
    goal: { x: -900, y: 900 },
    zones: [
      { x: 450, y: -450, r: 450, spawns: [['gnat', 8], ['wasp', 2], ['ant', 4], ['juicebug', 2]], pickups: [['ammo', 30, 30], ['firefly', -60, 40]] },
      { x: -50, y: 0, r: 480, spawns: [['gnat', 6], ['wasp', 3], ['shellback', 2], ['ant', 4], ['juicebug', 2]], pickups: [['ammo', 0, 80], ['shell', 70, -40], ['snail', -90, 20]] },
    ],
    bossZone: { x: -580, y: 580, r: 460 },
    boss: { type: 'stag', x: -620, y: 620 },
  },
];

export const SURVIVAL_LEVEL = {
  id: 'survival',
  name: 'Classic Survival',
  seed: 5,
  half: 900,
  houses: 3,
  theme: { c1: '#228B22', c2: '#90EE90', sky: 0x9fe3ff, post: 0x8d6e63, prop: 0xffaa33 },
  start: { x: 0, y: 0 },
  goal: { x: 5000, y: 5000 },
  zones: [],
};
