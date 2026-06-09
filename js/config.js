/**
 * Global game configuration and tuning constants.
 * Adjust these values to balance difficulty, feel, and performance.
 */
export const CONFIG = {
  canvas: {
    targetFPS: 60,
    maxDeltaMs: 50,
  },

  physics: {
    gravity: 980,
    airDrag: 0.998,
    groundY: 0, // set at runtime from canvas height
  },

  handTracking: {
    // Minimum fingertip speed (px/s) required to register a slice
    sliceVelocityThreshold: 1200,
    // Number of frames to keep in the blade trail
    trailLength: 32,
    // Max age of trail points in ms
    trailMaxAge: 220,
    // Blade landmarks per hand: index (8) + middle (12) finger tips
    bladeLandmarks: [8, 12],
    // Rolling average window for velocity smoothing
    velocitySmoothWindow: 3,
    // Lower slice threshold for first N ms after game start
    sliceGraceDurationMs: 10000,
    sliceGraceMultiplier: 0.8,
    // MediaPipe model complexity: 0 = lite (fast), 1 = full (heavy)
    modelComplexity: 0,
    // Camera capture — independent of ML model (720p keeps the feed sharp on screen)
    cameraIdealWidth: 1280,
    cameraIdealHeight: 720,
    cameraMinWidth: 640,
    cameraMinHeight: 480,
    // Max hands to track (1 or 2)
    maxHands: 2,
    // Confidence thresholds
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
    // Calibration: seconds to hold hand in frame
    calibrationDuration: 2000,
    /** Auto-complete calibration when hand bbox covers this much of the frame */
    calibrationBBoxMinRatio: 0.15,
    /** Below this — prompt user to move closer */
    calibrationBBoxTooSmall: 0.08,
    /** Above this — prompt user to move back */
    calibrationBBoxTooLarge: 0.38,
    /** Min velocity to show "too slow" hint (px/s) — overridden by near-miss band in Game.js */
    tooSlowMinVelocity: 180,
    tooSlowHintCooldownMs: 7000,
    /** Show hint only when speed is this fraction of slice threshold (near miss) */
    tooSlowNearMissMin: 0.58,
    tooSlowNearMissMax: 0.9,
    // Fist gate: blade off when index + middle fingertips are curled
    fistCurledRatio: 0.92,
  },

  collision: {
    // Extra radius added to fruit hitbox for forgiving slices
    hitboxPadding: 8,
    // Minimum segment length to test (avoids micro-jitter)
    minSegmentLength: 4,
  },

  powerUps: {
    freezeDuration: 5,
    frenzyDuration: 6,
    doubleDuration: 8,
    freezeTimeScale: 0.35,
    frenzyScoreMult: 1.5,
    doubleScoreMult: 2,
    frenzyBurstMin: 8,
    frenzyBurstMax: 12,
    frenzyBurstIntervalMs: 90,
  },

  baskets: {
    minWavesBetween: 4,
    maxWavesBetween: 6,
    minFruits: 4,
    maxFruits: 6,
  },

  comboMilestones: [
    { count: 3, text: 'Combo!', shake: 0 },
    { count: 5, text: 'Great!', shake: 4, pulse: true },
    { count: 8, text: 'Amazing!', shake: 5, sparkle: true },
    { count: 10, text: 'Blade Master!', shake: 8, sparkle: true },
  ],

  gameplay: {
    startingLives: 3,
    maxLives: 5,
    comboWindowMs: 450,
    swipeBonusPerFruit: 5,
    maxActiveEntities: 14,
    arcadeSliceBonusPerFruit: 2,
    arcadeTimeBonusPerSecond: 10,
    comboMultiplierStep: 0.5,
    maxComboMultiplier: 5,
    criticalChance: 0.12,
    criticalMultiplier: 2,
    bombChanceBase: 0.08,
    bombChanceMax: 0.18,
    missPenaltyLife: true,
    scorePerFruit: 10,
    waveBreakMs: 1200,
  },

  waves: {
    baseSpawnInterval: 1400,
    minSpawnInterval: 450,
    baseFruitsPerWave: 3,
    maxFruitsPerWave: 12,
    difficultyScalePerWave: 0.08,
    speedMultiplierBase: 1,
    speedMultiplierPerWave: 0.06,
  },

  fruits: {
    defaultRadius: 42,
    rotationSpeedRange: [-4, 4],
    launchSpeedRange: [680, 1050],
    spawnMargin: 80,
    // Minimum rise as fraction of screen height — every fruit MUST reach at least this high
    minRiseRatio: 0.46,
    // Minimum horizontal speed (px/s) — prevents near-vertical launches
    minHorizontalSpeed: 200,
    // Default launch angle bands (degrees from +X): up-right and up-left
    angleUpRight: [40, 68],
    angleUpLeft: [112, 148],
    // Max horizontal drift as fraction of screen width during ascent
    maxHorizontalDrift: 0.5,
  },

  particles: {
    maxParticles: 400,
    juiceCount: 10,
    splashLifetime: 600,
  },

  effects: {
    screenShakeDuration: 200,
    screenShakeIntensity: 8,
    floatingScoreDuration: 900,
    motionBlurAlpha: 0.15,
    // Light overlay on webcam bg so fruits/HUD stay readable
    webcamOverlayAlpha: 0.12,
    webcamVignetteAlpha: 0.35,
  },

  performance: {
    maxDpr: 1.25,
    maxDprNormal: 2,
    menuDetectIntervalMs: 66,
    playingDetectIntervalMs: 33,
    pausedDetectIntervalMs: 120,
    maxHands: 1,
    trailLength: 24,
  },

  audio: {
    defaultMusicVolume: 0.35,
    defaultSfxVolume: 0.7,
    storageKey: 'fruitBlade_audio',
  },

  storage: {
    highScoreKey: 'fruitBlade_highScores',
    statsKey: 'fruitBlade_stats',
    dailyChallengeKey: 'fruitBlade_daily',
    tutorialKey: 'fruitBlade_tutorialDone',
    maxEntriesPerBucket: 10,
  },

  retention: {
    dailyGoals: { arcade: 30, classic: 20, zen: 40 },
    bladeSkins: [
      { id: 'gold', label: 'Golden', color: '#FFE566', tip: '#FFF8E7', unlockAt: 0 },
      { id: 'sakura', label: 'Sakura', color: '#FF80AB', tip: '#FFE4EC', unlockAt: 200 },
      { id: 'matcha', label: 'Matcha', color: '#A8E06C', tip: '#E8F5E9', unlockAt: 500 },
    ],
  },
};

export const FRUIT_TYPES = [
  'apple', 'banana', 'orange', 'watermelon', 'pineapple',
  'strawberry', 'mango', 'kiwi', 'coconut', 'peach',
];

export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  LEADERBOARD: 'leaderboard',
};
