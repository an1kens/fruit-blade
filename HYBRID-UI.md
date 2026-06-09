# Hybrid UI — Option B

Fruit Blade uses a **hybrid rendering model** for pause and game-over:

| Layer | Technology | Screens |
|-------|------------|---------|
| Canvas | WebGL-free 2D + webcam | Main menu, gameplay HUD, leaderboard, onboarding practice |
| HTML | Semantic overlays + click | Pause menu, game over, settings drawer, error states, camera CTA |

## Decision

**Option B** — HTML overlays for pause and game-over, canvas for everything else.

Rationale:

1. **Accessibility** — HTML buttons support native focus, tab order, and screen readers.
2. **Slice + click** — Overlays expose `data-sliceable` targets; blade hit-testing reuses gameplay velocity thresholds.
3. **No duplicate polish** — Canvas `buildPauseLayout` / `buildGameOverLayout` were removed to avoid maintaining two UIs.

## Slice hit-test

`js/ui/SliceHitTest.js` tests blade trails against `[data-sliceable]` element bounding rects during `PAUSED` and `GAME_OVER` states.

## Token parity

Figma semantic variables map 1:1 to `--fb-*` in `assets/design-tokens.css` and the `TOKENS` object in `js/rendering/Renderer.js`.
