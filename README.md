# Froggy Ballin

**Race your past self. Parry. Slash. Eat. Don't lose to the ghost of you.**

A third-person 3D browser game built for the JetBrains "Build a Game with an AI Coding Agent" game jam. You are **Tode the frog**, armed with a sword, a gun with too few bullets and a tongue that never stops. Clear a level and your run becomes a **ghost** that replays every move, slash and shot in the next loop, and hunts you down. Kill your past self, beat the boss and reach the goal before the ghost does.

## Features
- **Time Loop mode:** your last winning run replays as a ghost (position, slashes, shots, all real damage) and also fires echo bolts at you. Kill it before it reaches the goal. Personal best, loop counter and a full stats screen.
- **Sword combo + precision parry:** 3-hit combo, perfect-parry window staggers attackers, reflects projectiles back and opens a x3 counter crit. Some bugs and bosses reflect your bullets, so parry those back too.
- **Gun (limited ammo) and tongue** (stamina bar): eat bugs to heal, weakened bugs are edible too. Juicebugs burst into healing droplets.
- **Bugs:** Gnat swarms, Juicebugs, Spitter Wasps, Shellbacks, Ant Grunts.
- **Bosses with animated preludes:** Hornet Queen (Level 1), Stag Beetle King (Level 2).
- **Power-ups:** Firefly, Dragonfly, Beetle Shell, Time Snail, Big Mouth, Ammo Moth.
- **Comic-panel cutscenes**, main menu, **Classic Survival** mode (endless arena).
- Juice: hitstop, screenshake, slow-mo on perfect parry, synthesized sound effects and a small procedural music loop.

## Controls
| Input | Action |
|---|---|
| WASD | Move |
| Mouse (click to lock) / arrow keys | Aim camera |
| Left click | Sword combo |
| Right click | Parry (just before a hit lands) |
| F | Shoot |
| E | Tongue (eat) |
| Space | Jump (double jump with Dragonfly) |
| Shift | Dodge roll |
| P / Esc | Pause |
| M | Mute |

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
Three.js (`^0.181`) + Vite (`^7`), plain JavaScript. See `CLAUDE.md` for the architecture and `docs/GDD.md` for the design document.

## Credits, licensing and disclosures
- Based on the course project "Build a Game with an AI Coding Agent" by JetBrains Academy, MIT License. See `LICENSE`.
- Third-party assets and their licenses: `THIRD_PARTY_ASSETS.md`.
- AI tools used and for what: `AI_DISCLOSURE.md`.
- Jam rules: no third-party trademarks or logos, recognizable fictional characters, internet memes, or commercially released music/recordings. All sound is synthesized in code and all non-course art is original.
