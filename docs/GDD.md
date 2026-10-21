# Froggy Ballin — Game Design Document

> Version 1.0 · 2026-10-21 · Game director: Kutkarshhh
> JetBrains "Build a Game with an AI Coding Agent" jam entry. Built on the course's Three.js + Vite baseline.
> Deadline: ~2026-10-22 09:20 UTC (12 hours from kickoff).

---

## 1. Pitch

**You are your own worst enemy. Literally.**

Tode the frog has a sword, a gun with too few bullets, and a tongue that never stops. Every time he clears a level, time loops — and his *previous run* comes back as a glowing ghost that replays every step, every slash and every shot. To set a new record you have to race through the level, out-fight the bugs and bosses, **hunt down and kill your past self before it kills you**, and reach the goal before it does.

One-line hook: *a third-person bug-slaying frog action game where every personal best becomes your next boss.*

## 2. Pillars

1. **Race yourself.** The ghost is a perfect replay of your last run. It is the clock, a rival, and an enemy at once.
2. **Parry is king.** Precise timing beats spam. A perfect parry reflects projectiles and opens a big counter attack.
3. **Eat to live.** Healing comes from bugs: eat them with the tongue, or kill juicy bugs and absorb what spills out.
4. **Juicy and fast.** Short levels (2–4 min), big slashes, hitstop, screenshake, particles, punchy synth sounds.

## 3. Platform & tech

- Browser game, desktop (keyboard + mouse). Three.js `^0.181` + Vite `^7`. No other engine.
- World is **Z-up** (course convention: `camera.up = (0,0,1)`, models rotated `x = PI/2`).
- Camera: **third-person follow** behind and above Tode, mouse-controlled orbit (pointer lock). Slight top-down tilt keeps the "top-down-ish" feel of the course game.
- All art is either the course's bundled models, code-built low-poly meshes, CC0 packs, or AI-generated. All sound is synthesized in code with WebAudio (no recorded/commercial audio).

## 4. Controls

| Input | Action |
|---|---|
| WASD | Move (camera-relative) |
| Mouse | Orbit camera / aim |
| Left click | Sword slash (3-hit combo) |
| Right click | Parry |
| F | Shoot gun (limited ammo) toward crosshair |
| E | Tongue lash (grab + eat a bug; costs stamina) |
| Space | Jump (frog hop) |
| Shift | Dodge roll (short i-frames) |
| Esc / P | Pause |

All keys live in one `controls` config so they can be rebound quickly.

## 5. Core mechanics

### 5.1 Player stats
- **HP:** 100. **Ammo:** 12 max, start 8. **Tongue stamina:** 100, regenerates ~35/s after 0.4 s delay.
- Death = run over (stats screen, time not recorded as a win).

### 5.2 Sword
- 3-hit combo (L→R slash, R→L slash, overhead slam). 18 / 18 / 35 damage. Combo window 0.45 s.
- Each slash is an arc hitbox in front of Tode (radius ~2.2 units scaled, 140° arc). The slam is a small AoE.
- Visuals: curved additive "slash ribbon" mesh, sword trail, hit sparks, 50–80 ms hitstop on hit, tiny camera shake.

### 5.3 Parry (core mechanic)
- Right click opens a parry window.
  - **Perfect parry:** first 0.15 s. Melee attacks are deflected and the attacker is **staggered** for 1.2 s. Projectiles are **reflected** back at the shooter at 1.5× speed and 2× damage. Grants a **Counter**: the next slash within 1 s is a guaranteed critical (×3 damage, big VFX).
  - **Normal block:** 0.15–0.35 s. Damage reduced by 70%, no counter.
  - Recovery: 0.35 s where you can't parry again (prevents spam).
- Feedback: white flash, metallic "ting" synth, 120 ms slow-mo on perfect parry, ring shockwave.
- Some enemies/bosses can reflect *your* bullets back at you. You can parry those too (projectile ping-pong).

### 5.4 Gun
- Hitscan-feel fast projectile, 15 damage, fires toward the crosshair. Limited ammo.
- Ammo comes from Ammo Moth pickups, killing certain bugs (Shellback drops 2), and Counter kills (+1).
- Reflected/parried bullets are real projectiles that can hit anything, including the ghost.

### 5.5 Tongue
- Lash forward up to ~6 units; grabs the first small bug hit, pulls it in and eats it.
- Eating heals (+8 HP normal bug, +25 HP Juicebug). Costs 25 stamina. Stamina bar floats above Tode's head and refills quickly.
- Large enemies and bosses can't be eaten; the tongue does 5 damage and briefly interrupts them.

### 5.6 Healing
- Eating bugs (tongue).
- **Juicebugs**: plump glowing aphids that appear inside swarms. Killing one bursts it into green "juice" droplets that fly to Tode (+6 HP each, 4 droplets).
- No passive regen.

### 5.7 Dodge
- Shift: short roll in move direction, 0.25 s of i-frames, 0.8 s cooldown.

## 6. Time Loop mode (headline mode)

### 6.1 Loop structure
1. **Loop 1 — "First Run."** No ghost. You play the level normally. While you play, the **Recorder** captures your run.
2. When you reach the goal, your time is saved as your personal best (PB) and the run becomes the **Ghost**.
3. **Loop 2+.** The level resets with the same seeded spawns. Your Ghost plays back your previous run in real time alongside you.
4. To **win a loop** you must: kill the Ghost **and** reach the goal (boss must be dead for the goal to open) **before** the Ghost reaches the goal.
5. If the **Ghost reaches the goal first**, the game stops instantly, the time is recorded, and the stats screen is shown ("The past was faster.").
6. If you win, your new run replaces the Ghost for the next loop. If it is your best time, it becomes the new PB. Loop counter increases.

The ghost you race is your **previous winning run** (most recent). The PB time is tracked separately and shown on the HUD.

### 6.2 The Ghost
- Looks like Tode but translucent cyan/purple with an afterimage trail and an "ITERATION n-1" tag above it (runs are called iterations in all player-facing text; the mode is still "Time Loop").
- **Replays exactly**: position, facing, jumps, and every action (slash, shot, parry, tongue) at the original timestamps.
- **Its actions are real.** Its slashes and bullets damage *you* and live insects. It steals your kills and can hurt the boss.
- **It hunts you.** On top of the replay, the Ghost fires an "echo bolt" at you every ~4 s when you're within 15 units (parryable; perfect parry reflects it back at the Ghost for heavy damage). This makes the past version actively try to kill you, as the brief requires.
- **HP:** 150. Takes damage from your sword, bullets, and reflected bolts. When killed it shatters into time shards, the timeline HUD bar turns gold, and you only have the level left to finish.
- The Ghost cannot be eaten (tongue does 5 damage and slows it 50% for 1 s, which matters in a race).

### 6.3 Recording format
- Sample transform at 20 Hz: `{t, x, y, z, yaw, anim}`; actions as events `{t, type, dir}`.
- Playback interpolates between samples. Stored in `localStorage` per level (`froggy.ghost.<levelId>`), plus PB and stats.
- Spawns use a **seeded RNG** per level so the world matches between loops (it won't be perfectly deterministic and doesn't need to be).

### 6.4 Stats screen
Time, PB, delta vs PB (green/red), iteration number, kills (you vs ghost), perfect parries, accuracy, damage taken, bugs eaten, "Ghost killed at mm:ss.ms" or "Ghost reached goal". Buttons: **Next Iteration** (R), **Main Menu**.

## 7. Other modes
- **Classic Survival** (the course game, upgraded): endless arena with increasing difficulty and score, now with the full moveset. Keeps the original course loop playable and gives a fallback mode if Time Loop scope slips.
- **Boss Rush** (stretch): fight the bosses back to back with a timer.

## 8. Levels

Each level is a short course on a themed checkerboard map with houses/obstacles: **Start pad → 2–3 swarm zones → boss arena → Goal lily pad**. Gates between zones open when a zone is cleared. The goal only opens once the level's boss is dead.

| # | Name | Theme | Boss |
|---|---|---|---|
| 1 | Teatime Meadow | Tode's garden from the course, green checkerboard + houses | Hornet Queen |
| 2 | Rotwood Hollow | dark mossy log forest, mushrooms | Stag Beetle King |
| 3 | The Clockpond (stretch) | night pond with floating clock-face lily pads | Mantis Duelist |
| 4 | Final Iteration (stretch) | void-like arena | The Chrono Moth |

MVP target: **Level 1 fully done**, Level 2 if time allows.

## 9. Enemies

| Enemy | Role | Behaviour | Notes |
|---|---|---|---|
| **Gnat** | swarm fodder | fast, weak (10 HP), comes in clouds of 6–10 | edible (+8 HP) |
| **Juicebug** | heal source | slow, fat, glowing green, flees | burst = heal droplets |
| **Spitter Wasp** | ranged | hovers, fires acid globs (parryable, reflectable) | 30 HP |
| **Shellback Beetle** | tank / reflector | front shell **reflects your bullets** back at you; attack from behind or parry the reflected shot | 60 HP, drops ammo |
| **Ant Grunt** | melee | the course's `enemy.glb`, charges and bites with a telegraphed lunge (parry it) | 25 HP |

## 10. Bosses

Every boss has a **prelude animation** (see §11), a big HP bar with its name, 2 phases (phase 2 under 50% HP), and at least one attack built around the parry.

### 10.1 Hornet Queen (Level 1)
- Flying. HP 600.
- **Stinger Volley:** fans of 5 stingers; perfect parry reflects one back (big damage).
- **Dive Bomb:** telegraphed red ground marker, then dives. Parry at impact = she's grounded and stunned for 3 s.
- **Royal Guard:** summons 4 Gnats + 1 Juicebug (healing chance).
- Phase 2: faster volleys, dive-bomb twice in a row.

### 10.2 Stag Beetle King (Level 2)
- Heavy ground boss. HP 900.
- **Mandible Charge:** long charge; perfect parry = flips onto his back, 4 s weak point window.
- **Crown Shell:** front armor reflects all bullets. Shoot him only from behind, or parry the reflections.
- **Ground Slam:** shockwave rings you must jump over.
- Phase 2: charges chain into slams.

### 10.3 Mantis Duelist (Level 3, stretch)
- Sword duel boss. Fast scythe combos that can only be blocked by parry, rewarding a perfect rhythm. Counter attacks deal huge damage.

### 10.4 The Chrono Moth (final, stretch)
- Its wing dust "rewinds" its HP unless you kill its time-echo clones; ties into the loop theme.

## 11. Cutscenes & presentation

- **Comic panels:** HTML/CSS overlay over the canvas. 3–4 panels per scene, each panel an image (in-engine snapshot, code-drawn SVG, or AI-generated still) + typewriter text. Click/Space to advance, Esc to skip.
  - Intro: Tode's tea, a crack in time, the bugs pour in, "Again. And again. And again."
  - Loop 2 first time: "That glowing frog... is me?" (explains the ghost).
  - Victory/ending card.
- **Boss prelude (animated, in-engine):** letterbox bars slide in, camera flies around the arena, boss does an entrance move (Hornet Queen descends with buzzing particles), title card slams in: **"HORNET QUEEN — Sovereign of the Sting"**, screen shake, bars slide out, fight starts. 4–6 s, skippable.
- **Main menu:** 3D scene behind (Tode idling, slow camera orbit), title "FROGGY BALLIN", buttons: Time Loop, Classic Survival, How to Play, Credits. Shows PB per level.
- **HUD:** HP bar, ammo counter, tongue stamina above head, run timer + PB + delta, ghost HP bar + ghost progress bar (how close the ghost is to the goal), boss bar, power-up timers, crosshair.

## 12. Power-ups

Dropped by special bugs or placed on the course. Timed (10–12 s) unless noted.

| Power-up | Effect |
|---|---|
| **Firefly** | bullets ignite (burn damage), sword trail turns orange |
| **Dragonfly** | +40% speed, double jump, faster dodge |
| **Beetle Shell** | shield absorbs next 3 hits |
| **Time Snail** | slows the Ghost and all enemies by 50% for 6 s (the race-swinger) |
| **Big Mouth** | tongue range ×2, tongue hits pull in 3 bugs |
| **Ammo Moth** | instant +6 ammo |
| **Golden Fly** (stretch) | rewind 3 seconds (restores HP/position) |
| **Overclock** (stretch) | parry window doubled for 8 s |

## 13. Audio
- All SFX synthesized at runtime with WebAudio (oscillators + noise + envelopes): slash whoosh, hit thud, parry ting, gun pop, tongue "thwip", gulp, ghost whisper, boss roar, UI blips.
- Music (stretch): short procedural synth loop written in code (original composition). No commercially released music or recordings.

## 14. Art direction
- Bright, toy-like low-poly 3D. Tode uses the course's `tode.glb`. Ant Grunts use the course's `enemy.glb`. Houses use `small_house.glb`.
- Other bugs, bosses, sword, gun, VFX are built from Three.js primitives in code (or CC0 low-poly packs if needed, logged in `THIRD_PARTY_ASSETS.md`).
- Ghost: cyan/purple translucent, fresnel-ish glow, afterimage trail.
- Hit VFX: white flash on hit, sparks, juice droplets (green), time shards (gold).

## 15. Scope & cut lines

**Must ship (MVP):** baseline movement/camera/world, sword + parry + gun + tongue, 4 enemy types, Level 1, Time Loop with recording/ghost/stats/PB, Hornet Queen with prelude, main menu, HUD, synthesized SFX, compliance docs.

**Should ship:** Stag Beetle King + Level 2, intro comic cutscene, power-ups, Classic Survival mode, hitstop/screenshake polish.

**Stretch:** Mantis Duelist, Chrono Moth, Boss Rush, music, Golden Fly rewind, gamepad.

Cut order if late: stretch → Level 2 → power-ups beyond Time Snail/Firefly/Beetle Shell → comic intro (keep boss prelude).

## 16. Jam compliance (mandatory)
- No third-party trademarks/logos, recognizable fictional characters, internet memes, or commercially released music/sound recordings. Boss and enemy names above are original/generic.
- Public GitHub repo, public until at least 2026-10-30.
- `LICENSE` + required attribution notice (course baseline is MIT © 2025 JetBrains Academy; keep it and add ours).
- Build/run instructions in `README.md`.
- `THIRD_PARTY_ASSETS.md`: every external asset, its source and license.
- `AI_DISCLOSURE.md`: which AI tools were used for which parts.

## 17. Round 2 addendum (posture, gun, tongue)
- **Posture:** every combatant has a stance bar. Hits, blocks and parries fill it; it drains after a short delay. Full bar = broken (stunned ~2.5 s), takes x3 deathblow damage and becomes edible. Player has a stance bar too (breaks for 1.4 s).
- **Big parry:** perfect-parrying a big enemy (shellback, bosses) freezes the game ~0.45 s (hitstop + slow-mo + white flash) and adds heavy posture damage.
- **Gun:** Q toggles weapon (1 sword / 2 gun); gun mode uses an over-the-shoulder camera, RMB/hold aims (ADS, tighter cone), LMB fires, limited ammo.
- **Tongue:** E lashes at the best target, preferring edible / broken / low-HP bugs (pink E marker); stamina bar limits spam.
- **New content:** Mantis Duelist (Clockpond), Chrono Moth (Final Iteration), Boss Rush, Golden Fly rewind, Overclock.

## 18. Round 3 addendum (refinement)
- **Perfect parry feel:** sparks + radial speed lines + white shockwave at the contact point, FOV zoom punch (~6 deg, eases back over 0.25 s), desaturated/darkened screen edges, layered clang + low thump whose pitch climbs with a PARRY xN streak (3 s window), blade glows and a COUNTER! prompt floats over Tode during the counter window, +15 stamina and posture relief, attacker is knocked back and flashes white. Normal parry hitstop 0.09 s; big parry 0.45 s with a 1.5 s cooldown. Plain block: dull thud, grey puff, pushback.
- **Pacing:** sword steps 0.22/0.22/0.34 s with a cancelable tail (70%), dodge cooldown 0.55 s, zone bugs arrive in mixed waves (60% now, rest after 3.5 s or when <=3 bugs remain), level layouts ~20% tighter, phase-2 bosses run attack timers x1.3 and all boss cooldowns x0.8, 4.2 s prelude skippable with any key.
- **Style rank D/C/B/A/S:** points for hits (4), kills (12), perfect parries (30), counters (20), deathblows (35), eating (10); -60 when hurt; decays after 2 s idle. Combo counter resets after 2.5 s without a hit. Best rank and max combo on the stats screen.
- **Spider Matriarch (Level 5, Mirewood Web):** web volley (parryable, web hits slow you), web traps (lobbed globs become sticky patches that slow to 45%), ceiling drop (climbs her silk, ground marker, perfect parry stuns), phase 2 broods of spiderlings. Mirewood has permanent web patches. Added to Boss Rush before the Chrono Moth.
- **New bugs:** Bomber Beetle (fuse 1 s then hops at you; perfect parry bats it away and it explodes on other bugs; otherwise it explodes on you), Leech (latches on a clean hit, drains 3 HP/s, slows 20% each; slash or tongue-eat to remove), Spiderling (fast, edible swarmer).
