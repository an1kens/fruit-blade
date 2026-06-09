# Fruit Blade — Webcam Ninja

A browser-based Fruit Ninja clone controlled entirely through **webcam hand tracking**. Slice flying fruits with your hands — no mouse or touch required.

## Features

- **10 fruit types** — each with unique sprites, juice colors, and slice sounds
- **Three game modes** — Classic (3 lives), Arcade (60-second timer), Zen (no bombs, no failure)
- **Easy / Medium / Hard** — tuned physics, slice thresholds, and hitbox forgiveness
- **MediaPipe Hand Landmarker** — real-time fingertip tracking with velocity-based slice detection
- **Index + middle finger blades** — up to four blade trails with two hands
- **Fist gate** — close your fist to hide the blade; open your hand to slash again
- **Swipe combos**, power-up bananas, fruit baskets, combo milestones, bombs
- **Sliceable canvas UI** — every screen uses your webcam + sliceable fruits (menu, pause, game over, leaderboard, stats)
- **Hybrid art pipeline** — SVG sprites + procedural fallbacks; HTML overlays minimal
- **Retention** — lifetime stats, daily challenge, unlockable blade skins
- **First-run tutorial** — 3-step sensei overlay after calibration

## Quick Start

### Requirements

- Modern browser with webcam support (Chrome, Edge, Safari, Firefox)
- **HTTPS or localhost** (required for `getUserMedia`)
- Internet on first load (MediaPipe models from CDN)

### Run locally

```bash
cd fruit-ninja-webcam
python3 -m http.server 8080
# or: npx serve -p 8080
```

Open **http://localhost:8080**, allow webcam access, calibrate your hand, slice a mode fruit.

### Controls

| Action | Input |
|--------|-------|
| Slice fruit | Fast hand swipe with fingers extended |
| Pause blade | Close fist (curl index + middle fingers) |
| Menu navigation | Slice on-screen menu fruits |
| Pause game | Pause button (top-left) or `P` / `Escape` |
| Fullscreen | Slice **Full** fruit on pause screen |

## Asset pipeline

```
assets/
├── design-tokens.css   # --fb-* design tokens
├── fruits/             # 10 fruits + bomb SVGs
├── vfx/                # juice splats, flesh-edge
├── powerups/           # freeze, frenzy, double
├── icons/              # HUD + UI icons
└── ui/                 # logo wordmark
```

### Generate sprites

```bash
node scripts/generate-fruit-sprites.mjs   # fruits + bomb
node scripts/generate-vfx-sprites.mjs     # splats, power-ups, HUD icons
```

Sprites are loaded by `js/rendering/AssetLoader.js`. Missing files fall back to procedural canvas drawing.

### Hybrid Figma workflow

- **In-game VFX/HUD/fruits:** script-generated SVGs (same cute-flat language)
- **Optional later:** Figma pass for HTML-only polish → export to `assets/ui/`

## Project structure

```
fruit-ninja-webcam/
├── index.html
├── sw.js                    # caches shell + assets (optional offline)
├── css/styles.css
├── scripts/
│   ├── generate-fruit-sprites.mjs
│   └── generate-vfx-sprites.mjs
├── assets/                  # see Asset pipeline above
└── js/
    ├── main.js
    ├── config.js
    ├── engine/Game.js       # state machine + loop
    ├── engine/WaveManager.js# waves + spawn queue
    ├── rendering/           # Renderer, FruitRenderer, AssetLoader, Effects
    ├── handtracking/HandTracker.js
    ├── audio/AudioManager.js# per-fruit SFX + Japanese-style BGM
    ├── ui/MenuManager.js    # sliceable menu layouts
    ├── ui/TutorialOverlay.js
    └── storage/             # high scores, stats, daily challenge
```

## Visual QA checklist

Run at **1280×720** and a **mobile-ish viewport** (~390×844):

| Screen | Check |
|--------|-------|
| Boot loader | Progress bar, logo, fades after preload |
| Main menu | Webcam bg, large sliceable mode fruits, calibration bar |
| Setup | Difficulty + PLAY + Back fruits |
| Gameplay | HUD score (left), timer (right, no pause overlap), splats on slice |
| Pause | Resume / Restart / Menu / Fullscreen fruits |
| Game over | Score HUD + PLAY AGAIN fruits |
| Leaderboard | Filter fruits + canvas entries |
| Stats | Lifetime stats panel + blade skin fruits |
| All modes | Classic, Arcade, Zen × Easy, Medium, Hard |

## Configuration

Tune in `js/config.js` and `js/config/Difficulty.js`:

| Constant | Description |
|----------|-------------|
| `sliceVelocityThreshold` | Min hand speed (px/s) to slice |
| `calibrationBBoxMinRatio` | Auto-calibrate when hand fills 15% of frame |
| `maxActiveEntities` | Entity cap (spawn queue holds overflow) |
| `retention.bladeSkins` | Unlock thresholds for trail colors |
| `retention.dailyGoals` | Daily slice targets per mode |

## Performance

- Object pooling for particles (max 400)
- Entity cap with **FIFO spawn queue** (flushes on wave break / entity removal)
- Device pixel ratio capped at 2
- Service worker caches local assets (MediaPipe still network on first load)

## License

MIT — use freely for learning and personal projects.
