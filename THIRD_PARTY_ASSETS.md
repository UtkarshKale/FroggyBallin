# Third-party assets

| Asset | Used for | Source | License |
|---|---|---|---|
| `game/public/models/tode.glb` | Player character (Tode the Frog) and the ghost | "Build a Game with an AI Coding Agent" course, JetBrains Academy: https://github.com/jetbrains-academy/game-course | MIT (repository license), (c) 2025 JetBrains Academy |
| `game/public/models/enemy.glb` | Ant Grunt enemy | same course repository | MIT, (c) 2025 JetBrains Academy |
| `game/public/models/small_house.glb` | Obstacles / houses | same course repository | MIT, (c) 2025 JetBrains Academy |
| `game/public/tode.svg` | Favicon | same course repository | MIT, (c) 2025 JetBrains Academy |
| [Three.js](https://threejs.org) `^0.181` | 3D engine (+ `GLTFLoader`, `SkeletonUtils` addons) | npm | MIT |
| [Vite](https://vite.dev) `^7` | Dev server and bundler | npm | MIT |

Everything else is original to this project:
- All other meshes (bugs, bosses, sword, gun, pickups, hats and other wardrobe items, level decorations) are built from Three.js primitives in code.
- All UI textures (menu panels, glyph atlas, danger sigils, icons, ground tiles, sky gradients, sparks) are drawn at runtime on canvases or as inline SVG.
- Comic cutscene art is drawn in code as inline SVG (`game/src/ui/comics.js`).
- All sound effects and the music loop are synthesized at runtime with WebAudio (`game/src/audio/Sfx.js`). No recorded or commercial audio is used.

If you add an asset, add a row here in the same commit.
