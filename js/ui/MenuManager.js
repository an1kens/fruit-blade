import { getFruitDef } from '../entities/FruitTypes.js';
import { CONFIG } from '../config.js';

let menuId = 1;

const MODE_CYCLE = ['classic', 'arcade', 'zen'];
const DIFF_CYCLE = ['easy', 'medium', 'hard'];

/**
 * Sliceable menu fruit.
 */
export class MenuFruit {
  constructor(config) {
    this.id = menuId++;
    this.type = config.type;
    this.label = config.label;
    this.sublabel = config.sublabel || '';
    this.action = config.action;
    this.actionValue = config.actionValue;
    this.def = getFruitDef(config.type);
    this.radius = config.radius || this.def.radius;
    this.baseX = config.x;
    this.baseY = config.y;
    this.x = config.x;
    this.y = config.y;
    this.rotation = Math.random() * Math.PI * 2;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobAmp = config.bobAmp || 6;
    this.alive = true;
    this.sliced = false;
    this.selected = false;
    this.respawnAt = 0;
    this.group = config.group;
    this.panel = config.panel || null;
    this.compact = config.compact === true;
    this.keyboardFocus = false;
    this.selectionPulse = 0;
  }
}

/**
 * Sliceable menu steps:
 *   main         — mode + difficulty + play + leaderboard chip
 *   leaderboard  — high scores + cycling filter pills + back
 *   stats        — lifetime stats + blade skins
 */
export class MenuManager {
  /** Menu fruits are larger than gameplay — scale radii outside matches. */
  static SIZE_SCALE = 1.32;
  static SELECT_ACTIONS = new Set(['mode', 'difficulty', 'lb-cycle-mode', 'lb-cycle-diff']);

  constructor() {
    this.fruits = [];
    this.panels = [];
    this.step = 'main';
    this.layoutWidth = 0;
    this.layoutHeight = 0;
    this.layoutMeta = {};
    this.leaderboardEntries = [];
    this.leaderboardFilterMode = null;
    this.leaderboardFilterDifficulty = null;
    this.statsLines = [];
    this.keyboardIndex = 0;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }

  setStatsLines(lines) {
    this.statsLines = lines || [];
  }

  setStep(step) {
    this.step = step;
    this.keyboardIndex = 0;
  }

  getStep() {
    return this.step;
  }

  menuRadius(base) {
    return Math.round(base * MenuManager.SIZE_SCALE);
  }

  buildLayout(width, height, step = this.step, options = {}) {
    this.step = step;
    this.layoutWidth = width;
    this.layoutHeight = height;
    this.fruits = [];
    this.panels = [];
    this.layoutMeta = { step, compact: height < 720 };

    if (step === 'main') {
      this.buildMainLayout(width, height, options);
    } else if (step === 'leaderboard') {
      this.buildLeaderboardLayout(width, height);
    } else if (step === 'stats') {
      this.buildStatsLayout(width, height);
    }
  }

  setLeaderboardEntries(entries) {
    this.leaderboardEntries = entries;
  }

  formatFilterLabel(value, fallback) {
    const id = value || fallback;
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  updateLeaderboardInPlace(entries, mode, difficulty) {
    this.leaderboardEntries = entries;
    this.leaderboardFilterMode = mode;
    this.leaderboardFilterDifficulty = difficulty;

    const modeLabel = this.formatFilterLabel(mode, 'classic');
    const diffLabel = this.formatFilterLabel(difficulty, 'medium');

    const scoresPanel = this.panels.find((p) => p.id === 'scores-panel');
    if (scoresPanel) {
      const maxRows = scoresPanel.entries?.length || entries.length;
      scoresPanel.entries = entries.slice(0, maxRows);
      scoresPanel.filterMode = mode;
      scoresPanel.filterDifficulty = difficulty;
    }

    const filterPanel = this.panels.find((p) => p.id === 'filter-panel');
    if (filterPanel?.pills) {
      filterPanel.pills[0].value = modeLabel;
      filterPanel.pills[1].value = diffLabel;
    }

    for (const fruit of this.fruits) {
      if (fruit.action === 'lb-cycle-mode') fruit.label = modeLabel;
      if (fruit.action === 'lb-cycle-diff') fruit.label = diffLabel;
    }
  }

  setLeaderboardFilter(mode, difficulty) {
    this.leaderboardFilterMode = mode;
    this.leaderboardFilterDifficulty = difficulty;
  }

  getLeaderboardFilter() {
    return {
      mode: this.leaderboardFilterMode,
      difficulty: this.leaderboardFilterDifficulty,
    };
  }

  cycleFilter(which) {
    if (which === 'mode') {
      const idx = MODE_CYCLE.indexOf(this.leaderboardFilterMode);
      const next = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
      this.leaderboardFilterMode = next;
      return next;
    }
    const idx = DIFF_CYCLE.indexOf(this.leaderboardFilterDifficulty);
    const next = DIFF_CYCLE[(idx + 1) % DIFF_CYCLE.length];
    this.leaderboardFilterDifficulty = next;
    return next;
  }

  buildMainLayout(width, height, options = {}) {
    const showCalibration = options.showCalibration ?? false;
    const cx = width * 0.5;
    const marginX = Math.max(16, width * 0.06);
    const panelW = width - marginX * 2;
    const bottomPad = Math.max(12, height * 0.03);
    const compact = height < 720 || width < 420;
    const sizeScale = compact ? 1.1 : MenuManager.SIZE_SCALE;
    const menuRadius = (base) => Math.round(base * sizeScale);
    const modeRadius = menuRadius(compact ? 36 : 40);
    const spread = Math.min(
      Math.max(width * 0.19, modeRadius * 2 + 24),
      panelW * 0.28
    );

    const bestScoreLine = 28;
    const titleBlock = compact ? 44 : 52;
    const calBlock = showCalibration ? (compact ? 78 : 92) : 0;
    const headerBottom = bestScoreLine + titleBlock + calBlock + (compact ? 6 : 10);

    this.layoutMeta = {
      showCalibration,
      calibrationRingY: showCalibration ? bestScoreLine + titleBlock + (compact ? 38 : 46) : null,
      headerBottom,
      compact,
    };

    const panelGap = compact ? 10 : 14;
    const panelHeader = compact ? 22 : 28;
    const panelPad = compact ? 28 : 32;

    const modeFoot = this.chipFootprint(modeRadius, compact ? 4 : 6, true);
    const modePanelTop = headerBottom;
    const modePanelH = modeFoot + panelPad;

    this.panels.push({
      id: 'mode-panel',
      x: marginX,
      y: modePanelTop,
      w: panelW,
      h: modePanelH,
      label: 'CHOOSE MODE',
    });

    const modeY = modePanelTop + panelHeader + modeFoot / 2;
    const modes = [
      { type: 'apple', label: 'Classic', sublabel: '3 strikes', action: 'mode', value: 'classic', x: cx - spread },
      { type: 'orange', label: 'Arcade', sublabel: '60 seconds', action: 'mode', value: 'arcade', x: cx },
      { type: 'peach', label: 'Zen', sublabel: 'No pressure', action: 'mode', value: 'zen', x: cx + spread },
    ];

    for (const m of modes) {
      this.fruits.push(
        new MenuFruit({
          ...m,
          actionValue: m.value,
          y: modeY,
          group: 'mode',
          panel: 'mode-panel',
          radius: modeRadius,
        })
      );
    }

    const diffRadius = menuRadius(compact ? 32 : 36);
    const hardRadius = menuRadius(compact ? 36 : 40);
    const diffFoot = this.chipFootprint(hardRadius, compact ? 3 : 4, true);
    const diffPanelTop = modePanelTop + modePanelH + panelGap;
    const diffPanelH = diffFoot + panelPad - 4;

    this.panels.push({
      id: 'diff-panel',
      x: marginX,
      y: diffPanelTop,
      w: panelW,
      h: diffPanelH,
      label: 'DIFFICULTY',
    });

    const diffY = diffPanelTop + panelHeader - 2 + diffFoot / 2;
    const diffs = [
      { type: 'strawberry', label: 'Easy', sublabel: 'Forgiving', action: 'difficulty', value: 'easy', x: cx - spread, radius: diffRadius },
      { type: 'mango', label: 'Medium', sublabel: 'Balanced', action: 'difficulty', value: 'medium', x: cx, radius: diffRadius },
      { type: 'watermelon', label: 'Hard', sublabel: 'Brutal', action: 'difficulty', value: 'hard', x: cx + spread, radius: hardRadius },
    ];

    for (const d of diffs) {
      this.fruits.push(
        new MenuFruit({
          ...d,
          actionValue: d.value,
          y: diffY,
          group: 'difficulty',
          panel: 'diff-panel',
        })
      );
    }

    const playRadius = menuRadius(compact ? 44 : 50);
    const lbRadius = menuRadius(compact ? 30 : 34);
    const actionFoot = Math.max(
      this.chipFootprint(playRadius, compact ? 4 : 6, true),
      this.chipFootprint(lbRadius, compact ? 3 : 4, true)
    );
    const actionTop = diffPanelTop + diffPanelH + panelGap;
    const actionPanelH = actionFoot + panelPad - 4;

    this.panels.push({
      id: 'action-panel',
      x: marginX,
      y: actionTop,
      w: panelW,
      h: actionPanelH,
      label: 'READY?',
    });

    const actionY = actionTop + panelHeader - 2 + actionFoot / 2;
    const actionSpread = Math.min(spread * 0.82, panelW * 0.21);

    this.fruits.push(
      new MenuFruit({
        type: 'pineapple',
        label: 'Scores',
        sublabel: 'Leaderboard',
        action: 'leaderboard',
        actionValue: null,
        x: cx - actionSpread,
        y: actionY,
        group: 'nav',
        panel: 'action-panel',
        radius: lbRadius,
        bobAmp: 4,
        compact: true,
      }),
      new MenuFruit({
        type: 'banana',
        label: 'PLAY',
        sublabel: 'Slice to start',
        action: 'play',
        actionValue: null,
        x: cx + actionSpread,
        y: actionY,
        group: 'nav',
        panel: 'action-panel',
        radius: playRadius,
        bobAmp: 6,
      })
    );

    const contentBottom = Math.max(
      ...this.panels.map((p) => p.y + p.h),
      ...this.fruits.map((f) => f.baseY + f.radius + 24)
    );
    if (contentBottom > height - bottomPad) {
      const shift = Math.min(
        contentBottom - (height - bottomPad),
        headerBottom - bestScoreLine - 8
      );
      if (shift > 0) {
        for (const panel of this.panels) panel.y -= shift;
        for (const fruit of this.fruits) {
          fruit.baseY -= shift;
          fruit.y -= shift;
        }
        this.layoutMeta.headerBottom -= shift;
        if (this.layoutMeta.calibrationRingY) this.layoutMeta.calibrationRingY -= shift;
      }
    }
  }

  chipFootprint(radius, bobAmp = 0, sublabel = false) {
    const label = 18;
    const sub = sublabel ? 16 : 0;
    const ring = 10;
    return radius * 2 + bobAmp * 2 + ring + label + sub;
  }

  buildLeaderboardLayout(width, height) {
    const cx = width * 0.5;
    const marginX = Math.max(16, width * 0.06);
    const marginY = Math.max(12, height * 0.02);
    const panelW = width - marginX * 2;
    const headerReserve = Math.min(100, height * 0.13);

    const backRadius = this.menuRadius(34);
    const backFoot = this.chipFootprint(backRadius, 3, true);
    const backCenterY = height - marginY - backFoot / 2;

    const filterBlockH = 52;
    const filterTop = backCenterY - backFoot / 2 - 18 - filterBlockH;
    const scoresTop = headerReserve + 8;
    const scoresH = Math.max(120, filterTop - scoresTop - 14);
    const innerListH = scoresH - 44;
    const lineH = 30;
    const maxRows = Math.max(8, Math.min(10, Math.floor(innerListH / lineH)));

    const modeLabel = (this.leaderboardFilterMode || 'classic').charAt(0).toUpperCase()
      + (this.leaderboardFilterMode || 'classic').slice(1);
    const diffLabel = (this.leaderboardFilterDifficulty || 'medium').charAt(0).toUpperCase()
      + (this.leaderboardFilterDifficulty || 'medium').slice(1);

    this.panels.push({
      id: 'scores-panel',
      x: marginX,
      y: scoresTop,
      w: panelW,
      h: scoresH,
      label: 'HIGH SCORES',
      entries: this.leaderboardEntries.slice(0, maxRows),
      filterMode: this.leaderboardFilterMode,
      filterDifficulty: this.leaderboardFilterDifficulty,
      lineH,
    });

    this.panels.push({
      id: 'filter-panel',
      x: marginX,
      y: filterTop,
      w: panelW,
      h: filterBlockH,
      label: 'FILTER',
      pills: [
        { label: 'Mode', value: modeLabel, x: marginX + 14, y: filterTop + 30 },
        { label: 'Difficulty', value: diffLabel, x: marginX + panelW / 2 + 8, y: filterTop + 30 },
      ],
    });

    const pillSpread = Math.min(panelW * 0.22, 120);
    const pillY = filterTop + 22;

    this.fruits.push(
      new MenuFruit({
        type: 'orange',
        label: modeLabel,
        sublabel: 'Slice to cycle',
        action: 'lb-cycle-mode',
        actionValue: null,
        x: cx - pillSpread,
        y: pillY,
        group: 'lb-cycle',
        panel: 'filter-panel',
        radius: this.menuRadius(28),
        bobAmp: 2,
        compact: true,
      }),
      new MenuFruit({
        type: 'mango',
        label: diffLabel,
        sublabel: 'Slice to cycle',
        action: 'lb-cycle-diff',
        actionValue: null,
        x: cx + pillSpread,
        y: pillY,
        group: 'lb-cycle',
        panel: 'filter-panel',
        radius: this.menuRadius(28),
        bobAmp: 2,
        compact: true,
      }),
      new MenuFruit({
        type: 'coconut',
        label: 'Back',
        sublabel: 'Main menu',
        action: 'back',
        actionValue: 'main',
        x: cx,
        y: backCenterY,
        group: 'nav',
        radius: backRadius,
        bobAmp: 3,
        compact: true,
      })
    );
  }

  buildStatsLayout(width, height) {
    const cx = width * 0.5;
    const marginX = Math.max(16, width * 0.06);
    const panelW = width - marginX * 2;
    const headerReserve = Math.min(100, height * 0.13);

    const backRadius = this.menuRadius(36);
    const backFoot = this.chipFootprint(backRadius, 4, true);
    const backY = height - Math.max(16, height * 0.04) - backFoot / 2;

    this.panels.push({
      id: 'stats-panel',
      x: marginX,
      y: headerReserve + 8,
      w: panelW,
      h: Math.max(180, backY - headerReserve - 40),
      label: 'YOUR STATS',
      statsLines: this.statsLines,
    });

    this.fruits.push(
      new MenuFruit({
        type: 'coconut',
        label: 'Back',
        sublabel: 'Main menu',
        action: 'back',
        actionValue: 'main',
        x: cx,
        y: backY,
        group: 'nav',
        radius: backRadius,
        bobAmp: 4,
        compact: true,
      })
    );

    const skins = CONFIG.retention?.bladeSkins || [];
    const totalFruits = parseInt(this.statsLines[0]?.match(/\d+/)?.[0] || '0', 10);
    const unlocked = skins.filter((s) => totalFruits >= s.unlockAt);
    if (unlocked.length > 1) {
      const skinRadius = this.menuRadius(30);
      const skinSpread = Math.min(width * 0.18, 100);
      const skinY = backY - backFoot / 2 - 50;
      unlocked.forEach((skin, i, arr) => {
        const offset = (i - (arr.length - 1) / 2) * skinSpread;
        this.fruits.push(
          new MenuFruit({
            type: 'mango',
            label: skin.label,
            sublabel: 'Blade skin',
            action: 'blade-skin',
            actionValue: skin.id,
            x: cx + offset,
            y: skinY,
            group: 'skin',
            radius: skinRadius,
            bobAmp: 3,
            compact: true,
          })
        );
      });
    }
  }

  update(dt, now) {
    for (const fruit of this.fruits) {
      if (!fruit.alive && fruit.respawnAt && now >= fruit.respawnAt) {
        fruit.alive = true;
        fruit.sliced = false;
        fruit.x = fruit.baseX;
        fruit.y = fruit.baseY;
        fruit.respawnAt = 0;
      }

      if (!fruit.alive) continue;

      if (!this.reducedMotion) {
        fruit.bobPhase += dt * 2.2;
        fruit.y = fruit.baseY + Math.sin(fruit.bobPhase) * fruit.bobAmp;
      } else {
        fruit.y = fruit.baseY;
      }
      fruit.rotation += this.reducedMotion ? dt * 0.15 : dt * 0.6;
    }
  }

  setSelected(mode, difficulty, bladeSkin = null) {
    if (bladeSkin) this.activeBladeSkin = bladeSkin;
    for (const fruit of this.fruits) {
      if (fruit.action === 'difficulty') {
        fruit.selected = fruit.actionValue === difficulty;
      } else if (fruit.action === 'mode') {
        fruit.selected = fruit.actionValue === mode;
      } else if (fruit.action === 'lb-cycle-mode') {
        fruit.selected = true;
        fruit.label = (this.leaderboardFilterMode || mode).charAt(0).toUpperCase()
          + (this.leaderboardFilterMode || mode).slice(1);
      } else if (fruit.action === 'lb-cycle-diff') {
        fruit.selected = true;
        fruit.label = (this.leaderboardFilterDifficulty || difficulty).charAt(0).toUpperCase()
          + (this.leaderboardFilterDifficulty || difficulty).slice(1);
      } else if (fruit.action === 'blade-skin') {
        fruit.selected = fruit.actionValue === this.activeBladeSkin;
      } else {
        fruit.selected = false;
      }
    }
    this.updateKeyboardFocus();
  }

  getActiveFruits() {
    return this.fruits.filter((f) => f.alive && !f.sliced);
  }

  getPanels() {
    return this.panels;
  }

  markSliced(fruit, now, respawnDelayMs = 700) {
    fruit.sliced = true;
    fruit.alive = false;
    fruit.respawnAt = respawnDelayMs > 0 ? now + respawnDelayMs : 0;
  }

  pulseSelection(fruit, durationMs = 450) {
    fruit.selectionPulse = performance.now() + durationMs;
  }

  isSelectAction(action) {
    return MenuManager.SELECT_ACTIONS.has(action);
  }

  updateKeyboardFocus() {
    const active = this.getActiveFruits();
    for (const f of this.fruits) f.keyboardFocus = false;
    if (active.length) {
      this.keyboardIndex = Math.min(this.keyboardIndex, active.length - 1);
      active[this.keyboardIndex].keyboardFocus = true;
    }
  }

  moveKeyboardFocus(delta) {
    const active = this.getActiveFruits();
    if (!active.length) return null;
    this.keyboardIndex = (this.keyboardIndex + delta + active.length) % active.length;
    this.updateKeyboardFocus();
    return active[this.keyboardIndex];
  }

  getKeyboardFocused() {
    return this.getActiveFruits().find((f) => f.keyboardFocus) || null;
  }
}
