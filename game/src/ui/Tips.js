import { CFG } from '../config.js';
import { keyName } from '../core/Keybinds.js';

// Rotating gameplay tips. They read the live keybindings.
const POOL = (K, n) => [
  `Press ${n(K.parry)} just before a hit lands for a perfect parry: it staggers the attacker and opens a counter crit.`,
  'Yellow flash = normal attack, parry it. Red brush glyph = perilous, dodge it. Orange glyph = dodge through it for a riposte.',
  `After dodging an orange attack, hit ${n(K.slash)} at once: a riposte is a guaranteed crit with huge posture damage.`,
  `${n(K.dodge)} gives a short invincible roll. It is the only safe answer to red perilous attacks.`,
  'Jump over red shockwave rings instead of dodging them.',
  'Fill an enemy\'s posture bar to break it: broken enemies are stunned, edible and take a x3 deathblow.',
  'Perfect parries fill enemy posture fast. Bosses break after a few in a row.',
  `${n(K.tongue)} eats bugs with a pink E marker to heal. Broken or weak bugs are always edible.`,
  'Green juicebugs burst into healing droplets. Save them for when you need HP.',
  `${n(K.weapon)} swaps sword and gun. Hold ${n(K.parry)} with the gun to aim: tighter spread and more damage.`,
  `${n(K.shoot)} does a quick sword flurry from either weapon, even with the gun out.`,
  'Shellbacks and the Stag King reflect bullets from the front. Hit them from the side or parry the bounce back.',
  `Kills fill the ULT meter. Press ${n(K.ult)} when it is full; press it again to end the ultimate early.`,
  'Your ultimate turns the world ASCII: red glyphs are danger, green glyphs are health.',
  `Power-ups wait in your slots. Press ${n(K.power)} to use the oldest one when it matters most.`,
  'Time Shard freezes every bug for a few seconds. Great for escaping a swarm or a boss combo.',
  'Bomber Beetles light a fuse and hop at you. Perfect-parry them to bat them into other bugs.',
  'A leech on your back drains HP and slows you. Slash it off or eat it with the tongue.',
  'Webs on the ground slow you down. Roll across them or go around.',
  'Beat a level and your run becomes a ghost next iteration. Kill it before it reaches the goal.',
  'The ghost replays every slash and shot of your last win, and fires echo bolts. Parry those back at it.',
  'The goal only opens when the boss AND your ghost are dead.',
  'Follow the small arrow at your feet: yellow = next swarm, red = boss arena, cyan = ghost, green = goal.',
  'Gilded Flies from kills, elites, bosses and clears buy permanent upgrades in the Toad Shop.',
  'Croak raises your Ribbit Rank. Every rank gives a Lily Point for special Toad Shop perks.',
  'Second Wind from the Toad Shop revives you once at 40% HP.',
  'Higher difficulties give enemies longer reach, shorter warnings and fake-out wind-ups. Watch the glyph colour.',
  'Chain hits, parries and deathblows to climb the style rank from D to S. Getting hit drops it.',
  'Bosses have their own ultimate once per phase. Break their posture during it to cancel it.',
  'Reset iterations from the level list (or the stats screen) to start a level over from Iteration 1.',
];

let last = -1;
export function tip() {
  const pool = POOL(CFG.KEYS, keyName);
  let i = Math.floor(Math.random() * pool.length);
  if (i === last) i = (i + 1) % pool.length;
  last = i;
  return pool[i];
}
