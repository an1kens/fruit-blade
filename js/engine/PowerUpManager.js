import { CONFIG } from '../config.js';

const POWER_LABELS = {
  freeze: 'FREEZE!',
  frenzy: 'FRENZY!',
  double: 'DOUBLE POINTS!',
};

const POWER_COLORS = {
  freeze: '#42a5f5',
  frenzy: '#ef5350',
  double: '#66bb6a',
};

/**
 * Active power-up effects, timers, and stacking rules.
 */
export class PowerUpManager {
  constructor(waveManager) {
    this.waveManager = waveManager;
    this.active = new Map();
  }

  reset() {
    this.active.clear();
  }

  activate(type) {
    const cfg = CONFIG.powerUps;
    let duration = 0;

    switch (type) {
      case 'freeze':
        duration = cfg.freezeDuration;
        break;
      case 'frenzy':
        duration = cfg.frenzyDuration;
        this.waveManager.queueFrenzyBurst();
        break;
      case 'double':
        duration = cfg.doubleDuration;
        break;
      default:
        return null;
    }

    this.active.set(type, { remaining: duration });

    return {
      type,
      label: POWER_LABELS[type],
      color: POWER_COLORS[type],
      duration,
    };
  }

  update(dt) {
    for (const [type, effect] of this.active) {
      effect.remaining -= dt;
      if (effect.remaining <= 0) this.active.delete(type);
    }
  }

  getFruitTimeScale() {
    if (this.active.has('freeze')) {
      return CONFIG.powerUps.freezeTimeScale;
    }
    return 1;
  }

  getScoreMultiplier() {
    let mult = 1;
    if (this.active.has('frenzy')) mult *= CONFIG.powerUps.frenzyScoreMult;
    if (this.active.has('double')) mult *= CONFIG.powerUps.doubleScoreMult;
    return mult;
  }

  getActiveEffects() {
    return [...this.active.entries()].map(([type, effect]) => ({
      type,
      remaining: Math.ceil(effect.remaining),
      label: POWER_LABELS[type],
      color: POWER_COLORS[type],
    }));
  }

  has(type) {
    return this.active.has(type);
  }
}
