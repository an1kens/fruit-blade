import { HighScoreStore } from '../storage/HighScoreStore.js';
import {
  loadSavedDifficulty,
  saveDifficulty,
  getDifficulty,
} from '../config/Difficulty.js';
import {
  loadSavedGameMode,
  saveGameMode,
  getGameMode,
} from '../config/GameModes.js';

const SETTINGS_KEY = 'fruitBlade_settings';

/**
 * Manages UI screens, overlays, and settings drawer.
 */
export class UIManager {
  constructor(root) {
    this.root = root;
    this.highScores = new HighScoreStore();
    this.selectedDifficulty = loadSavedDifficulty();
    this.selectedMode = loadSavedGameMode();
    this.callbacks = {};
    this.settings = this.loadSettings();
    this.cacheDom();
    this.bindEvents();
    this.setMode(this.selectedMode);
    this.setDifficulty(this.selectedDifficulty);
    this.applySettingsToDom();
    this.updatePortraitPrompt();
    window.addEventListener('resize', () => this.updatePortraitPrompt());
    window.addEventListener('orientationchange', () => this.updatePortraitPrompt());
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { sensitivity: 1, mirror: true, calmBackground: false, performanceMode: true, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { sensitivity: 1, mirror: true, calmBackground: false, performanceMode: true };
  }

  saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  cacheDom() {
    this.screens = {
      menu: this.root.querySelector('#screen-menu'),
      game: this.root.querySelector('#screen-game'),
      gameover: this.root.querySelector('#screen-gameover'),
    };
    this.pauseMenu = this.root.querySelector('#pause-menu');
    this.pauseBtn = this.root.querySelector('#btn-pause');
    this.settingsBtn = this.root.querySelector('#btn-settings');
    this.settingsDrawer = this.root.querySelector('#settings-drawer');
    this.gameOverScore = this.root.querySelector('#gameover-score');
    this.gameOverDetails = this.root.querySelector('#gameover-details');
    this.gameOverBadge = this.root.querySelector('#gameover-badge');
    this.gameOverReason = this.root.querySelector('#gameover-reason');
    this.bootLoader = this.root.querySelector('#boot-loader');
    this.bootProgressFill = this.root.querySelector('#boot-progress-fill');
    this.bootStatus = this.root.querySelector('#boot-status');
    this.bootRetryBtn = this.root.querySelector('#btn-boot-retry');
    this.onboardingCamera = this.root.querySelector('#onboarding-camera');
    this.errorCamera = this.root.querySelector('#error-camera');
    this.portraitPrompt = this.root.querySelector('#portrait-prompt');
    this.liveScore = this.root.querySelector('#live-score');
    this.musicVolume = this.root.querySelector('#music-volume');
    this.sfxVolume = this.root.querySelector('#sfx-volume');
    this.pauseMusicVolume = this.root.querySelector('#pause-music-volume');
    this.pauseSfxVolume = this.root.querySelector('#pause-sfx-volume');
    this.settingSensitivity = this.root.querySelector('#setting-sensitivity');
    this.settingMirror = this.root.querySelector('#setting-mirror');
    this.settingCalmBg = this.root.querySelector('#setting-calm-bg');
    this.settingPerformance = this.root.querySelector('#setting-performance');
  }

  getSelectedDifficulty() {
    return this.selectedDifficulty;
  }

  getSelectedMode() {
    return this.selectedMode;
  }

  getSettings() {
    return this.settings;
  }

  getBestScoreDisplay() {
    const diffLabel = getDifficulty(this.selectedDifficulty).label;
    const modeLabel = getGameMode(this.selectedMode).label;
    return {
      label: `Best ${modeLabel} · ${diffLabel}`,
      score: this.highScores.getBest(this.selectedDifficulty, this.selectedMode),
    };
  }

  setMode(id) {
    this.selectedMode = id;
    saveGameMode(id);
  }

  setDifficulty(id) {
    this.selectedDifficulty = id;
    saveDifficulty(id);
  }

  on(event, fn) {
    this.callbacks[event] = fn;
  }

  bindVolumeInput(input, kind) {
    if (!input) return;
    input.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (kind === 'music') {
        this.callbacks.musicVolume?.(value);
      } else {
        this.callbacks.sfxVolume?.(value);
      }
    });
  }

  bindSliceableClick(selector, action) {
    const el = this.root.querySelector(selector);
    el?.addEventListener('click', () => this.callbacks[action]?.());
  }

  bindEvents() {
    this.pauseBtn?.addEventListener('click', () => this.callbacks.pause?.());
    this.bindSliceableClick('#btn-resume', 'resume');
    this.bindSliceableClick('#btn-restart', 'restart');
    this.bindSliceableClick('#btn-home-pause', 'home');
    this.bindSliceableClick('#btn-play-again', 'restart');
    this.bindSliceableClick('#btn-home-gameover', 'home');
    this.bindSliceableClick('#btn-leaderboard-gameover', 'leaderboard');
    this.bindSliceableClick('#btn-enable-camera', 'enableCamera');
    this.bindSliceableClick('#btn-skip-camera', 'mouseFallback');
    this.bindSliceableClick('#btn-retry-camera', 'enableCamera');
    this.bindSliceableClick('#btn-mouse-fallback', 'mouseFallback');
    this.bootRetryBtn?.addEventListener('click', () => this.callbacks.bootRetry?.());

    this.settingsBtn?.addEventListener('click', () => this.toggleSettingsDrawer());

    this.settingSensitivity?.addEventListener('input', (e) => {
      this.settings.sensitivity = parseFloat(e.target.value);
      this.saveSettings();
      this.callbacks.settingsChange?.(this.settings);
    });
    this.settingMirror?.addEventListener('change', (e) => {
      this.settings.mirror = e.target.checked;
      this.saveSettings();
      this.callbacks.settingsChange?.(this.settings);
    });
    this.settingCalmBg?.addEventListener('change', (e) => {
      this.settings.calmBackground = e.target.checked;
      this.saveSettings();
      this.callbacks.settingsChange?.(this.settings);
    });
    this.settingPerformance?.addEventListener('change', (e) => {
      this.settings.performanceMode = e.target.checked;
      this.saveSettings();
      this.callbacks.settingsChange?.(this.settings);
    });

    this.bindVolumeInput(this.musicVolume, 'music');
    this.bindVolumeInput(this.sfxVolume, 'sfx');
    this.bindVolumeInput(this.pauseMusicVolume, 'music');
    this.bindVolumeInput(this.pauseSfxVolume, 'sfx');

    document.addEventListener('click', (e) => {
      if (!this.settingsDrawer?.classList.contains('open')) return;
      if (e.target.closest('#settings-drawer') || e.target.closest('#btn-settings')) return;
      this.closeSettingsDrawer();
    });
  }

  applySettingsToDom() {
    if (this.settingSensitivity) this.settingSensitivity.value = this.settings.sensitivity;
    if (this.settingMirror) this.settingMirror.checked = this.settings.mirror;
    if (this.settingCalmBg) this.settingCalmBg.checked = this.settings.calmBackground;
    if (this.settingPerformance) {
      this.settingPerformance.checked = this.settings.performanceMode !== false;
    }
  }

  toggleSettingsDrawer() {
    const open = this.settingsDrawer?.classList.toggle('open');
    this.settingsBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    this.settingsDrawer?.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  closeSettingsDrawer() {
    this.settingsDrawer?.classList.remove('open');
    this.settingsBtn?.setAttribute('aria-expanded', 'false');
    this.settingsDrawer?.setAttribute('aria-hidden', 'true');
  }

  setSettingsVisible(visible) {
    this.settingsBtn?.classList.toggle('hidden', !visible);
    if (!visible) this.closeSettingsDrawer();
  }

  showScreen(name) {
    if (name === 'game') {
      this.screens.menu?.classList.add('active');
      this.pauseBtn?.classList.remove('hidden');
      this.setSettingsVisible(false);
      this.showPauseMenu(false);
      this.screens.gameover?.classList.remove('active');
      return;
    }

    if (name === 'menu') {
      Object.values(this.screens).forEach((s) => s?.classList.remove('active'));
      this.screens.menu?.classList.add('active');
      this.pauseBtn?.classList.add('hidden');
      this.setSettingsVisible(true);
      this.showPauseMenu(false);
      return;
    }

    Object.values(this.screens).forEach((s) => s?.classList.remove('active'));
    this.screens[name]?.classList.add('active');
    this.pauseBtn?.classList.add('hidden');
    this.setSettingsVisible(name !== 'gameover');
    this.showPauseMenu(false);
  }

  showPauseMenu(show) {
    this.pauseMenu?.classList.toggle('active', show);
    if (show) this.closeSettingsDrawer();
  }

  showOnboardingCamera(show) {
    this.onboardingCamera?.classList.toggle('hidden', !show);
    this.onboardingCamera?.classList.toggle('active', show);
    if (show) {
      this.setSettingsVisible(false);
      this.pauseBtn?.classList.add('hidden');
    }
  }

  showCameraError(show) {
    this.errorCamera?.classList.toggle('hidden', !show);
    this.errorCamera?.classList.toggle('active', show);
  }

  updatePortraitPrompt() {
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
    this.portraitPrompt?.classList.toggle('hidden', !portrait);
  }

  showBootLoader() {
    this.bootLoader?.classList.remove('hidden');
    this.bootRetryBtn?.classList.add('hidden');
    this.updateBootProgress(0);
    if (this.bootStatus) this.bootStatus.textContent = 'Loading fruits…';
  }

  hideBootLoader() {
    this.bootLoader?.classList.add('hidden');
  }

  showBootFailure(message = 'Loading failed — check your connection') {
    if (this.bootStatus) this.bootStatus.textContent = message;
    this.bootRetryBtn?.classList.remove('hidden');
  }

  updateBootProgress(progress) {
    const pct = Math.max(0, Math.min(1, progress));
    if (this.bootProgressFill) {
      this.bootProgressFill.style.width = `${Math.round(pct * 100)}%`;
    }
    if (this.bootStatus && pct >= 1) {
      this.bootStatus.textContent = 'Ready!';
    }
  }

  updateLiveScore(score) {
    if (this.liveScore) this.liveScore.textContent = `Score: ${score}`;
  }

  buildBreakdownHtml(stats) {
    const b = stats.breakdown || {};
    const mode = stats.mode;
    const lines = [];

    if (mode === 'Arcade') {
      lines.push(`<p class="breakdown">Fruit points: <strong>${b.fruitPoints || 0}</strong></p>`);
      lines.push(`<p class="breakdown">Swipe bonus: <strong>${b.swipeBonus || 0}</strong></p>`);
      lines.push(`<p class="breakdown">Slice bonus: <strong>${b.arcadeBonus || 0}</strong></p>`);
      if (b.timeBonus) {
        lines.push(`<p class="breakdown">Time bonus: <strong>+${b.timeBonus}</strong></p>`);
      }
      if (b.bombPenalty) {
        lines.push(`<p class="breakdown">Bomb penalty: <strong>-${b.bombPenalty}</strong></p>`);
      }
    } else if (mode === 'Classic') {
      lines.push(`<p class="breakdown">Fruit points: <strong>${b.fruitPoints || 0}</strong></p>`);
      lines.push(`<p class="breakdown">Swipe bonus: <strong>${b.swipeBonus || 0}</strong></p>`);
      if (b.bombPenalty) {
        lines.push(`<p class="breakdown">Bomb penalty: <strong>-${b.bombPenalty}</strong></p>`);
      }
    } else if (mode === 'Zen') {
      lines.push(`<p class="breakdown">Fruits sliced: <strong>${stats.fruitsSliced}</strong></p>`);
      lines.push(`<p class="breakdown">Total score: <strong>${stats.score}</strong></p>`);
    }

    if (mode !== 'Zen') {
      lines.push(`<p class="breakdown">Combo milestones: <strong>${stats.milestoneCount || 0}</strong></p>`);
      const computed =
        (b.fruitPoints || 0) +
        (b.swipeBonus || 0) +
        (b.arcadeBonus || 0) +
        (b.timeBonus || 0) -
        (b.bombPenalty || 0);
      lines.push(`<p class="breakdown total">Total: <strong>${computed}</strong></p>`);
    }

    return lines.join('');
  }

  showGameOver(stats) {
    this.showScreen('gameover');
    if (this.gameOverScore) this.gameOverScore.textContent = stats.score;
    if (this.gameOverReason) this.gameOverReason.textContent = stats.reason || '';
    if (this.gameOverDetails) {
      this.gameOverDetails.innerHTML = `
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-label">Mode</span><span class="stat-value">${stats.mode}</span></div>
          <div class="stat-item"><span class="stat-label">Difficulty</span><span class="stat-value">${stats.difficulty}</span></div>
          <div class="stat-item"><span class="stat-label">Wave</span><span class="stat-value">${stats.wave}</span></div>
          <div class="stat-item"><span class="stat-label">Rank</span><span class="stat-value">#${stats.rank || '—'}</span></div>
        </div>
        ${this.buildBreakdownHtml(stats)}
      `;
    }
    if (this.gameOverBadge) {
      this.gameOverBadge.classList.toggle('hidden', !stats.isNewHighScore);
    }
  }

  setVolumeSliders(music, sfx) {
    for (const input of [
      this.musicVolume,
      this.sfxVolume,
      this.pauseMusicVolume,
      this.pauseSfxVolume,
    ]) {
      if (!input) continue;
      input.value = input.id.includes('music') ? music : sfx;
    }
  }
}
