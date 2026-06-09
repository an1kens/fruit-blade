/**
 * Easy / Medium / Hard presets — tuned for feel, not just numeric scaling.
 */
export const DIFFICULTY_MODES = {
  easy: {
    id: 'easy',
    label: 'Easy',
    startingLives: 5,
    sliceVelocityThreshold: 900,
    speedMultiplierBase: 0.82,
    speedMultiplierPerWave: 0.035,
    baseSpawnInterval: 1650,
    minSpawnInterval: 650,
    baseFruitsPerWave: 2,
    maxFruitsPerWave: 7,
    bombChanceBase: 0.03,
    bombChanceMax: 0.08,
    waveBreakMs: 1500,
    spawnSpread: 0.82,
    minRiseRatio: 0.50,
    minHorizontalSpeed: 170,
    maxHorizontalDrift: 0.45,
    angleUpRight: [42, 65],
    angleUpLeft: [115, 145],
    scoreMultiplier: 0.85,
    hitboxPadding: 12,
    modelComplexity: 0,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    startingLives: 3,
    sliceVelocityThreshold: 1200,
    speedMultiplierBase: 1,
    speedMultiplierPerWave: 0.06,
    baseSpawnInterval: 1400,
    minSpawnInterval: 450,
    baseFruitsPerWave: 3,
    maxFruitsPerWave: 12,
    bombChanceBase: 0.08,
    bombChanceMax: 0.18,
    waveBreakMs: 1200,
    spawnSpread: 0.88,
    minRiseRatio: 0.46,
    minHorizontalSpeed: 200,
    maxHorizontalDrift: 0.5,
    angleUpRight: [40, 68],
    angleUpLeft: [112, 148],
    scoreMultiplier: 1,
    hitboxPadding: 8,
    modelComplexity: 1,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    startingLives: 2,
    sliceVelocityThreshold: 1550,
    speedMultiplierBase: 1.18,
    speedMultiplierPerWave: 0.085,
    baseSpawnInterval: 1050,
    minSpawnInterval: 320,
    baseFruitsPerWave: 4,
    maxFruitsPerWave: 14,
    bombChanceBase: 0.13,
    bombChanceMax: 0.24,
    waveBreakMs: 850,
    spawnSpread: 0.92,
    minRiseRatio: 0.42,
    minHorizontalSpeed: 240,
    maxHorizontalDrift: 0.55,
    angleUpRight: [38, 72],
    angleUpLeft: [108, 152],
    scoreMultiplier: 1.3,
    hitboxPadding: 6,
    modelComplexity: 1,
  },
};

export const DEFAULT_DIFFICULTY = 'medium';
export const DIFFICULTY_STORAGE_KEY = 'fruitNinja_difficulty';

export function getDifficulty(id) {
  return DIFFICULTY_MODES[id] || DIFFICULTY_MODES[DEFAULT_DIFFICULTY];
}

export function loadSavedDifficulty() {
  try {
    const saved = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    if (saved && DIFFICULTY_MODES[saved]) return saved;
  } catch { /* ignore */ }
  return DEFAULT_DIFFICULTY;
}

export function saveDifficulty(id) {
  localStorage.setItem(DIFFICULTY_STORAGE_KEY, id);
}
