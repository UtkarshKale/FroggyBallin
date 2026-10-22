# AI tools disclosure

This game was made with AI assistance, as the jam encourages.

| Tool | Used for |
|---|---|
| Claude (Anthropic) via Claude Code, Opus 5.5 | Game design document refinements, task planning refinements, architecture (`docs/GDD.md`, `CLAUDE.md`, `TODO.md`) |
| Claude (Anthropic) via Claude Code, Sonnet 5.5 | Writing the game code in `game/src/` (gameplay, enemies, bosses, ghost/time-loop system, UI, procedural audio, SVG comic art), plus README and docs |
| Claude (Anthropic) via Claude Code + a local headless Chrome (playwright-core, used only on the developer machine, not part of the game) | Automated play-testing: driving the dev server with scripted input, frame-time logging and screenshot audits to find bugs (e.g. the parry-freeze root cause) |
| Claude (Anthropic) in a Claude project / cloud coordinator session | Turning the director's feedback into task briefs, planning the order of work, and reviewing reports from the coding session |
| JetBrains course material / Junie guidelines | The course baseline (models, project setup) this game extends |

Human direction: the game concept, mechanics, scope decisions and playtesting are by the game director (Utkarsh Kale). No AI image or audio generators were used. Art other than the course models is code-drawn, and all audio is synthesized in the browser.

Please keep this file updated if other AI tools are used later.
