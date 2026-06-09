import { CONFIG } from '../config.js';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Local daily challenge — one goal per mode per calendar day.
 */
export class DailyChallengeStore {
  constructor(key = CONFIG.storage.dailyChallengeKey) {
    this.key = key;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return this.fresh();
      const data = JSON.parse(raw);
      if (data.date !== todayKey()) return this.fresh();
      return data;
    } catch {
      return this.fresh();
    }
  }

  fresh() {
    const goals = CONFIG.retention?.dailyGoals || { arcade: 30, classic: 20, zen: 40 };
    const modes = Object.keys(goals);
    const mode = modes[Math.floor(Math.random() * modes.length)];
    return {
      date: todayKey(),
      mode,
      goal: goals[mode],
      progress: 0,
      completed: false,
      streak: this.loadStreak(),
    };
  }

  loadStreak() {
    try {
      const raw = localStorage.getItem(`${this.key}_streak`);
      if (!raw) return 0;
      const { date, count } = JSON.parse(raw);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = yesterday.toISOString().slice(0, 10);
      if (date === todayKey()) return count;
      if (date === yKey) return count;
      return 0;
    } catch {
      return 0;
    }
  }

  saveStreak(count) {
    localStorage.setItem(`${this.key}_streak`, JSON.stringify({ date: todayKey(), count }));
  }

  addProgress(mode, fruitsSliced) {
    let data = this.load();
    if (data.date !== todayKey()) data = this.fresh();

    if (data.mode === mode && !data.completed) {
      data.progress = Math.min(data.goal, data.progress + fruitsSliced);
      if (data.progress >= data.goal) {
        data.completed = true;
        data.streak = (data.streak || 0) + 1;
        this.saveStreak(data.streak);
      }
    }

    localStorage.setItem(this.key, JSON.stringify(data));
    return data;
  }

  getLabel(data = this.load()) {
    const modeLabel = data.mode.charAt(0).toUpperCase() + data.mode.slice(1);
    return `${modeLabel}: ${data.progress}/${data.goal} fruits`;
  }
}
