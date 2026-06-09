import { FruitRenderer } from './FruitRenderer.js';
import { Effects } from './Effects.js';
import { AssetLoader } from './AssetLoader.js';
import { CONFIG } from '../config.js';

/** Canvas-side mirrors of design-tokens.css */
const TOKENS = {
  hudPrimary: '#fffaf5',
  hudAccent: '#ffe566',
  hudSuccess: '#a8e06c',
  hudDanger: '#ff6b6b',
  hudMuted: 'rgba(255, 250, 245, 0.62)',
  surfacePage: '#2a2640',
  surfacePanel: 'rgba(255, 250, 245, 0.07)',
  surfaceScrim: 'rgba(20, 18, 32, 0.72)',
  surfaceGlass: 'rgba(42, 38, 64, 0.78)',
  surfaceGlassBorder: 'rgba(255, 250, 245, 0.14)',
  textPrimary: '#fffaf5',
  textAccent: '#ffe566',
  feedbackSuccess: '#a8e06c',
  feedbackDanger: '#ff6b6b',
  ctaGradientStart: '#ffeb3b',
  ctaGradientEnd: '#ff4757',
  borderPanel: 'rgba(255, 250, 245, 0.14)',
  scrimHeavy: 'rgba(20, 18, 32, 0.72)',
  radiusMd: 20,
  radiusPill: 999,
  fontDisplay: '"Fredoka", "Segoe UI", sans-serif',
  fontBody: '"Nunito Sans", "Segoe UI", sans-serif',
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space7: 28,
  space8: 32,
};

const FONT = {
  label: `bold 13px ${TOKENS.fontBody}`,
  sublabel: `14px ${TOKENS.fontBody}`,
  display: `bold 40px ${TOKENS.fontDisplay}`,
  hud: `bold 36px ${TOKENS.fontDisplay}`,
};

/**
 * Main canvas renderer — orchestrates background, entities, particles, and HUD.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assetLoader = new AssetLoader();
    this.fruitRenderer = new FruitRenderer(this.assetLoader);
    this.effects = new Effects();
    this.motionBlurCanvas = document.createElement('canvas');
    this.motionBlurCtx = this.motionBlurCanvas.getContext('2d');
    this.performanceMode = true;
  }

  setPerformanceMode(enabled) {
    this.performanceMode = enabled !== false;
  }

  async preloadAssets() {
    return this.assetLoader.loadAll();
  }

  resize(width, height) {
    if (width <= 0 || height <= 0) return;
    const maxDpr = this.performanceMode
      ? CONFIG.performance.maxDpr
      : CONFIG.performance.maxDprNormal;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;
    this.motionBlurCanvas.width = width;
    this.motionBlurCanvas.height = height;
    this.motionBlurCtx.clearRect(0, 0, width, height);
    this.effects.invalidateGradientCache();
  }

  render(state) {
    const { ctx, width, height } = this;
    if (width <= 0 || height <= 0) return;

    const shake = this.effects.getShakeOffset();
    const useWebcamBg = state.useWebcamBackground && state.video;

    ctx.clearRect(0, 0, width, height);

    // Motion blur only on the gradient fallback — smearing a live webcam looks muddy
    if (!useWebcamBg && !state.performanceMode && this.motionBlurCanvas.width > 0) {
      this.motionBlurCtx.globalAlpha = CONFIG.effects.motionBlurAlpha;
      this.motionBlurCtx.drawImage(this.canvas, 0, 0, width, height);
      ctx.drawImage(this.motionBlurCanvas, 0, 0, width, height);
    }

    ctx.save();
    ctx.translate(shake.x, shake.y);

    if (useWebcamBg) {
      this.effects.drawWebcamBackground(
        ctx,
        state.video,
        width,
        height,
        state.mirror !== false,
        !state.performanceMode
      );
    } else {
      this.effects.drawBackground(ctx, width, height);
    }

    if (state.isMenu && state.menuStep) {
      this.effects.drawMenuScrim(ctx, width, height);
    }

    // Menu panels (grouped option areas)
    if (state.isMenu && state.menuPanels) {
      this.drawMenuPanels(ctx, state.menuPanels);
    }

    // Procedural fruit needs extra shadow; sprites bake their own lift in FruitRenderer
    const spritesReady = this.assetLoader.isReady() && this.assetLoader.images.size > 0;
    const fruitShadow =
      useWebcamBg && !spritesReady
        ? { shadowColor: 'rgba(0,0,0,0.55)', shadowBlur: 14 }
        : { shadowColor: 'transparent', shadowBlur: 0 };

    // Sliced pieces (behind active fruits)
    for (const piece of state.slicedPieces) {
      if (piece.alive) {
        ctx.save();
        ctx.shadowColor = fruitShadow.shadowColor;
        ctx.shadowBlur = fruitShadow.shadowBlur;
        this.fruitRenderer.drawSlicedPiece(ctx, piece);
        ctx.restore();
      }
    }

    // Menu fruits (sliceable options)
    if (state.isMenu && state.menuFruits) {
      for (const mf of state.menuFruits) {
        if (mf.alive && !mf.sliced) {
          ctx.save();
          ctx.shadowColor = fruitShadow.shadowColor;
          ctx.shadowBlur = fruitShadow.shadowBlur;
          this.fruitRenderer.drawMenuFruit(ctx, mf);
          ctx.restore();
        }
      }
    }

    // Active fruits and bombs
    for (const fruit of state.fruits) {
      if (fruit.alive && !fruit.sliced) {
        ctx.save();
        ctx.shadowColor = fruitShadow.shadowColor;
        ctx.shadowBlur = fruitShadow.shadowBlur;
        this.fruitRenderer.drawFruit(ctx, fruit);
        ctx.restore();
      }
    }

    // Particles
    state.particles.draw(ctx);

    // Blade trails on top (lighter on menu to save GPU)
    this.effects.drawBladeTrail(ctx, state.trails, state.bladeSkin, {
      lightweight: Boolean(state.isMenu),
    });

    // Floating scores
    this.effects.drawFloatingScores(ctx);
    this.effects.drawScreenPulse(ctx, width, height);
    this.effects.drawMilestoneBanner(ctx, width, height);

    // HUD
    if (state.showMenuHUD) this.drawMenuHUD(ctx, state);
    if (state.showHUD) this.drawHUD(ctx, state);

    ctx.restore();
  }

  drawMenuPanels(ctx, panels) {
    for (const panel of panels) {
      ctx.save();
      ctx.fillStyle = TOKENS.surfaceGlass;
      ctx.strokeStyle = TOKENS.surfaceGlassBorder;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panel.x, panel.y, panel.w, panel.h, TOKENS.radiusMd);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = TOKENS.hudMuted;
      ctx.font = FONT.label;
      ctx.textAlign = 'left';
      let panelTitle = panel.label;
      if (panel.filterMode && panel.filterDifficulty) {
        const modeLabel = panel.filterMode.charAt(0).toUpperCase() + panel.filterMode.slice(1);
        const diffLabel = panel.filterDifficulty.charAt(0).toUpperCase() + panel.filterDifficulty.slice(1);
        panelTitle = `${panel.label} · ${modeLabel} · ${diffLabel}`;
      }
      ctx.fillText(panelTitle, panel.x + 14, panel.y + 18);

      if (panel.id === 'filter-panel' && panel.pills) {
        ctx.fillStyle = 'rgba(255, 250, 245, 0.35)';
        ctx.font = FONT.label;
        for (const pill of panel.pills) {
          this.drawFilterPill(ctx, pill);
        }
      }

      if (panel.entries) {
        this.drawLeaderboardEntries(ctx, panel);
      }

      if (panel.statsLines) {
        this.drawStatsLines(ctx, panel);
      }

      ctx.restore();
    }
  }

  drawFilterPill(ctx, pill) {
    const label = `${pill.label}: ${pill.value}`;
    ctx.save();
    ctx.font = FONT.label;
    const textW = ctx.measureText(label).width;
    const padX = 14;
    const padY = 6;
    const w = textW + padX * 2;
    const h = 13 + padY * 2;

    ctx.fillStyle = TOKENS.surfaceGlass;
    ctx.strokeStyle = TOKENS.borderPanel;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pill.x, pill.y, w, h, TOKENS.radiusPill);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = TOKENS.hudPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pill.x + padX, pill.y + h / 2);
    ctx.restore();
  }

  drawStatsLines(ctx, panel) {
    const padX = panel.x + 16;
    const startY = panel.y + 44;
    const lineH = 28;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;

    for (let i = 0; i < panel.statsLines.length; i++) {
      ctx.fillStyle = i === 0 ? TOKENS.hudAccent : 'rgba(255,250,245,0.85)';
      ctx.font = i === 0 ? `bold 16px ${TOKENS.fontBody}` : FONT.sublabel;
      ctx.fillText(panel.statsLines[i], padX, startY + i * lineH);
    }
  }

  drawLeaderboardEntries(ctx, panel) {
    const entries = panel.entries || [];
    const padX = panel.x + 16;
    const contentW = panel.w - 32;
    const startY = panel.y + 40;
    const scoreColX = panel.x + panel.w - 16;

    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;

    if (!entries.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `15px ${TOKENS.fontBody}`;
      ctx.fillText('No scores yet — be the first!', padX, startY + 24);
      return;
    }

    const lineH = panel.lineH || Math.min(34, (panel.h - 52) / entries.length);

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const y = startY + i * lineH;
      const isTop = i < 3;
      const mode = e.modeLabel || e.mode || '—';
      const diff = e.difficultyLabel || e.difficulty || '—';
      const date = e.date ? new Date(e.date).toLocaleDateString() : '';

      ctx.fillStyle = isTop ? '#ffeb3b' : 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${isTop ? 16 : 14}px ${TOKENS.fontBody}`;
      ctx.fillText(`#${i + 1}`, padX, y + 12);

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${isTop ? 18 : 16}px ${TOKENS.fontDisplay}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${e.score}`, scoreColX, y + 12);

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `12px ${TOKENS.fontBody}`;
      const meta = `${mode} · ${diff} · Wave ${e.wave || '?'}`;
      ctx.fillText(meta, padX + 30, y + 26);
      if (date) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.textAlign = 'right';
        ctx.fillText(date, scoreColX, y + 26);
        ctx.textAlign = 'left';
      }

      if (i < entries.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padX, y + lineH - 3);
        ctx.lineTo(padX + contentW, y + lineH - 3);
        ctx.stroke();
      }
    }
  }

  drawGradientTitle(ctx, text, x, y, fontSize = 40) {
    ctx.save();
    ctx.font = `bold ${fontSize}px ${TOKENS.fontDisplay}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const grad = ctx.createLinearGradient(x - 120, y - 20, x + 120, y + 10);
    grad.addColorStop(0, TOKENS.ctaGradientStart);
    grad.addColorStop(0.55, '#ff9800');
    grad.addColorStop(1, TOKENS.ctaGradientEnd);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawCalibrationRing(ctx, state, centerX, centerY) {
    const ringSize = 88;
    const radius = ringSize / 2;
    const progress = state.calibrationProgress || 0;
    const lineW = 6;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 250, 245, 0.12)';
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - lineW / 2, 0, Math.PI * 2);
    ctx.stroke();

    if (progress > 0) {
      const arcGrad = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
      arcGrad.addColorStop(0, TOKENS.feedbackSuccess);
      arcGrad.addColorStop(1, TOKENS.textAccent);
      ctx.strokeStyle = arcGrad;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        radius - lineW / 2,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress
      );
      ctx.stroke();
    }

    const iconSize = 24;
    const iconX = centerX - iconSize / 2;
    const iconY = centerY - iconSize / 2;
    if (!this.drawIcon(ctx, 'hand', iconX, iconY, iconSize)) {
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✋', centerX, centerY);
    }

    ctx.font = FONT.label;
    ctx.textAlign = 'center';
    ctx.fillStyle = state.calibrated ? TOKENS.feedbackSuccess : 'rgba(255,250,245,0.75)';
    ctx.fillText(state.calibrationStatus || '', centerX, centerY + radius + 18);
    ctx.restore();
  }

  drawMenuHUD(ctx, state) {
    const { width, height } = this;
    const step = state.menuStep;
    const layout = state.menuLayoutMeta || {};
    const compact = layout.compact;
    const isLeaderboard = step === 'leaderboard';
    const isStats = step === 'stats';
    ctx.save();

    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = compact ? 4 : 8;

    if (isStats) {
      ctx.fillStyle = TOKENS.hudPrimary;
      ctx.font = `bold ${compact ? 28 : 32}px ${TOKENS.fontDisplay}`;
      ctx.fillText('Your Stats', width / 2, compact ? 36 : 42);
      ctx.font = FONT.label;
      ctx.fillStyle = TOKENS.hudMuted;
      ctx.fillText('Slice blade skins to equip · Back to return', width / 2, compact ? 54 : 62);
    } else if (isLeaderboard) {
      ctx.fillStyle = TOKENS.hudPrimary;
      ctx.font = `bold ${compact ? 28 : 32}px ${TOKENS.fontDisplay}`;
      ctx.fillText('High Scores', width / 2, compact ? 36 : 42);
      ctx.font = FONT.label;
      ctx.fillStyle = TOKENS.hudMuted;
      ctx.fillText('Slice filter pills · Back fruit to return', width / 2, compact ? 54 : 62);
    } else {
      this.drawGradientTitle(ctx, 'Fruit Blade', width / 2, compact ? 44 : 52, compact ? 34 : 40);
      ctx.font = `${compact ? 14 : 15}px ${TOKENS.fontBody}`;
      ctx.fillStyle = 'rgba(255,250,245,0.75)';
      const sub = state.modeLabel
        ? `${state.modeLabel} · ${state.difficultyLabel || 'Medium'} — slice PLAY when ready`
        : 'Choose mode & difficulty · slice PLAY';
      ctx.fillText(sub, width / 2, compact ? 68 : 78);
    }

    const showCalibration =
      !isLeaderboard && !isStats && !state.calibrated && !state.usePointerFallback;
    if (showCalibration && layout.calibrationRingY) {
      this.drawCalibrationRing(ctx, state, width / 2, layout.calibrationRingY);
    }

    if (state.bestScoreLabel && !isStats) {
      ctx.font = FONT.label;
      ctx.fillStyle = TOKENS.hudMuted;
      ctx.textAlign = 'center';
      ctx.fillText(`${state.bestScoreLabel}: ${state.bestScore}`, width / 2, 28);
    }

    if (state.dailyChallengeLabel && !isStats && !isLeaderboard) {
      ctx.font = `12px ${TOKENS.fontBody}`;
      ctx.fillStyle = TOKENS.hudSuccess;
      ctx.textAlign = 'right';
      ctx.fillText(`Daily: ${state.dailyChallengeLabel}`, width - 16, height - 16);
    }

    ctx.restore();
  }

  drawIcon(ctx, iconId, x, y, size = 20) {
    const img = this.assetLoader.getIcon(iconId);
    if (img) {
      ctx.drawImage(img, x, y, size, size);
      return true;
    }
    return false;
  }

  drawChip(ctx, x, y, text, { bg = TOKENS.surfaceGlass, color = TOKENS.hudPrimary, fontSize = 13, padX = 10, padY = 5, iconId = null, iconSize = 16, scale = 1 } = {}) {
    ctx.save();
    if (scale !== 1) {
      const cx = x + 40;
      const cy = y + 12;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
    ctx.font = `bold ${fontSize}px ${TOKENS.fontBody}`;
    const textW = ctx.measureText(text).width;
    const iconGap = iconId ? iconSize + 6 : 0;
    const w = textW + padX * 2 + iconGap;
    const h = fontSize + padY * 2;

    ctx.fillStyle = bg;
    ctx.strokeStyle = TOKENS.surfaceGlassBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, TOKENS.radiusPill);
    ctx.fill();
    ctx.stroke();

    let tx = x + padX;
    if (iconId) {
      this.drawIcon(ctx, iconId, tx, y + (h - iconSize) / 2, iconSize);
      tx += iconGap;
    }

    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tx, y + h / 2);
    ctx.restore();

    return { w, h };
  }

  drawHUD(ctx, state) {
    const pad = 20;
    const { width, height } = this;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;

    // Score (top-left, below pause button)
    const scoreX = 72;
    const scoreY = 72;
    ctx.fillStyle = TOKENS.hudPrimary;
    ctx.font = FONT.hud;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${state.score}`, scoreX, scoreY);

    // Combo chip
    if (state.combo > 1) {
      this.drawChip(ctx, scoreX, scoreY + 8, `×${state.combo}`, {
        color: TOKENS.hudAccent,
        iconId: 'combo',
        fontSize: 15,
      });
    }

    // Center mode/wave pill
    const waveLabel = state.modeLabel === 'Zen' ? 'Zen' : `Wave ${state.wave}`;
    const modeMeta = state.modeLabel
      ? `${state.modeLabel} · ${state.difficultyLabel || ''}`
      : '';
    const centerPillW = Math.max(120, modeMeta.length * 7 + 40);
    const centerX = (width - centerPillW) / 2;
    ctx.fillStyle = TOKENS.surfaceGlass;
    ctx.strokeStyle = TOKENS.surfaceGlassBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(centerX, 12, centerPillW, 44, TOKENS.radiusPill);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = TOKENS.hudPrimary;
    ctx.font = `bold 14px ${TOKENS.fontBody}`;
    ctx.fillText(waveLabel, width / 2, 30);
    if (modeMeta) {
      ctx.font = `12px ${TOKENS.fontBody}`;
      ctx.fillStyle = TOKENS.hudMuted;
      ctx.fillText(modeMeta, width / 2, 46);
    }

    // Multiplier chip (center, below pill)
    if (state.multiplier > 1) {
      const multText = `${state.multiplier.toFixed(1)}x`;
      const multW = ctx.measureText(multText).width + 24;
      ctx.fillStyle = 'rgba(168, 224, 108, 0.22)';
      ctx.strokeStyle = 'rgba(168, 224, 108, 0.45)';
      ctx.beginPath();
      ctx.roundRect((width - multW) / 2, 62, multW, 24, TOKENS.radiusPill);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = TOKENS.hudSuccess;
      ctx.font = `bold 14px ${TOKENS.fontBody}`;
      ctx.fillText(multText, width / 2, 78);
    }

    // Hand lost pill
    if (state.handLost) {
      const pillText = 'Show your hand';
      ctx.font = `bold 14px ${TOKENS.fontBody}`;
      const pillW = ctx.measureText(pillText).width + 32;
      const pillX = (width - pillW) / 2;
      const pillY = height * 0.42;
      const pulse = 0.96 + 0.04 * Math.sin(performance.now() / 280);
      ctx.save();
      ctx.translate(width / 2, pillY + 12);
      ctx.scale(pulse, pulse);
      ctx.translate(-width / 2, -(pillY + 12));
      this.drawChip(ctx, pillX, pillY, pillText, {
        bg: 'rgba(255, 107, 107, 0.32)',
        color: TOKENS.hudDanger,
        fontSize: 14,
        iconId: 'hand',
        padX: 12,
      });
      ctx.restore();
    }

    // Timer or lives (top-right)
    ctx.textAlign = 'right';
    if (state.timerRemaining != null) {
      const urgent = state.timerRemaining <= 10;
      const timerText = `${state.timerRemaining}s`;
      const timerFont = urgent ? 20 : 16;
      const pulse = urgent ? 1 + 0.06 * Math.sin(performance.now() / 200) : 1;
      ctx.font = `bold ${timerFont}px ${TOKENS.fontDisplay}`;
      const timerChipW = ctx.measureText(timerText).width + 16 + 22;
      this.drawChip(ctx, width - pad - timerChipW, 16, timerText, {
        bg: urgent ? 'rgba(255, 107, 107, 0.35)' : TOKENS.surfaceGlass,
        color: urgent ? TOKENS.hudDanger : TOKENS.hudPrimary,
        fontSize: timerFont,
        iconId: 'timer',
        padX: 8,
        scale: pulse,
      });
    } else if (state.showLives) {
      const heartSize = 22;
      const gap = 6;
      for (let i = 0; i < state.lives; i++) {
        const hx = width - pad - (i + 1) * (heartSize + gap);
        if (!this.drawIcon(ctx, 'heart', hx, 18, heartSize)) {
          ctx.fillStyle = TOKENS.hudDanger;
          ctx.font = '22px sans-serif';
          ctx.fillText('♥', hx, 38);
        }
      }
    }

    // Active power-ups row
    if (state.activePowerUps?.length) {
      const iconSize = 16;
      const rowY = state.multiplier > 1 ? 94 : 72;
      let rowX = width / 2;
      const chips = state.activePowerUps.map((effect) => {
        const type = effect.type || effect.id || 'freeze';
        const label = `${effect.remaining}s`;
        ctx.font = `bold 12px ${TOKENS.fontBody}`;
        const textW = ctx.measureText(label).width;
        const chipW = iconSize + textW + 18;
        return { effect, type, label, chipW };
      });
      const totalW = chips.reduce((sum, c) => sum + c.chipW + 6, -6);
      rowX = (width - totalW) / 2;

      for (const chip of chips) {
        ctx.fillStyle = 'rgba(42, 38, 64, 0.72)';
        ctx.strokeStyle = TOKENS.surfaceGlassBorder;
        ctx.beginPath();
        ctx.roundRect(rowX, rowY, chip.chipW, 22, TOKENS.radiusPill);
        ctx.fill();
        ctx.stroke();

        const powerImg = this.assetLoader.getPowerUp(chip.type);
        if (powerImg) {
          ctx.drawImage(powerImg, rowX + 4, rowY + 3, iconSize, iconSize);
        }

        ctx.fillStyle = chip.effect.color || TOKENS.hudPrimary;
        ctx.font = `bold 12px ${TOKENS.fontBody}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(chip.label, rowX + iconSize + 8, rowY + 11);

        rowX += chip.chipW + 6;
      }
    }

    ctx.restore();
  }

  get width() {
    return this._width || this.canvas.clientWidth;
  }

  set width(v) {
    this._width = v;
  }

  get height() {
    return this._height || this.canvas.clientHeight;
  }

  set height(v) {
    this._height = v;
  }
}
