import { CONFIG } from '../config.js';

const DEFAULT = {
  fruitsSliced: 0,
  bestCombo: 0,
  timePlayedMs: 0,
  gamesPlayed: 0,
  bladeSkin: 'gold',
};

/**
 * Lifetime player stats + blade skin unlocks (localStorage).
 */
export class PlayerStatsStore {
  constructor(key = CONFIG.storage.statsKey) {
    this.key = key;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return { ...DEFAULT };
      return { ...DEFAULT, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT };
    }
  }

  save(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  recordGame({ fruitsSliced = 0, bestCombo = 0, durationMs = 0 } = {}) {
    const stats = this.load();
    stats.fruitsSliced += fruitsSliced;
    stats.bestCombo = Math.max(stats.bestCombo, bestCombo);
    stats.timePlayedMs += durationMs;
    stats.gamesPlayed += 1;

    const unlocks = CONFIG.retention?.bladeSkins || [];
    for (const skin of unlocks) {
      if (stats.fruitsSliced >= skin.unlockAt && stats.bladeSkin === 'gold' && skin.id !== 'gold') {
        // keep highest unlocked automatically selected on first unlock
      }
    }
    const unlocked = this.getUnlockedSkins(stats.fruitsSliced);
    if (!unlocked.includes(stats.bladeSkin)) {
      stats.bladeSkin = unlocked[unlocked.length - 1];
    }

    this.save(stats);
    return stats;
  }

  getUnlockedSkins(totalFruits = null) {
    const count = totalFruits ?? this.load().fruitsSliced;
    const skins = CONFIG.retention?.bladeSkins || [{ id: 'gold', unlockAt: 0 }];
    return skins.filter((s) => count >= s.unlockAt).map((s) => s.id);
  }

  setBladeSkin(id) {
    const stats = this.load();
    if (!this.getUnlockedSkins().includes(id)) return stats;
    stats.bladeSkin = id;
    this.save(stats);
    return stats;
  }

  getBladeSkinDef() {
    const stats = this.load();
    const skins = CONFIG.retention?.bladeSkins || [];
    return skins.find((s) => s.id === stats.bladeSkin) || skins[0] || { id: 'gold', color: '#FFE566' };
  }
}
