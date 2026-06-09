import { CONFIG, GAME_STATES } from '../config.js';
import { getDifficulty } from '../config/Difficulty.js';
import { getGameMode, resolveBombOnSlice } from '../config/GameModes.js';
import { Physics } from '../physics/Physics.js';
import { Collision } from '../physics/Collision.js';
import { WaveManager } from './WaveManager.js';
import { PowerUpManager } from './PowerUpManager.js';
import { Renderer } from '../rendering/Renderer.js';
import { HandTracker } from '../handtracking/HandTracker.js';
import { AudioManager } from '../audio/AudioManager.js';
import { ParticleSystem } from '../particles/ParticleSystem.js';
import { SlicedPiece } from '../entities/SlicedPiece.js';
import { HighScoreStore } from '../storage/HighScoreStore.js';
import { MenuManager } from '../ui/MenuManager.js';
import { TutorialOverlay } from '../ui/TutorialOverlay.js';
import { SliceHitTest } from '../ui/SliceHitTest.js';
import { PlayerStatsStore } from '../storage/PlayerStatsStore.js';
import { DailyChallengeStore } from '../storage/DailyChallengeStore.js';

/**
 * Core game engine — ties together physics, rendering, audio, hand tracking,
 * collision detection, scoring, and state management.
 */
export class Game {
  constructor(canvas, video, ui) {
    this.canvas = canvas;
    this.video = video;
    this.ui = ui;

    this.physics = new Physics();
    this.collision = new Collision();
    this.waveManager = new WaveManager(this.physics);
    this.powerUpManager = new PowerUpManager(this.waveManager);
    this.menuManager = new MenuManager();
    this.tutorial = new TutorialOverlay();
    this.sliceHitTest = new SliceHitTest(document);
    this.playerStats = new PlayerStatsStore();
    this.dailyChallenge = new DailyChallengeStore();
    this.renderer = new Renderer(canvas);
    this.handTracker = new HandTracker();
    this.audio = new AudioManager();
    this.particles = new ParticleSystem(this.renderer.assetLoader);
    this.highScores = new HighScoreStore();
    this.difficulty = getDifficulty();
    this.gameMode = getGameMode();

    this.state = GAME_STATES.MENU;
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
    this.slicedPieces = [];
    this.menuSlicedPieces = [];
    this.fruitsSliced = 0;
    this.swipeActive = false;
    this.currentSwipeHits = new Set();
    this.swipeHitPositions = [];
    this.timerRemaining = 0;
    this.gameStartTime = 0;
    this.bombOnSlice = 'strike';
    this.calibrated = false;
    this.calibrationStatus = 'Starting camera...';
    this.calibrationProgress = 0;
    this.cameraReady = false;
    this.rafId = null;
    this.lastTime = 0;
    this.stats = {};
    this.milestonesThisChain = new Set();
    this.milestoneCount = 0;
    this.scoreBreakdown = this.createScoreBreakdown();
    this.lastTooSlowHint = 0;
    this.sessionComboMax = 0;
    this.gameSessionStart = 0;
    this.lastTutorialAdvance = 0;
    this.tutorialStep0Since = 0;
    this.onboardingPhase = null;
    this.handLostSince = 0;
    this.usePointerFallback = false;
    this.bootFailed = false;
    this._resizeRaf = null;
    this.applyUiSettings();
  }

  applyUiSettings() {
    const settings = this.ui.getSettings();
    this.handTracker.mirror = settings.mirror !== false;
    this.sensitivityMultiplier = settings.sensitivity ?? 1;
    this.renderer.setPerformanceMode(settings.performanceMode !== false);
    void this.applyPerformanceProfile();
  }

  isPerformanceMode() {
    return this.ui.getSettings().performanceMode !== false;
  }

  getHandModelComplexity() {
    if (this.isPerformanceMode()) return 0;
    return this.difficulty.modelComplexity ?? CONFIG.handTracking.modelComplexity;
  }

  async applyPerformanceProfile() {
    if (this.usePointerFallback) {
      this.releaseHandTracking();
      return;
    }

    this.handTracker.maxHands = this.isPerformanceMode()
      ? CONFIG.performance.maxHands
      : CONFIG.handTracking.maxHands;

    if (this.handTracker.running || this.handTracker.landmarker) {
      await this.syncHandTrackingProfile();
    }
    this.scheduleResize();
  }

  releaseHandTracking() {
    try {
      this.handTracker.landmarker?.close?.();
    } catch { /* ignore */ }
    this.handTracker.landmarker = null;
    this.handTracker.stop();
    this.cameraReady = false;
  }

  shouldRunHandTracking() {
    if (this.usePointerFallback) return false;
    if (document.hidden) return false;
    return (
      this.state === GAME_STATES.MENU ||
      this.state === GAME_STATES.PLAYING ||
      this.state === GAME_STATES.PAUSED ||
      this.state === GAME_STATES.GAME_OVER
    );
  }

  updateHandTrackingInterval() {
    if (!this.shouldRunHandTracking()) {
      this.handTracker.detectMinIntervalMs = 1000;
      return;
    }

    if (this.isPerformanceMode()) {
      if (this.state === GAME_STATES.PLAYING) {
        this.handTracker.detectMinIntervalMs = CONFIG.performance.playingDetectIntervalMs;
      } else if (this.state === GAME_STATES.PAUSED || this.state === GAME_STATES.GAME_OVER) {
        this.handTracker.detectMinIntervalMs = CONFIG.performance.pausedDetectIntervalMs;
      } else {
        this.handTracker.detectMinIntervalMs = CONFIG.performance.menuDetectIntervalMs;
      }
      return;
    }

    this.handTracker.detectMinIntervalMs =
      this.state === GAME_STATES.PLAYING ? 0 : 33;
  }

  createScoreBreakdown() {
    return {
      fruitPoints: 0,
      swipeBonus: 0,
      arcadeBonus: 0,
      timeBonus: 0,
      bombPenalty: 0,
      milestones: 0,
    };
  }

  getSwipeBannerText(count) {
    if (count >= 10) return `Blade Master! x${count}`;
    if (count >= 8) return `Amazing! x${count}`;
    if (count >= 5) return `Great! x${count}`;
    if (count >= 3) return `Combo! x${count}`;
    return `Swipe x${count}`;
  }

  getSwipeBannerColor(count) {
    if (count >= 10) return '#ff4081';
    if (count >= 8) return '#ffeb3b';
    if (count >= 5) return '#69f0ae';
    if (count >= 3) return '#fff59d';
    return '#fff59d';
  }

  async init() {
    window.addEventListener('resize', () => this.scheduleResize());
    this.ui.showBootLoader?.();
    this.ui.updateBootProgress?.(0);
    this.handTracker.bindPointerFallback(this.canvas);

    try {
      await this.audio.init();
      this.ui.updateBootProgress?.(0.08);

      const loader = this.renderer.assetLoader;
      const progressTick = setInterval(() => {
        this.ui.updateBootProgress?.(0.08 + loader.getProgress() * 0.92);
      }, 32);

      await this.renderer.preloadAssets();
      clearInterval(progressTick);
      this.ui.updateBootProgress?.(1);

      await new Promise((resolve) => setTimeout(resolve, 180));
    } catch (err) {
      this.bootFailed = true;
      const detail = err?.message ? ` — ${err.message}` : '';
      this.ui.showBootFailure?.(`Loading failed — check your connection${detail}`);
      console.error('Boot init failed:', err);
      return;
    }

    await this.startMenu();
  }

  markReadyToPlay() {
    const wasCalibrating = !this.calibrated;
    this.calibrated = true;
    this.handTracker.calibrated = true;
    this.calibrationProgress = 1;
    this.calibrationStatus = 'Hand ready — slice PLAY!';
    this.onboardingPhase = 'done';
    if (wasCalibrating && this.state === GAME_STATES.MENU && this.menuManager.getStep() === 'main') {
      this.rebuildMenuLayout('main');
    }
  }

  restoreInputMode() {
    if (localStorage.getItem('fruitBlade_cameraSkipped')) {
      this.usePointerFallback = true;
      this.handTracker.enablePointerFallback = true;
      this.markReadyToPlay();
    }
  }

  async enableCamera() {
    this.ui.showOnboardingCamera(false);
    this.ui.showCameraError(false);
    localStorage.removeItem('fruitBlade_cameraSkipped');
    this.usePointerFallback = false;
    this.handTracker.enablePointerFallback = false;
    this.onboardingPhase = 'calibration';
    this.handTracker.resetCalibration();
    this.calibrated = false;
    this.calibrationProgress = 0;
    void this.ensureHandTracking();
  }

  enableMouseFallback() {
    this.usePointerFallback = true;
    this.handTracker.enablePointerFallback = true;
    localStorage.setItem('fruitBlade_cameraSkipped', '1');
    this.ui.showOnboardingCamera(false);
    this.ui.showCameraError(false);
    if (!this.tutorial.done) this.tutorial.complete();
    this.releaseHandTracking();
    this.markReadyToPlay();
    void this.startMenu();
  }

  getPlayfieldSize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { width: rect.width, height: rect.height };
      }
    }
    return { width: window.innerWidth, height: window.innerHeight };
  }

  resize() {
    const { width, height } = this.getPlayfieldSize();
    if (width <= 0 || height <= 0) return;
    this.renderer.resize(width, height);
    this.physics.setGroundY(height + 20);
    if (this.isSliceableScreen()) {
      this.rebuildMenuLayout(this.menuManager.getStep());
    }
  }

  scheduleResize() {
    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    this._resizeRaf = requestAnimationFrame(() => {
      this._resizeRaf = null;
      this.resize();
    });
  }

  applyDifficulty(difficultyId) {
    this.difficulty = getDifficulty(difficultyId);
    this.waveManager.setDifficulty(this.difficulty);
    this.collision.setPadding(
      this.difficulty.hitboxPadding ?? CONFIG.collision.hitboxPadding
    );
    this.bombOnSlice = resolveBombOnSlice(this.gameMode, this.difficulty);
    this.handTracker.setModelComplexity(this.getHandModelComplexity());
  }

  async syncHandTrackingProfile() {
    const next = this.getHandModelComplexity();
    await this.handTracker.syncPerformanceProfile(next);
  }

  applyGameMode(modeId) {
    this.gameMode = getGameMode(modeId);
    this.waveManager.setGameMode(this.gameMode);
    this.bombOnSlice = resolveBombOnSlice(this.gameMode, this.difficulty);

    if (this.gameMode.livesOverride != null) {
      this.lives = this.gameMode.livesOverride;
    } else {
      this.lives = this.difficulty.startingLives;
    }

    if (this.gameMode.hasTimer) {
      this.timerRemaining = this.gameMode.timerSeconds;
    } else {
      this.timerRemaining = 0;
    }
  }

  getSliceThreshold() {
    let threshold = this.difficulty.sliceVelocityThreshold;
    const grace = CONFIG.handTracking.sliceGraceDurationMs;
    const mult = CONFIG.handTracking.sliceGraceMultiplier;
    if (this.gameStartTime && performance.now() - this.gameStartTime < grace) {
      threshold *= mult;
    }
    const sens = this.ui.getSettings().sensitivity ?? 1;
    return threshold / sens;
  }

  getMenuSliceThreshold() {
    const sens = this.ui.getSettings().sensitivity ?? 1;
    return (getDifficulty('easy').sliceVelocityThreshold * 0.5) / sens;
  }

  findMenuHits(trail, entities, threshold) {
    const saved = this.collision.padding;
    this.collision.setPadding(Math.max(saved, 18));
    const hits = this.collision.findHits(trail, entities, threshold);
    this.collision.setPadding(saved);
    return hits;
  }

  pickClosestHit(hits, trail) {
    if (!hits.length) return null;
    const tip = trail[trail.length - 1];
    hits.sort((a, b) => {
      const da = (a.entity.x - tip.x) ** 2 + (a.entity.y - tip.y) ** 2;
      const db = (b.entity.x - tip.x) ** 2 + (b.entity.y - tip.y) ** 2;
      return da - db;
    });
    return hits[0];
  }

  canStartGame() {
    return this.calibrated || this.usePointerFallback;
  }

  isSliceableScreen() {
    return this.state === GAME_STATES.MENU;
  }

  useWebcamBackground() {
    if (this.ui.getSettings().calmBackground) return false;
    return this.state === GAME_STATES.MENU || this.state === GAME_STATES.PLAYING;
  }

  clearMenuVisuals() {
    this.menuSlicedPieces = [];
  }

  rebuildMenuLayout(step = this.menuManager.getStep()) {
    this.clearMenuVisuals();
    const showCalibration =
      !this.calibrated && !this.usePointerFallback && step === 'main';
    this.menuManager.buildLayout(this.renderer.width, this.renderer.height, step, {
      showCalibration,
    });
    if (this.state === GAME_STATES.MENU) {
      const skin = this.playerStats.getBladeSkinDef();
      this.menuManager.setSelected(
        this.ui.getSelectedMode(),
        this.ui.getSelectedDifficulty(),
        skin.id
      );
      this.menuManager.updateKeyboardFocus();
    }
  }

  formatStatsLines() {
    const s = this.playerStats.load();
    const mins = Math.floor(s.timePlayedMs / 60000);
    return [
      `${s.fruitsSliced.toLocaleString()} fruits sliced lifetime`,
      `Best combo: ${s.bestCombo}`,
      `Games played: ${s.gamesPlayed}`,
      `Time played: ${mins} min`,
      `Blade: ${this.playerStats.getBladeSkinDef().label}`,
    ];
  }

  openStats() {
    this.state = GAME_STATES.MENU;
    this.menuManager.setStatsLines(this.formatStatsLines());
    this.menuManager.setStep('stats');
    this.rebuildMenuLayout('stats');
    this.scheduleResize();
  }

  toggleFullscreen() {
    const el = document.getElementById('app');
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  async startMenu() {
    this.state = GAME_STATES.MENU;
    this.applyDifficulty(this.ui.getSelectedDifficulty());
    this.applyGameMode(this.ui.getSelectedMode());
    this.waveManager.reset();
    this.slicedPieces = [];
    this.menuSlicedPieces = [];
    this.particles.clear();
    this.renderer.effects.clear();
    this.menuManager.setStep('main');

    this.restoreInputMode();

    if (this.usePointerFallback) {
      // Mouse mode — skip camera calibration
    } else if (this.handTracker.calibrated) {
      this.markReadyToPlay();
    } else {
      this.calibrated = false;
      this.calibrationProgress = 0;
      this.calibrationStatus = 'Starting camera...';
      this.handTracker.resetCalibration();
      this.onboardingPhase = 'calibration';
    }

    this.ui.showScreen('menu');
    this.ui.showOnboardingCamera(false);
    this.resize();
    this.scheduleResize();
    this.startLoop();
    this.hideBootLoaderAfterFirstFrame();

    if (!this.usePointerFallback) {
      void this.ensureHandTracking();
    }
  }

  hideBootLoaderAfterFirstFrame() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.ui.hideBootLoader?.();
      });
    });
  }

  async ensureHandTracking() {
    try {
      if (!this.handTracker.running) {
        await this.handTracker.startCamera(this.video);
      } else if (
        this.video.videoWidth > 0 &&
        this.video.videoWidth < CONFIG.handTracking.cameraMinWidth + 80
      ) {
        // Upgrade old 640×480 sessions to the sharper default capture size
        this.handTracker.stop();
        await this.handTracker.startCamera(this.video);
      }
      if (!this.handTracker.landmarker) {
        this.calibrationStatus = 'Loading hand tracking...';
        await this.handTracker.loadModel();
      } else {
        await this.syncHandTrackingProfile();
      }
      this.cameraReady = true;
      if (!this.calibrated) {
        this.calibrationStatus = 'Show your hand to calibrate';
      }
    } catch (err) {
      this.calibrationStatus = `Camera error: ${err.message}`;
      this.ui.showCameraError(true);
      console.error(err);
    }
  }

  startGame() {
    this.applyDifficulty(this.ui.getSelectedDifficulty());
    this.applyGameMode(this.ui.getSelectedMode());
    this.state = GAME_STATES.PLAYING;
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
    this.slicedPieces = [];
    this.menuSlicedPieces = [];
    this.menuManager.fruits = [];
    this.menuManager.panels = [];
    this.menuManager.setStep('main');
    this.fruitsSliced = 0;
    this.swipeActive = false;
    this.currentSwipeHits.clear();
    this.swipeHitPositions = [];
    this.gameStartTime = performance.now();
    this.gameSessionStart = performance.now();
    this.sessionComboMax = 0;
    this.milestonesThisChain.clear();
    this.milestoneCount = 0;
    this.scoreBreakdown = this.createScoreBreakdown();
    this.waveManager.reset();
    this.powerUpManager.reset();
    this.particles.clear();
    this.renderer.effects.clear();
    this.ui.showScreen('game');
    this.scheduleResize();
    this.waveManager.spawnTimer = 0;
    this.audio.resume();
    this.audio.startMusic();
    this.startLoop();
  }

  pause() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.state = GAME_STATES.PAUSED;
    this.sliceHitTest.reset();
    this.ui.showPauseMenu(true);
  }

  resume() {
    if (this.state !== GAME_STATES.PAUSED) return;
    this.state = GAME_STATES.PLAYING;
    this.sliceHitTest.reset();
    this.ui.showPauseMenu(false);
    this.lastTime = performance.now();
  }

  restart() {
    this.audio.stopMusic();
    this.startGame();
  }

  async goHome() {
    this.audio.stopMusic();
    this.sliceHitTest.reset();
    this.ui.showPauseMenu(false);
    await this.startMenu();
  }

  endGame(reason = 'Game Over') {
    this.state = GAME_STATES.GAME_OVER;
    this.audio.stopMusic();
    if (reason.includes('bomb')) {
      this.audio.playBomb();
    }

    if (this.gameMode.id === 'arcade') {
      const secondsLeft =
        reason === "Time's up!"
          ? this.gameMode.timerSeconds
          : Math.ceil(this.timerRemaining);
      if (secondsLeft > 0) {
        const timeBonus = secondsLeft * CONFIG.gameplay.arcadeTimeBonusPerSecond;
        this.score += timeBonus;
        this.scoreBreakdown.timeBonus = timeBonus;
      }
    }

    const result = this.highScores.add(this.score, {
      wave: this.waveManager.wave,
      fruitsSliced: this.fruitsSliced,
      difficulty: this.difficulty.id,
      difficultyLabel: this.difficulty.label,
      mode: this.gameMode.id,
      modeLabel: this.gameMode.label,
      reason,
    });

    this.stats = {
      score: this.score,
      wave: this.waveManager.wave,
      fruitsSliced: this.fruitsSliced,
      rank: result.modeRank,
      globalRank: result.rank,
      isNewHighScore: result.isNewHighScore,
      difficulty: this.difficulty.label,
      mode: this.gameMode.label,
      reason,
      breakdown: { ...this.scoreBreakdown },
      milestoneCount: this.milestoneCount,
    };

    this.waveManager.reset();
    this.slicedPieces = [];
    this.particles.clear();
    this.renderer.effects.clear();
    this.ui.showGameOver(this.stats);
    this.sliceHitTest.reset();

    const durationMs = performance.now() - (this.gameSessionStart || this.gameStartTime);
    this.playerStats.recordGame({
      fruitsSliced: this.fruitsSliced,
      bestCombo: this.sessionComboMax,
      durationMs,
    });
    this.dailyChallenge.addProgress(this.gameMode.id, this.fruitsSliced);

    if (!this.rafId) this.startLoop();
  }

  startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.lastTime = performance.now();
    const loop = (now) => {
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min((now - this.lastTime) / 1000, CONFIG.canvas.maxDeltaMs / 1000);
      this.lastTime = now;
      this.update(dt);
      this.render();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  update(dt) {
    if (this.renderer.width <= 0 || this.renderer.height <= 0) {
      this.resize();
    }
    const { width, height } = this.renderer;
    if (width <= 0 || height <= 0) return;

    // Throttle ML inference based on game state + performance settings
    this.updateHandTrackingInterval();

    if (this.shouldRunHandTracking()) {
      this.handTracker.update(width, height);
    }

    if (this.state === GAME_STATES.PAUSED || this.state === GAME_STATES.GAME_OVER) {
      this.processHtmlSliceHits();
      this.particles.update(dt);
      this.renderer.effects.update(dt);
      return;
    }

    if (this.isSliceableScreen()) {
      this.updateSliceableUI(dt);
      return;
    }

    if (this.state !== GAME_STATES.PLAYING) return;

    this.updateHandLostState();

    if (this.gameMode.hasTimer) {
      this.timerRemaining -= dt;
      if (this.timerRemaining <= 0) {
        this.timerRemaining = 0;
        this.endGame("Time's up!");
        return;
      }
    }

    this.powerUpManager.update(dt);
    this.waveManager.update(dt, width, height);

    const fruitDt = dt * this.powerUpManager.getFruitTimeScale();

    for (const fruit of this.waveManager.entities) {
      if (fruit.alive && !fruit.sliced) {
        fruit.update(fruitDt, this.physics);

        if (this.physics.isBelowGround(fruit.y, fruit.radius)) {
          fruit.alive = false;
          if (!fruit.isBomb && !fruit.isPowerUp && this.gameMode.missPenalty) {
            this.loseLife('Missed a fruit');
            if (this.state !== GAME_STATES.PLAYING) return;
          }
        }
      }
    }

    for (const piece of this.slicedPieces) {
      piece.update(fruitDt, this.physics);
    }
    this.slicedPieces = this.slicedPieces.filter((p) => p.alive);

    this.particles.update(dt);
    this.renderer.effects.update(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt * 1000;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
        this.milestonesThisChain.clear();
      }
    }

    this.processSlices();
    this.checkTooSlowFeedback();
    const prevCount = this.waveManager.entities.length;
    this.waveManager.removeDead();
    if (this.waveManager.entities.length < prevCount) {
      this.waveManager.onEntityRemoved(width, height);
    }
  }

  checkTooSlowFeedback() {
    const threshold = this.getSliceThreshold();
    const minV = CONFIG.handTracking.tooSlowMinVelocity ?? 180;
    const cooldown = CONFIG.handTracking.tooSlowHintCooldownMs ?? 2200;
    const now = performance.now();
    if (now - this.lastTooSlowHint < cooldown) return;

    for (const hand of this.handTracker.hands) {
      if (!hand.bladeActive) continue;
      if (hand.velocity >= threshold) continue;
      if (hand.velocity < minV) continue;

      this.lastTooSlowHint = now;
      this.renderer.effects.addFloatingScore(
        hand.x,
        hand.y - 36,
        'Too slow!',
        '#ffab91',
        1.05
      );
      break;
    }
  }

  updateSliceableUI(dt) {
    const now = performance.now();

    const cal = this.handTracker.updateCalibration();
    this.calibrationProgress = cal.progress;

    if (!this.usePointerFallback && !this.calibrated) {
      if (cal.complete) {
        this.markReadyToPlay();
        if (!this.tutorial.done) this.tutorial.complete();
      } else if (this.menuManager.getStep() === 'leaderboard') {
        this.calibrationStatus = 'Slice Back to return to menu';
      } else if (cal.handCount > 0) {
        const hint = cal.distanceHint ? `${cal.distanceHint} · ` : '';
        this.calibrationStatus = `${hint}Hold steady (${Math.round(cal.progress * 100)}%)`;
      } else if (this.cameraReady) {
        this.calibrationStatus = 'Loading hand model…';
        if (!this.handTracker.landmarker) {
          this.calibrationStatus = 'Loading hand tracking…';
        } else {
          this.calibrationStatus = 'Show your hand to calibrate';
        }
      }
    } else {
      const step = this.menuManager.getStep();
      this.calibrationStatus = step === 'leaderboard'
        ? 'Slice Back to return to menu'
        : 'Hand ready — slice PLAY!';
    }

    const skin = this.playerStats.getBladeSkinDef();
    this.menuManager.setSelected(
      this.ui.getSelectedMode(),
      this.ui.getSelectedDifficulty(),
      skin.id
    );

    this.menuManager.update(dt, now);

    for (const piece of this.menuSlicedPieces) {
      piece.update(dt, this.physics);
    }
    this.menuSlicedPieces = this.menuSlicedPieces.filter((p) => p.alive);

    this.particles.update(dt);
    this.renderer.effects.update(dt);
    this.processSliceableMenuSlices();
  }

  updateHandLostState() {
    const now = performance.now();
    if (this.handTracker.hands.length > 0) {
      this.handLostSince = 0;
      return;
    }
    if (!this.handLostSince) this.handLostSince = now;
  }

  getHandLost() {
    if (!this.handLostSince) return false;
    return performance.now() - this.handLostSince > 2000;
  }

  processHtmlSliceHits() {
    const threshold = this.getMenuSliceThreshold();
    if (!this.handTracker.isSlicing(threshold)) return;

    const hits = this.sliceHitTest.testTrails(this.handTracker.getAllTrails(), threshold);
    for (const el of hits) {
      const action = el.dataset.sliceable;
      if (!action) continue;
      el.click();
      this.audio.playSlice('orange');
      break;
    }
  }

  handleKeyboardNav(key) {
    if (!this.isSliceableScreen()) return false;

    if (key === 'ArrowRight' || key === 'ArrowDown') {
      this.menuManager.moveKeyboardFocus(1);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      this.menuManager.moveKeyboardFocus(-1);
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      const focused = this.menuManager.getKeyboardFocused();
      if (focused) {
        if (this.menuManager.isSelectAction(focused.action)) {
          this.selectMenuOption(focused);
        } else {
          this.sliceMenuFruit(focused, 0, [{ x: focused.x, y: focused.y, velocity: 2000 }], 0);
        }
        return true;
      }
    }
    return false;
  }

  processSliceableMenuSlices() {
    const trails = this.handTracker.getAllTrails();
    const threshold = this.getMenuSliceThreshold();
    if (!this.handTracker.isSlicing(threshold)) return;

    const entities = this.menuManager.getActiveFruits();
    if (!entities.length) return;

    for (const trail of trails) {
      const hits = this.findMenuHits(trail, entities, threshold);
      if (!hits.length) continue;

      const selectHits = hits.filter((h) => this.menuManager.isSelectAction(h.entity.action));
      if (selectHits.length) {
        const best = this.pickClosestHit(selectHits, trail);
        if (best) this.selectMenuOption(best.entity);
        return;
      }

      const actionHit = this.pickClosestHit(hits, trail);
      if (actionHit && !actionHit.entity.sliced) {
        this.sliceMenuFruit(
          actionHit.entity,
          actionHit.sliceAngle,
          trail,
          actionHit.segmentIndex
        );
      }
      return;
    }
  }

  selectMenuOption(menuFruit) {
    if (menuFruit.action === 'mode' && menuFruit.actionValue === this.ui.getSelectedMode()) {
      this.menuManager.pulseSelection(menuFruit);
      return;
    }
    if (menuFruit.action === 'difficulty' && menuFruit.actionValue === this.ui.getSelectedDifficulty()) {
      this.menuManager.pulseSelection(menuFruit);
      return;
    }

    this.menuManager.pulseSelection(menuFruit);
    this.particles.spawnJuice(menuFruit.x, menuFruit.y, menuFruit.def.juice, 0);
    this.audio.playSlice(menuFruit.type);

    this.renderer.effects.addFloatingScore(
      menuFruit.x,
      menuFruit.y - 20,
      menuFruit.label,
      '#ffeb3b',
      1.05
    );

    switch (menuFruit.action) {
      case 'mode':
        this.ui.setMode(menuFruit.actionValue);
        this.applyGameMode(menuFruit.actionValue);
        this.menuManager.setSelected(this.ui.getSelectedMode(), this.ui.getSelectedDifficulty());
        break;
      case 'difficulty':
        this.ui.setDifficulty(menuFruit.actionValue);
        this.applyDifficulty(menuFruit.actionValue);
        void this.syncHandTrackingProfile();
        this.menuManager.setSelected(this.ui.getSelectedMode(), this.ui.getSelectedDifficulty());
        break;
      case 'lb-cycle-mode': {
        const next = this.menuManager.cycleFilter('mode');
        this.openLeaderboardFiltered(next, this.menuManager.leaderboardFilterDifficulty);
        break;
      }
      case 'lb-cycle-diff': {
        const next = this.menuManager.cycleFilter('diff');
        this.openLeaderboardFiltered(this.menuManager.leaderboardFilterMode, next);
        break;
      }
      default:
        break;
    }
  }

  openLeaderboardFiltered(mode, difficulty) {
    this.menuManager.setLeaderboardFilter(mode, difficulty);
    this.refreshLeaderboardEntries();
  }

  sliceMenuFruit(menuFruit, sliceAngle, trail, segmentIndex) {
    if (this.menuManager.isSelectAction(menuFruit.action)) {
      this.selectMenuOption(menuFruit);
      return;
    }

    const now = performance.now();
    const oneShot = [
      'back', 'leaderboard', 'play', 'resume', 'restart',
      'play-again', 'game-menu', 'stats', 'fullscreen', 'blade-skin',
    ].includes(menuFruit.action);
    this.menuManager.markSliced(menuFruit, now, oneShot ? 0 : 700);

    const angle = this.collision.getSliceAngle(trail, segmentIndex) || sliceAngle;
    const fake = {
      type: menuFruit.type,
      def: menuFruit.def,
      radius: menuFruit.radius,
      x: menuFruit.x,
      y: menuFruit.y,
      rotation: menuFruit.rotation,
      vx: 0,
      vy: 0,
      rotationSpeed: 0,
    };

    this.menuSlicedPieces.push(new SlicedPiece(fake, 'left', angle));
    this.menuSlicedPieces.push(new SlicedPiece(fake, 'right', angle));
    this.particles.spawnJuice(menuFruit.x, menuFruit.y, menuFruit.def.juice, angle);
    this.audio.playSlice(menuFruit.type);

    const label = menuFruit.label;
    this.renderer.effects.addFloatingScore(
      menuFruit.x,
      menuFruit.y - 20,
      menuFruit.action === 'play' ? 'GO!' : label,
      menuFruit.action === 'play' ? '#69f0ae' : '#fff59d',
      menuFruit.action === 'play' ? 1.5 : 1.1
    );

    switch (menuFruit.action) {
      case 'play':
        if (this.canStartGame()) {
          setTimeout(() => this.startGame(), 400);
        } else {
          this.renderer.effects.addFloatingScore(
            this.renderer.width / 2,
            this.renderer.height * 0.45,
            'Show your hand to calibrate first!',
            '#ffab91',
            1.2
          );
        }
        break;
      case 'back':
        this.menuManager.setStep('main');
        this.rebuildMenuLayout('main');
        break;
      case 'leaderboard':
        this.openLeaderboard();
        break;
      case 'stats':
        this.openStats();
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;
      case 'blade-skin':
        this.playerStats.setBladeSkin(menuFruit.actionValue);
        this.menuManager.setStatsLines(this.formatStatsLines());
        this.menuManager.setSelected(
          this.ui.getSelectedMode(),
          this.ui.getSelectedDifficulty(),
          menuFruit.actionValue
        );
        this.renderer.effects.addFloatingScore(
          menuFruit.x,
          menuFruit.y - 20,
          'Blade equipped!',
          '#FFE566',
          1.1
        );
        break;
    }
  }

  refreshLeaderboardEntries() {
    const filter = this.menuManager.getLeaderboardFilter();
    const entries = this.highScores.getFiltered(filter.mode, filter.difficulty);
    this.menuManager.setLeaderboardEntries(entries);
    this.rebuildMenuLayout('leaderboard');
  }

  checkComboMilestones(count) {
    let best = null;
    for (const milestone of CONFIG.comboMilestones) {
      if (count < milestone.count || this.milestonesThisChain.has(milestone.count)) continue;
      if (!best || milestone.count > best.count) best = milestone;
    }
    if (!best) return;

    for (const milestone of CONFIG.comboMilestones) {
      if (milestone.count <= count) this.milestonesThisChain.add(milestone.count);
    }

    this.milestoneCount++;
    this.scoreBreakdown.milestones++;

    const { width, height } = this.renderer;
    this.renderer.effects.showMilestoneBanner(best.text, 1200);
    if (best.shake) this.renderer.effects.triggerShake(best.shake);
    if (best.pulse) this.renderer.effects.triggerScreenPulse(0.14);
    if (best.sparkle) {
      this.particles.spawnSparkle(width / 2, height * 0.38);
    }
    this.audio.playMilestone(best.count);
  }

  slicePowerUp(powerUp, sliceAngle, trail, segmentIndex) {
    powerUp.sliced = true;
    powerUp.alive = false;

    const angle = this.collision.getSliceAngle(trail, segmentIndex) || sliceAngle;
    this.slicedPieces.push(new SlicedPiece(powerUp, 'left', angle));
    this.slicedPieces.push(new SlicedPiece(powerUp, 'right', angle));
    this.particles.spawnJuice(powerUp.x, powerUp.y, ['#fff59d', '#ffeb3b'], angle);
    this.particles.spawnSparkle(powerUp.x, powerUp.y);

    const activated = this.powerUpManager.activate(powerUp.powerType);
    if (activated) {
      const { width, height } = this.renderer;
      this.renderer.effects.showMilestoneBanner(activated.label, 1000, activated.color);
      this.renderer.effects.triggerShake(6);
      this.audio.playPowerUp(powerUp.powerType);
      this.renderer.effects.addFloatingScore(
        powerUp.x,
        powerUp.y - 24,
        activated.label,
        activated.color,
        1.3
      );
      this.renderer.effects.addFloatingScore(
        width / 2,
        height * 0.55,
        `${activated.duration}s`,
        'rgba(255,255,255,0.85)',
        0.9
      );
    }
  }

  loseLife(reason, { playSound = true } = {}) {
    this.lives--;
    if (playSound) this.audio.playMiss();
    this.renderer.effects.triggerShake(6);
    this.renderer.effects.addFloatingScore(
      this.renderer.width / 2,
      this.renderer.height * 0.35,
      reason,
      '#ef5350',
      1.1
    );

    if (this.gameMode.endsOnLives && this.lives <= 0) {
      this.endGame('No lives remaining');
    }
  }

  processSlices() {
    const trails = this.handTracker.getAllTrails();
    const entities = this.waveManager.entities;
    const threshold = this.getSliceThreshold();
    const isSlicing = this.handTracker.isSlicing(threshold);

    if (!isSlicing) {
      if (this.swipeActive) {
        this.finalizeSwipe();
      }
      this.swipeActive = false;
      this.currentSwipeHits.clear();
      this.swipeHitPositions = [];
      return;
    }

    const swipeHitsThisFrame = new Set();

    for (const trail of trails) {
      const hits = this.collision.findHits(trail, entities, threshold);

      for (const hit of hits) {
        const { entity, sliceAngle, segmentIndex } = hit;
        if (entity.sliced || swipeHitsThisFrame.has(entity.id)) continue;

        if (entity.isBomb) {
          this.sliceBomb(entity);
          if (this.state !== GAME_STATES.PLAYING) return;
          continue;
        }

        if (entity.isPowerUp) {
          this.slicePowerUp(entity, sliceAngle, trail, segmentIndex);
          continue;
        }

        swipeHitsThisFrame.add(entity.id);
        this.currentSwipeHits.add(entity.id);
        this.swipeHitPositions.push({ x: entity.x, y: entity.y });
        this.sliceFruit(entity, sliceAngle, trail, segmentIndex);
      }
    }

    if (swipeHitsThisFrame.size > 0) {
      this.swipeActive = true;
    }
  }

  finalizeSwipe() {
    const count = this.currentSwipeHits.size;
    if (count < 2) return;

    const bonus = Math.round(
      count *
        CONFIG.gameplay.swipeBonusPerFruit *
        this.difficulty.scoreMultiplier *
        this.powerUpManager.getScoreMultiplier()
    );
    this.score += bonus;
    this.scoreBreakdown.swipeBonus += bonus;
    this.checkComboMilestones(count);

    const { width, height } = this.renderer;
    const positions = this.swipeHitPositions;
    let midX = width / 2;
    let midY = height * 0.5;
    if (positions.length > 0) {
      midX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
      midY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
    }

    const bannerColor = this.getSwipeBannerColor(count);
    this.renderer.effects.addFloatingScore(
      midX,
      midY - 18,
      this.getSwipeBannerText(count),
      bannerColor,
      count >= 5 ? 1.55 : 1.35
    );
    this.renderer.effects.addFloatingScore(
      midX,
      midY + 14,
      `+${bonus}`,
      '#fff59d',
      1.05
    );
    if (count >= 3) this.audio.playCombo(count);
  }

  sliceBomb(bomb) {
    bomb.sliced = true;
    bomb.alive = false;
    this.particles.spawnExplosion(bomb.x, bomb.y);
    this.renderer.effects.triggerShake(14);

    const rule = this.bombOnSlice;

    if (rule === 'instant') {
      this.endGame('You hit a bomb!');
      return;
    }

    if (rule === 'strike') {
      this.audio.playBombSlice();
      this.renderer.effects.addFloatingScore(
        bomb.x,
        bomb.y - 30,
        'BOMB! -1 life',
        '#ff5722',
        1.3
      );
      this.loseLife('You hit a bomb!', { playSound: false });
      return;
    }

    if (rule === 'points') {
      const penalty = this.gameMode.bombPointPenalty || 50;
      this.score = Math.max(0, this.score - penalty);
      this.scoreBreakdown.bombPenalty += penalty;
      this.audio.playBombSlice();
      this.renderer.effects.addFloatingScore(
        bomb.x,
        bomb.y - 30,
        `BOMB! -${penalty}`,
        '#ff5722',
        1.3
      );
    }
  }

  sliceFruit(fruit, sliceAngle, trail, segmentIndex) {
    fruit.sliced = true;
    fruit.alive = false;
    this.fruitsSliced++;

    const angle = this.collision.getSliceAngle(trail, segmentIndex) || sliceAngle;

    this.slicedPieces.push(new SlicedPiece(fruit, 'left', angle));
    this.slicedPieces.push(new SlicedPiece(fruit, 'right', angle));
    this.particles.spawnJuice(fruit.x, fruit.y, fruit.def.juice, angle);

    this.combo++;
    this.sessionComboMax = Math.max(this.sessionComboMax, this.combo);
    this.comboTimer = CONFIG.gameplay.comboWindowMs;
    this.multiplier = Math.min(
      CONFIG.gameplay.maxComboMultiplier,
      1 + (this.combo - 1) * CONFIG.gameplay.comboMultiplierStep
    );

    const isCritical = Math.random() < CONFIG.gameplay.criticalChance;
    let points = CONFIG.gameplay.scorePerFruit + (fruit.def.scoreBonus || 0);
    points = Math.round(
      points *
        this.multiplier *
        this.difficulty.scoreMultiplier *
        this.powerUpManager.getScoreMultiplier()
    );
    if (isCritical) {
      points *= CONFIG.gameplay.criticalMultiplier;
      this.audio.playCritical();
      this.checkComboMilestones(this.combo);
      this.score += points;
      this.scoreBreakdown.fruitPoints += points;

      if (this.gameMode.id === 'arcade') {
        const sliceBonus = CONFIG.gameplay.arcadeSliceBonusPerFruit;
        this.score += sliceBonus;
        this.scoreBreakdown.arcadeBonus += sliceBonus;
      }
      this.renderer.effects.addFloatingScore(
        fruit.x,
        fruit.y - 30,
        `CRITICAL! +${points}`,
        '#ff4081',
        1.4
      );
      this.renderer.effects.triggerShake(6);
      this.particles.spawnSparkle(fruit.x, fruit.y);
      return;
    }

    this.renderer.effects.addFloatingScore(
      fruit.x,
      fruit.y - 20,
      `+${points}`,
      '#fff59d'
    );

    this.score += points;
    this.scoreBreakdown.fruitPoints += points;

    if (this.gameMode.id === 'arcade') {
      const sliceBonus = CONFIG.gameplay.arcadeSliceBonusPerFruit;
      this.score += sliceBonus;
      this.scoreBreakdown.arcadeBonus += sliceBonus;
    }

    this.checkComboMilestones(this.combo);
    this.audio.playSlice(fruit.type);
  }

  render() {
    const isSliceable = this.isSliceableScreen();
    const isPlaying = this.state === GAME_STATES.PLAYING;
    const showHUD = isPlaying;
    const best = this.ui.getBestScoreDisplay();
    const currentScore = this.state === GAME_STATES.GAME_OVER ? this.stats.score : this.score;

    if (isPlaying) this.ui.updateLiveScore(currentScore);

    const bladeSkin = this.playerStats.getBladeSkinDef();
    const daily = this.dailyChallenge.load();

    this.renderer.render({
      fruits: isPlaying ? this.waveManager.entities : [],
      slicedPieces: isSliceable ? this.menuSlicedPieces : this.slicedPieces,
      menuFruits: isSliceable ? this.menuManager.getActiveFruits() : null,
      menuPanels: isSliceable ? this.menuManager.getPanels() : null,
      menuStep: isSliceable ? this.menuManager.getStep() : null,
      isMenu: isSliceable,
      particles: this.particles,
      trails: this.handTracker.getAllTrails(),
      score: currentScore,
      lives: this.lives,
      combo: this.combo,
      multiplier: this.multiplier,
      wave: this.waveManager.wave,
      difficultyLabel: this.difficulty.label,
      modeLabel: this.gameMode.label,
      showLives: this.gameMode.showLives,
      timerRemaining: this.gameMode.hasTimer ? Math.ceil(this.timerRemaining) : null,
      activePowerUps: this.powerUpManager.getActiveEffects(),
      showHUD,
      showMenuHUD: isSliceable,
      handLost: isPlaying && this.getHandLost(),
      calibrationProgress: this.calibrationProgress,
      calibrationStatus: this.calibrationStatus,
      calibrated: this.calibrated,
      bestScoreLabel: best.label,
      bestScore: best.score,
      video: this.video,
      useWebcamBackground: this.useWebcamBackground(),
      mirror: this.ui.getSettings().mirror,
      bladeSkin,
      dailyChallengeLabel: this.state === GAME_STATES.MENU
        ? this.dailyChallenge.getLabel(daily)
        : null,
      menuLayoutMeta: isSliceable ? this.menuManager.layoutMeta : null,
      usePointerFallback: this.usePointerFallback,
      performanceMode: this.isPerformanceMode(),
      onboardingPhase: this.onboardingPhase,
    });
  }

  openLeaderboard() {
    this.state = GAME_STATES.MENU;
    this.waveManager.reset();
    this.slicedPieces = [];
    this.clearMenuVisuals();
    this.particles.clear();
    this.renderer.effects.clear();
    this.ui.showScreen('menu');
    this.menuManager.setStep('leaderboard');
    this.menuManager.setLeaderboardFilter(
      this.ui.getSelectedMode(),
      this.ui.getSelectedDifficulty()
    );
    this.refreshLeaderboardEntries();
    this.scheduleResize();
    if (!this.rafId) this.startLoop();
  }

  showLeaderboard() {
    this.openLeaderboard();
  }

  destroy() {
    this.stopLoop();
    this.releaseHandTracking();
    this.audio.stopMusic();
  }
}
