# Project: Space Pong with Cutscenes

A browser-based Pong game with a space-invaders aesthetic, featuring fully animated cutscenes for the narrative intro and defeat screens.

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Main game file — canvas, scoreboard, all game JS inline |
| `cutscenes.css` | All cutscene styles and keyframes (intro + defeat, shared keyframes) |
| `cutscenes.js` | Cutscene controllers — `.defeat` / `.victory` + shared audio helpers |
| `warrior-select.css` / `warrior-select.js` | Warrior selection screen |
| `defeat-preview.html` | Standalone preview — instantiates `Cutscenes.defeat.show()` |
| `victory-preview.html` | Standalone preview — instantiates `Cutscenes.victory.show()` |
| `dragon-studio-nuclear-explosion-386181.mp3` | Explosion sound, preloaded by `Cutscenes.init()` |
| `backgrounds/` | Background image assets (`background_N.jpg`) |
| `ARCHIVE/` | Stale files preserved for reference (not loaded by the game) |

## Architecture

### Game
- Canvas-based Pong rendered in `index.html`
- Canvas is 884px wide; scoreboard sits above it
- `neonColorCycle` keyframe is defined in `index.html`'s `<style>` block and referenced from `cutscenes.css` — keep it there

### Starfield
- `<canvas id="star-canvas">` sits above all other elements (`z-index: 100`, `background: #05050f`, `pointer-events: none`)
- `showStarCanvas()` / `hideStarCanvas()` in `index.html` toggle its `display` and the `requestAnimationFrame` render loop
- Starfield shows on splash + all cutscenes; hidden during gameplay
- `mountWithFadeIn()` in `cutscenes.js` calls `window.showStarCanvas()` automatically when any cutscene opens
- `hideStarCanvas()` is the first call in `beginGame()` when gameplay starts

### Cutscenes (`cutscenes.css` + `cutscenes.js`)
All cutscene styling lives in `cutscenes.css`, all controllers in `cutscenes.js`. Sections of the CSS:
1. **Narrative intro** — `#narrative-screen`, `#narrative-anim`, `#narrative-content`
2. **Shared keyframes** — `hov1/hov2/hov3` (hover loops), `iIn-*` (fly-in directions), `splashBlink`, `earthIn`
3. **Defeat cutscene** — `#defeat-screen`, `#defeat-anim`, `#defeat-headline`, `#defeat-content`

**Never duplicate shared keyframes** — `hov1/hov2/hov3` and `iIn-*` are reused across all cutscenes.

#### `cutscenes.js` API

```js
Cutscenes.init(audioCtx)        // hand over the game's AudioContext; preloads explosion MP3
Cutscenes.defeat.show()         // play earth-destruction; .hide(), .isVisible()
Cutscenes.victory.show(onDone)  // placeholder — not yet implemented
```

The narrative intro is driven entirely by `startNarrative()` / `typeStory()` / `skipStory()` in `index.html`; `Cutscenes` has no intro module.

Templates (`#narrative-screen`, `#defeat-screen`) live in `index.html`. Defeat clones its template on `show()` so CSS keyframes restart cleanly; the clone has its outer `id` removed (inner ids are kept for `querySelector('#defeat-subtitle')` etc.).

Shared audio helpers (`playTypeBeep`, `playEarthRumble`, `playEarthExplosion`) and the explosion-buffer cache live at the top of `cutscenes.js` — do not re-declare them in `index.html`.

## Defeat Cutscene Layout

All three sections use `position: absolute` so the globe lands at the same screen position as the intro cutscene's globe (i.e., `#defeat-anim` mirrors `#narrative-anim`):

1. `#defeat-headline` — "THE EARTH / IS / NO MORE" typewriter text (`top: 6%`, centered)
2. `#defeat-anim` — globe + invaders + skull + explosion (`top: 50%; transform: translate(-50%, -56%)`, 500×330px)
3. `#defeat-content` — subtitle, "you have failed", press-space prompt (`top: 72%`, centered)

The visual sandwich is preserved (headline top / anim middle / content bottom) but implemented via absolute positioning, not flex flow.

All elements inside `#defeat-anim` are `position: absolute` within the 500×330px container.

### Defeat Animation Timeline

| Time | Event |
|------|-------|
| 0s | Scene fades in (`dSceneIn`), invaders hovering |
| 2.5s | Invaders converge on globe (`dConv-*`, 1s) |
| 3.7s | Earth shakes (`dEarthShake`) |
| 4.5s | Earth flashes (`dEarthFlash`, 4 alternations) |
| 5.9s | Earth dies (`dEarthDie`), invaders scatter (`dScat-*`), collision flash appears, skull fades in |
| 7.0s | Headline text types in (CSS clip-path, neonColorCycle begins) |
| 7.5s | Skull begins hover loop |
| 9.8s | "you have failed" types in via JS at 38ms/char with `playTypeBeep` (~0.6s) |
| 11.2s | "humanity has been deemed not worthy" types in via JS at 38ms/char (~1.33s, after 800ms pause) |
| 12.5s | Press-space prompt fades in |
| 13.3s | Prompt begins blinking |

**Bottom text typing is JS-driven, not CSS.** `showDefeatScreen()` in `index.html` (and the `<script>` in `defeat-preview.html`) clear `#defeat-subtitle` / `#defeat-line3` and append one character every 38ms while calling `playTypeBeep()` — same pattern as the intro's `typeStory()`. The CSS only provides `neonColorCycle` styling on those elements; do not re-add `dTextReveal` here or it will fight the JS.

### Invader Convergence — Math Notes

Container is 500×330. Globe center is approximately (250, 165).

Resting positions use `left: calc(50% - Xpx)` which resolves to `(250 - X)px` from container left edge.

Convergence translate formula:
```
tx = globe_center_x - (left_px + emoji_half_width)
ty = globe_center_y - (top_px + emoji_half_height)
```

Emoji (`font-size: 40px`, `.other-em`) renders ~40×40px. Globe center ≈ (250, 165).

Converged layout is a hexagonal ring (radius ~22px) — 1 center + 6 positions — so all 7 fit within the globe's visual radius (~45px) without touching at `scale(0.55)`.

### Typewriter Effect

```css
.d-typeline { clip-path: inset(0 100% 0 0); }
@keyframes dType { to { clip-path: inset(0 -20px 0 0); } }
```

- `steps(N, end)` where N = character count of the line
- Final keyframe uses `-20px` (negative overshoot) to prevent floating-point rounding from cutting off the last character
- Lines chain: `#d-line1` ends at 7.65s, `#d-line2` starts at 7.65s, etc.

### Z-index Layering (inside `#defeat-anim`)

| Element | z-index | Notes |
|---------|---------|-------|
| `#dw-skull` | 2 | Under explosion |
| `#dw-collision` | 4 | Expands over skull as shockwave |

## Fonts

- `Orbitron` (700, 900) — headlines, alien text
- `Fredoka One` — (available, check usage)
- `Courier New` — body/prompt text

Both loaded via Google Fonts in `index.html` and `defeat-preview.html`.

## Claude Guidelines

- Prefer `/clear` between tasks instead of `/compact`
- When context is running low, stop and ask the user to start a fresh session rather than compacting
- Always check existing keyframes in `cutscenes.css` before adding new ones to avoid duplicates
- When making changes to the defeat animation timeline, update the timeline table in this file

## Key Conventions

- Background: `#05050f` (near-black, not pure black)
- Neon text uses `neonColorCycle` — cycling hue with text-shadow glow
- `mix-blend-mode: multiply` can remove white PNG backgrounds on dark backgrounds
- Keep `#defeat-anim` positioned identically to `#narrative-anim` (`position: absolute; top: 50%; left: 50%; transform: translate(-50%, -56%)`) so the globe/skull lands at the same screen position across both cutscenes
- Bottom defeat text (`#defeat-subtitle`, `#defeat-line3`) matches the intro `.hl` style (19px Courier New, letter-spacing 2px, `#bbb`, `neonColorCycle`) — keep them in sync if the intro style changes
- Hover animations (`hov1/hov2/hov3`) applied to **inner `<span>`**, fly-in/convergence applied to **outer `<div>`**
