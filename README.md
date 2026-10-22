# Froggy Ballin

**Race your past self. Parry. Slash. Eat. Don't lose to the ghost of you.**

A third-person 3D browser game built for the JetBrains "Build a Game with an AI Coding Agent" game jam. You are **Tode the frog**, armed with a sword, a gun with too few bullets and a tongue that never stops. Clear a level and your run becomes a **ghost** that replays every move, slash and shot in the next loop, and hunts you down. Kill your past self, beat the boss and reach the goal before the ghost does.

## Features
- **Time Loop mode:** your last winning run replays as a ghost (position, slashes, shots, all real damage) and also fires echo bolts at you. Kill it before it reaches the goal. Personal best, loop counter and a full stats screen.
- **Sword combo + precision parry:** 3-hit combo, perfect-parry window staggers attackers, reflects projectiles back and opens a x3 counter crit. Some bugs and bosses reflect your bullets, so parry those back too. Parrying something big gives a short capped punch (max 0.25 s) and slow-mo; the game never freezes.
- **Quick sword flurry (F):** a fast 3-hit flurry from either weapon; in gun mode Tode draws the sword, slashes and goes back to the gun.
- **Posture (stance) bars:** every enemy, boss and the ghost has one. Hits and parries fill it; a full bar breaks the target (stunned, edible, deathblow x3). Your own bar fills when you block or get hit.
- **Gun mode:** press Q to equip. Tode holds the gun in his hand (sword slung on his back), free 360 degree aim with an over-the-shoulder camera that avoids walls; the reticle marks the real aim point and locks red on targets. LMB fires (hold to auto-fire) with tracers, recoil, shell sparks and hit markers; hold RMB to aim down sights (tighter spread, bonus damage, slower). Limited ammo with an on-gun counter.
- **Tongue** (stamina bar): auto-targets edible bugs (pink **E** marker); broken bugs are always edible. Eating heals. Juicebugs burst into healing droplets.
- **Bugs:** Gnat swarms, Juicebugs, Spitter Wasps, Shellbacks, Ant Grunts, **Bomber Beetles** (fuse + hop; parry to bat them into other bugs), **Leeches** (latch on and drain; slash or eat them), Spiderlings.
- **Five levels, five bosses with animated preludes:** Hornet Queen (Teatime Meadow), Stag Beetle King (Rotwood Hollow), Mantis Duelist (The Clockpond), Chrono Moth (Final Iteration), **Spider Matriarch (Mirewood Web)**: web volleys, sticky web traps, ceiling drops and spiderling broods.
- **Modes:** Time Loop (per level, with ghost), **Boss Rush** (all five in a row), Classic Survival (endless arena).
- **Power-ups:** Firefly, Dragonfly, Beetle Shell, Time Snail, Big Mouth, Ammo Moth, Golden Fly (rewind 3s), Overclock (double parry window), **Ricochet Shots**, **Thorn Shell**, **Magnet Tongue**, **Time Shard** (freezes bugs). Glowing gem pickups with drop beams, an aura on Tode and ring timers on the HUD.
- **Comic-panel cutscenes** and a **3D menu**: Tode on a lily pad at dusk, options as in-world neon panels (mouse, arrows/WASD + Enter, Esc back), with rooms for levels, difficulty, wardrobe, settings, keybinds, how to play and credits. Stats/death screens are a 3D camera moment. Classic flat menus remain as an option.
- **Toad Shop:** kills, elites, bosses, level clears and S ranks earn **Gilded Flies**; kills, parries and deathblows earn **Croak**, which raises your **Ribbit Rank** (each rank gives a **Lily Point**). Old Hopwell the merchant toad sells permanent upgrades (max HP, stamina, sword/gun damage, combo speed, parry window, posture guard, dodge cooldown, ammo, tongue range/healing, ult charge/duration, an extra power-up slot, pickup magnet), one-run items (ammo pack, shield charge, lucky jar, Second Wind revive) and wardrobe bundles. Refund-all anytime. Stats show what you earned and how many upgrades you used.
- **Power-ups** are stored in two slots and used with **X**.
- **Wardrobe:** skin colour, pattern glow, eyes, hats (bandana, headband, party hat, flower, top hat, cape, crown, halo), blade / hilt / trail / gun / tongue / parry-flash / death-splat colours; some unlock via achievements. Your ghost wears the outfit its run was recorded with.
- **Options:** full keybinds (keys or mouse buttons, conflict swap, per-action reset), mouse / aim / vertical sensitivity, invert Y, FOV, camera distance, aim assist, master/SFX/music volume, HUD scale/opacity/corner, damage numbers, CRT overlay, reduce flashing, low quality.
- **Perfect parry feel:** contact sparks, radial speed lines, shockwave, camera zoom punch, desaturated screen edges, layered clang that climbs in pitch with a PARRY xN streak, glowing blade + COUNTER! prompt, attacker knockback. Plain blocks are a dull thud.
- **Ultimate (ASCII mode):** style, kills and parries fill the ULT meter; press **G** when full for 10 s where the world turns into monochrome ASCII (red = danger, green = health) and everything you do is x3. Bosses have their own telegraphed ult once per phase (each with a unique twist); break their posture to cancel it.
- **Attack types:** yellow flash = normal (parry it), red brush glyph = perilous (can't be parried, dodge or jump), orange glyph = perilous counter (dodge through it to open a RIPOSTE for a guaranteed crit).
- **Difficulties:** BABY, NORMAL, MAYHEM, TORTURE (chosen on the menu; records kept per difficulty).
- **Presentation:** ink-brush banners (YOU DIED, DEATHBLOW, POSTURE BROKEN, PERILOUS, RIPOSTE), angular halftone HUD, floating damage numbers, rank slams, S-rank flourish, cut-ins, neon telegraphs, menu wipes. Settings: CRT overlay and Reduce flashing/effects.
- **Style rank (D to S)** and combo counter: hits, kills, parries, counters and deathblows raise it; idling and getting hit drop it.
- **Animation blending:** a pose controller cross-fades idle / walk / run (with lean), jump, dodge roll, each sword strike, parry, hit flinch, stagger, tongue, ult and death; the rigged ant cross-fades its animation clips; bugs and bosses blend their poses.
- **Level art:** procedural, instanced grass, flowers, mushrooms, rocks, logs, reeds, lily pads, crystals, gradient skies, light rays, ambient particles and fireflies per theme; boss arenas ringed with stones and lanterns; size/hue bug variants and gold elites.
- Juice: anticipation/follow-through sword swings with a tip trail, squash and stretch, tongue wobble, spawn pops, hit wobble, spin-and-splash deaths, breathing bosses, camera roll on dodge, hitstop, screenshake, synthesized sound effects and a small procedural music loop.
- **Pacing:** fast cancelable combo, short dodge cooldown, zones spawn in quick waves, compact levels, faster phase-2 bosses, any key skips boss intros.

## Controls
| Input | Action |
|---|---|
| WASD | Move |
| Mouse (click to lock) / arrow keys | Aim camera |
| Left click | Sword combo (gun mode: fire) |
| Right click | Parry just before a hit lands (gun mode: hold to aim) |
| Q (or 1 / 2) | Equip gun / sword |
| F | Quick sword flurry (either weapon) |
| E | Tongue (eat) |
| Space | Jump (double jump with Dragonfly) |
| Shift | Dodge roll (dodges perilous attacks; dodging an orange one opens a riposte) |
| G | Ultimate (when the ULT meter is full; press again to end it early) |
| X | Use a stored power-up |
| P / Esc | Pause |
| M | Mute |
| R | Restart from the stats screen |

All keyboard and mouse actions can be rebound in **Keybinds** (main menu or pause menu).

## Build and run
Requires Node 18+.

```bash
cd game
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in game/dist
npm run preview    # serve the production build
```

## Tech
Three.js (`^0.181`) + Vite (`^7`), plain JavaScript. See `docs/GDD.md` for the design document.

## Credits, licensing and disclosures
- Based on the course project "Build a Game with an AI Coding Agent" by JetBrains Academy, MIT License. See `LICENSE`.
- **Froggy Ballin itself is not open source.** This repository is public only for jam evaluation and playtesting; no public or other use is allowed. See `LICENSE-FROGGY-BALLIN.md`. The course-derived parts stay MIT (`LICENSE`).
- Third-party assets and their licenses: `THIRD_PARTY_ASSETS.md`.
- AI tools used and for what: `AI_DISCLOSURE.md`.
- Jam rules: no third-party trademarks or logos, recognizable fictional characters, internet memes, or commercially released music/recordings. All sound is synthesized in code and all non-course art is original.
