import { CONFIG } from '../config.js';

/**
 * Persists and retrieves high scores via localStorage.
 * Keeps top N scores per mode + difficulty (not one global list).
 */
export class HighScoreStore {
  constructor(key = CONFIG.storage.highScoreKey) {
    this.key = key;
  }

  normalizeEntry(entry) {
    return {
      ...entry,
      mode: entry.mode || 'classic',
      difficulty: entry.difficulty || 'medium',
    };
  }

  bucketKey(entry) {
    const e = this.normalizeEntry(entry);
    return `${e.mode}:${e.difficulty}`;
  }

  getAll() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((e) => this.normalizeEntry(e));
    } catch {
      return [];
    }
  }

  trimEntries(entries) {
    const maxPerBucket = CONFIG.storage.maxEntriesPerBucket || 10;
    const buckets = new Map();

    for (const entry of entries.map((e) => this.normalizeEntry(e))) {
      const key = this.bucketKey(entry);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    }

    const trimmed = [];
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => b.score - a.score);
      trimmed.push(...bucket.slice(0, maxPerBucket));
    }

    return trimmed.sort((a, b) => b.score - a.score);
  }

  /**
   * @param {number} score
   * @param {object} meta - optional stats { combo, wave, fruitsSliced, mode, difficulty }
   * @returns {{ rank: number, modeRank: number, isNewHighScore: boolean, entries: object[] }}
   */
  add(score, meta = {}) {
    const entries = this.getAll();
    const entry = this.normalizeEntry({
      score,
      date: new Date().toISOString(),
      ...meta,
    });
    entries.push(entry);
    const trimmed = this.trimEntries(entries);
    localStorage.setItem(this.key, JSON.stringify(trimmed));

    const mode = entry.mode;
    const difficulty = entry.difficulty;
    const modeEntries = trimmed
      .filter((e) => e.mode === mode && e.difficulty === difficulty)
      .sort((a, b) => b.score - a.score);

    const modeRank = modeEntries.findIndex((e) => e.date === entry.date) + 1;
    const isNewHighScore =
      modeEntries.length > 0 && modeEntries[0].date === entry.date;

    const globalRank = trimmed.findIndex((e) => e.date === entry.date) + 1;

    return {
      rank: globalRank,
      modeRank,
      isNewHighScore,
      entries: trimmed,
    };
  }

  getFiltered(mode = null, difficulty = null) {
    return this.getAll()
      .filter((e) => {
        const matchMode = !mode || e.mode === mode;
        const matchDiff = !difficulty || e.difficulty === difficulty;
        return matchMode && matchDiff;
      })
      .sort((a, b) => b.score - a.score);
  }

  getBest(difficulty, mode = 'classic') {
    const filtered = this.getFiltered(mode, difficulty);
    return filtered.length ? filtered[0].score : 0;
  }
}
