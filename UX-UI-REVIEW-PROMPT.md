# Claude Prompt: Fruit Blade UX/UI Analysis for Figma Redesign

You are a senior UX/UI designer and product strategist. Analyze the current state of **Fruit Blade** (a browser-based Fruit Ninja clone controlled via webcam hand tracking) and produce actionable recommendations for a Figma redesign.

Use this brief as your sole source of truth about the current app. Ask clarifying questions only if something critical is ambiguous.

---

## 1. Product Summary

**Fruit Blade** is a browser-based Fruit Ninja clone controlled via **webcam hand tracking** (MediaPipe). Players slice flying fruits with hand swipes — no mouse/touch required for core gameplay.

**Core differentiator:** The entire navigation model is gesture-first. Menus, pause, game over, and leaderboard are all **sliceable fruits on a live webcam canvas**, not traditional buttons.

**Tech stack:** Vanilla HTML/CSS/JS, Canvas 2D rendering, design tokens in CSS + mirrored in JS, SVG sprite assets.

**Repo path:** `fruit-ninja-webcam/`

---

## 2. Screen Inventory & User Flow

```
Boot Loader → Main Menu (canvas) → Setup (difficulty + PLAY) → Gameplay
                    ↓                                              ↓
              Leaderboard (canvas)                          Pause (canvas fruits)
                    ↓                                              ↓
              Back fruit → Main Menu                        Game Over (canvas HUD + fruits)
```

| Screen | Implementation | Primary interaction |
|--------|----------------|---------------------|
| Boot loader | HTML overlay | Passive (asset preload progress) |
| Main menu | Canvas + webcam BG | Slice mode fruits → auto-advance to setup |
| Setup | Canvas | Slice difficulty → slice PLAY |
| Gameplay | Canvas + webcam BG | Hand swipe to slice |
| Pause | Canvas fruits (HTML overlay exists but is **hidden via CSS**) | Slice Resume / Restart / Menu |
| Game over | Canvas HUD text + canvas fruits (HTML game-over also **hidden**) | Slice Play Again / Scores / Menu |
| Leaderboard | Canvas panel + filter fruits | Slice mode/difficulty filters, Back fruit |

**Notable architectural choice:** HTML pause/game-over screens are fully built and styled but deliberately disabled (`display: none !important`). The **canvas is the single source of truth** for navigation UX.

---

## 3. Visual Design System (Current Tokens)

### Color palette — "soft lavender night + candy fruit"

| Token | Value | Usage |
|-------|-------|-------|
| `--fb-surface-dark` | `#2a2640` | Page background |
| `--fb-surface-glass` | `rgba(42, 38, 64, 0.78)` | Panels, chips, cards |
| `--fb-hud-primary` | `#fffaf5` | Primary text |
| `--fb-hud-accent` | `#ffe566` | Score, selection ring, highlights |
| `--fb-hud-success` | `#a8e06c` | Calibration, multipliers |
| `--fb-hud-danger` | `#ff6b6b` | Timer urgency, lives |
| `--fb-coral` / `--fb-banana` | `#ff4757` / `#ffeb3b` | CTA gradients |

### Typography

- **Font:** `Segoe UI`, system-ui (no custom/display font)
- **Scale:** 11px panel labels → 40px menu title → 52px game-over score
- **Weight:** Heavy use of `bold` / `800` for headings

### Shape language

- **Radii:** 12px (small) → 20px (panels) → 28px (cards) → pill (999px)
- **Style:** Frosted glass panels with 1.5px `rgba(255,250,245,0.14)` borders
- **Shadows:** Text drop-shadows on canvas; `drop-shadow` on logo

### Assets

- 10 fruit SVGs + bomb, 5 VFX splats, 3 power-up bananas, 5 HUD icons
- Logo SVG with gradient wordmark + fruit icon + slash accent

---

## 4. What Works Well (Strengths)

### A. Cohesive thematic identity

The fruit-as-UI metaphor is consistent end-to-end: modes map to apple/orange/peach, difficulty to strawberry/mango/watermelon, navigation to coconut "Back", play to banana. This is memorable and on-brand.

### B. Immersive webcam integration

Live camera feed as full-screen background with dimming/vignette creates a strong "you are the ninja" feel. Menu panels float over the user's own image, which is distinctive vs. typical game UIs.

### C. Design token foundation exists

`design-tokens.css` + canvas `TOKENS` mirror in `Renderer.js` gives a real starting point for a Figma variable library. Glass panels, chips, and pill buttons are repeatable patterns.

### D. HUD information hierarchy (gameplay)

- Score (top-left, 36px bold) — primary
- Mode/wave pill (center-top) — context
- Timer/lives (top-right chips with icons) — urgency
- Combo/multiplier/power-ups — secondary, below primary row

### E. Micro-feedback

- Selected menu fruits get yellow glow ring
- Fruits bob/rotate subtly
- Sliced fruits respawn after 700ms
- Calibration progress bar fills green→yellow
- Timer chip turns red below 10s
- Milestone banners ("Combo!", "Amazing!") during play

### F. Boot experience

Logo + status text + progress bar on radial gradient background. Clean, branded first paint.

---

## 5. UX/UI Issues & Opportunities (Prioritized)

### Critical — Discoverability & onboarding

**Problem:** First-time users see "Slice a mode to continue" and "Show your hand to calibrate" as text on a busy webcam background. There is no illustrated tutorial, no "how to slice" animation, and no fallback for users without a webcam.

**Observed:** Calibration requires holding hand steady for ~2 seconds. Progress bar is only 6px tall — easy to miss. No visual hand skeleton overlay to confirm tracking is working.

**Figma opportunity:** Design a **3-step onboarding flow**:

1. Camera permission explainer
2. Hand calibration with skeleton overlay + larger progress ring
3. "Practice slice" with a single slow-moving fruit before menu

---

### Critical — Readability over variable backgrounds

**Problem:** All menu UI is rendered on the live webcam feed. Legibility depends entirely on what's behind the glass panels. Dark hair, bright walls, or cluttered rooms reduce contrast.

**Observed:** Glass panels (`rgba(42,38,64,0.78)`) help but panel labels ("CHOOSE MODE", "EXTRAS") are only **11px bold** — very small. Fruit labels are white text with drop shadow, which can wash out on light backgrounds.

**Figma opportunity:**

- Add a **consistent scrim layer** (top-to-bottom gradient or full-screen 40% dark overlay behind all menu content)
- Increase panel label size to 13–14px with letter-spacing
- Consider a **non-webcam "safe mode"** background (gradient + subtle pattern) for menus

---

### High — Dual UI system creates confusion

**Problem:** `index.html` contains polished HTML pause/game-over screens with buttons, volume sliders, stats grid — but CSS hides them (`#pause-menu, #screen-gameover { display: none !important }`). Meanwhile canvas renders its own pause/game-over with different layout and copy.

**Risk for redesign:** Two parallel design systems (HTML glass cards vs. canvas text + fruits) will drift. Volume controls exist in HTML corner but pause uses canvas fruits.

**Figma opportunity:** Decide **one paradigm**:

- **Option A:** Full canvas (current) — design all states as canvas mockups
- **Option B:** Hybrid — HTML overlays for pause/game-over (richer stats), canvas only for sliceable menus
- **Option C:** HTML menus with touch/mouse fallback + canvas gameplay only

---

### High — Information density on leaderboard

**Problem:** Leaderboard packs HIGH SCORES panel + FILTER panel (6 sliceable fruits in 2 rows) + Back fruit into one screen. On smaller viewports, vertical stacking gets tight (max 3–5 score rows).

**Observed layout:**

- Top: "High Scores" title + instruction
- Middle: scroll-limited score list
- Bottom: filter panel (3 mode + 3 difficulty fruits)
- Bottom: Back coconut

**Figma opportunity:** Redesign as **tabbed or swipeable filters** instead of 6 simultaneous slice targets. Consider horizontal mode pills + difficulty as a single slider fruit.

---

### High — Volume controls UX

**Problem:** Volume sliders sit in bottom-right corner during menu AND gameplay. They use emoji icons (🎵 🔊), are small (70px wide sliders), and compete visually with game content.

**Observed:** Sliders are always visible — no collapse/expand. On mobile they would be nearly unusable.

**Figma opportunity:** Design a **settings gear chip** that expands to a settings drawer (volume, sensitivity, mirror toggle).

---

### Medium — Typography lacks personality

**Problem:** Segoe UI everywhere feels generic for a playful fruit-slicing game. No display font for "Fruit Blade" title on canvas (40px bold system font vs. polished gradient logo SVG on boot screen only).

**Figma opportunity:** Pair a **rounded display font** (e.g., Nunito, Baloo, Fredoka) for titles with system UI for HUD numbers. Match the boot logo gradient treatment on canvas title.

---

### Medium — Visual hierarchy imbalance

**Observed on main menu:**

- Title "Fruit Blade" dominates top
- "CHOOSE MODE" panel is wide; "EXTRAS" panel is ~56% width — feels visually unbalanced
- Best score text (bottom-left, 13px muted) is easy to overlook
- Three mode fruits are evenly spaced but PLAY doesn't exist on main — user must discover the two-step flow

**Figma opportunity:** Add a **step indicator** (① Mode → ② Difficulty → ③ Play) so the multi-screen flow is explicit.

---

### Medium — Accessibility gaps

| Gap | Detail |
|-----|--------|
| No mouse/touch fallback | Entire menu requires hand tracking |
| No keyboard nav for menus | Only P/Escape for pause during play |
| Color-only urgency | Timer turns red but no icon pulse animation spec |
| Small touch targets | Pause button is 44px (OK), but volume sliders are tiny |
| `user-scalable=no` | Blocks zoom for low-vision users |
| Emoji in UI | 🏆 in canvas game-over, 🎵/🔊 in volume — inconsistent with SVG icon system |

---

### Medium — Pause button vs. slice-to-pause inconsistency

**Problem:** README says pause via button or P/Escape, but pause screen is sliceable fruits. The HTML pause overlay is disabled. Users who press P get canvas pause fruits — but the visible pause **button** (top-right) triggers the same flow. Volume corner remains visible during pause.

**Figma opportunity:** Unify pause UX — either modal overlay (HTML) or full-screen dim + centered sliceable fruits with clearer "PAUSED" backdrop.

---

### Low — Boot loader could be richer

**Problem:** Boot screen is minimal — small logo, thin progress bar, no tips or branding animation.

**Figma opportunity:** Add animated fruit slice, rotating tips ("Close your fist to hide your blade"), or a looping blade trail animation.

---

### Low — Missing states in design

No designed/spec'd UI for:

- Camera permission denied
- MediaPipe model loading (only text: "Loading hand tracking…")
- No hand detected during gameplay (blade hidden — no prompt)
- Network offline / CDN failure
- Mobile portrait layout (canvas is full-bleed but menu fruits may crowd)

---

## 6. Component Inventory (for Figma Library)

| Component | Variants | Notes |
|-----------|----------|-------|
| **Glass Panel** | Default, with title, with list, with filters | `roundRect` 20px radius |
| **Menu Fruit Chip** | Default, Selected (yellow ring), Compact, Sliced/respawning | Label + sublabel below sprite |
| **HUD Chip** | Score combo, Timer (normal/urgent), Multiplier, Power-up | Pill shape with optional icon |
| **Button** | Primary (gradient), Secondary (glass), Ghost | HTML only — 280px max-width |
| **Progress Bar** | Boot (8px), Calibration (6px) | Green→yellow gradient fill |
| **Volume Control** | Inline slider, Labeled row | HTML only |
| **Leaderboard Row** | Rank 1–3 (gold), 4–5 (white), empty state | Divider lines between rows |
| **Milestone Banner** | Combo, Great, Amazing, Blade Master | Canvas overlay, animated |
| **Blade Trail** | Single hand, dual hand, fist (hidden) | Glowing polyline |
| **Logo** | Boot wordmark SVG | Not used on canvas menu title |

---

## 7. Layout Specs (Current, for Figma Frames)

### Main menu (canvas)

- Title: centered, y≈52px, 40px bold
- Subtitle: y≈78px, 15px
- Calibration bar: min(360px, 55% width), y≈92px, 6px height
- Mode panel: full width − 12% margins, 3 fruits at ±21% spread
- Extras panel: 56% width, centered, single pineapple fruit
- Best score: bottom-left, 16px inset

### Gameplay HUD

- Score: top-left, pad 20px
- Center pill: ~120–200px wide, y=12px, h=44px
- Timer/lives: top-right chips
- Power-ups: centered row below pill

### Pause / Game over (canvas)

- Title: centered, y≈52px
- 3 action fruits in horizontal row at ~52–58% viewport height
- Spread: min(22% width, 88px)

---

## 8. Interaction Model Summary

| Gesture | Result |
|---------|--------|
| Fast hand swipe (fingers extended) | Slice fruit / menu item |
| Closed fist | Hide blade, stop slicing |
| Slice mode fruit | Select mode → navigate to setup |
| Slice difficulty fruit | Select difficulty |
| Slice PLAY banana | Start game |
| Slice Back coconut | Return to previous screen |
| P / Escape | Pause / resume (during play) |
| Click pause button | Pause (during play) |

**Slice detection:** Velocity threshold (1200 px/s on Medium). Slow hovering does nothing — this needs clear user education.

---

## 9. Recommended Figma Project Structure

```
📁 Fruit Blade Design System
  ├── 🎨 Foundations (colors, typography, spacing, radii, effects)
  ├── 🧩 Components (panels, chips, fruits, buttons, HUD elements)
  └── 📱 Screens
       ├── 01 Boot / Loading
       ├── 02 Onboarding (NEW — recommended)
       ├── 03 Main Menu
       ├── 04 Setup (Difficulty)
       ├── 05 Gameplay HUD
       ├── 06 Pause
       ├── 07 Game Over
       ├── 08 Leaderboard
       └── 09 Error States (camera, tracking, offline)
```

**Suggested frame sizes:** 1440×900 (desktop webcam), 390×844 (mobile portrait), 768×1024 (tablet)

---

## 10. Key Questions for You to Answer

1. Should menus stay on the webcam background or switch to a branded static background for readability?
2. Is the two-step menu flow (mode → difficulty → play) intuitive, or should it be a single screen?
3. Should HTML overlays replace canvas UI for pause/game-over (richer stats, better accessibility)?
4. What onboarding pattern works best for hand-tracking games (FitXR, Just Dance, etc.)?
5. How can we add mouse/touch fallback without breaking the gesture-first identity?
6. What display + body font pairing fits "cute cohesive candy fruit" without feeling childish?
7. How should the leaderboard filter UX be simplified for gesture input?
8. What's the minimum viable design system to extract from current tokens into Figma variables?

---

## 11. Source Files to Reference

| File | Purpose |
|------|---------|
| `assets/design-tokens.css` | Color, type, spacing tokens |
| `css/styles.css` | HTML overlay styles (boot, pause, game-over) |
| `js/ui/MenuManager.js` | All menu layouts and fruit positions |
| `js/rendering/Renderer.js` | Canvas HUD, panels, chips, leaderboard |
| `js/rendering/FruitRenderer.js` | Menu fruit rendering + selection glow |
| `assets/ui/logo.svg` | Brand wordmark |
| `index.html` | Screen structure |

---

## 12. Visual Observations (from live app)

**Boot screen:** Dark purple radial gradient, centered logo, "Loading fruits…", thin progress bar. Minimal, lots of empty space.

**Main menu (post-load):** User's webcam visible behind glass panels. "Fruit Blade" title, calibration prompt, three mode fruits (Classic/Arcade/Zen) in CHOOSE MODE panel, Scores/Leaderboard in narrower EXTRAS panel. Volume sliders bottom-right. Best score bottom-left.

---

## 13. What I Need From You

Please deliver:

1. **Executive summary** — 3–5 sentences on overall UX maturity and biggest opportunity
2. **Prioritized redesign roadmap** — Phase 1 (quick wins), Phase 2 (core flows), Phase 3 (polish)
3. **Design direction** — mood, references, do's and don'ts for Figma
4. **Figma variable mapping** — translate current tokens into a proper design system
5. **Screen-by-screen recommendations** — what to change and why
6. **Accessibility & fallback strategy** — practical, not boilerplate
7. **Component specs** — sizes, states, spacing for the Figma library
8. **Decision on dual UI** — canvas-only vs. hybrid (with clear recommendation)

Be specific, opinionated, and actionable. I will use your output to build the Figma file next.
