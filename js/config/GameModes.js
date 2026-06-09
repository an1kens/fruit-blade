/**
 * Classic / Arcade / Zen — Fruit Ninja-style mode rules (webcam only).
 */
export const GAME_MODES = {
  classic: {
    id: 'classic',
    label: 'Classic',
    description: '3 strikes — missing a fruit or slicing a bomb costs a life',
    livesOverride: 3,
    hasTimer: false,
    timerSeconds: 0,
    spawnBombs: true,
    missPenalty: true,
    bombOnSlice: 'strike',
    bombPointPenalty: 0,
    endsOnLives: true,
    endsOnTimer: false,
    showLives: true,
    waveBreaks: true,
    spawnIntervalMult: 1,
    maxActiveEntities: 14,
    powerUpChance: 0.02,
    spawnBaskets: true,
  },
  arcade: {
    id: 'arcade',
    label: 'Arcade',
    description: '60 seconds — rack up the highest score',
    livesOverride: null,
    hasTimer: true,
    timerSeconds: 60,
    spawnBombs: true,
    missPenalty: false,
    bombOnSlice: 'points',
    bombPointPenalty: 50,
    endsOnLives: false,
    endsOnTimer: true,
    showLives: false,
    waveBreaks: false,
    spawnIntervalMult: 0.88,
    maxActiveEntities: 14,
    arcadeRampSeconds: 30,
    arcadeRampMult: 1.12,
    powerUpChance: 0.05,
    spawnBaskets: true,
  },
  zen: {
    id: 'zen',
    label: 'Zen',
    description: 'No bombs, no lives — relax and slice',
    livesOverride: null,
    hasTimer: false,
    timerSeconds: 0,
    spawnBombs: false,
    missPenalty: false,
    bombOnSlice: 'none',
    bombPointPenalty: 0,
    endsOnLives: false,
    endsOnTimer: false,
    showLives: false,
    waveBreaks: false,
    spawnIntervalMult: 1.35,
    maxActiveEntities: 10,
    // Gentler, wider arcs for relaxed slicing
    spawnSpread: 0.96,
    maxHorizontalDrift: 0.62,
    angleUpRight: [36, 74],
    angleUpLeft: [106, 154],
    powerUpChance: 0,
    spawnBaskets: false,
  },
};

export const DEFAULT_GAME_MODE = 'classic';
export const GAME_MODE_STORAGE_KEY = 'fruitNinja_gameMode';

export function getGameMode(id) {
  return GAME_MODES[id] || GAME_MODES[DEFAULT_GAME_MODE];
}

export function loadSavedGameMode() {
  try {
    const saved = localStorage.getItem(GAME_MODE_STORAGE_KEY);
    if (saved && GAME_MODES[saved]) return saved;
  } catch { /* ignore */ }
  return DEFAULT_GAME_MODE;
}

export function saveGameMode(id) {
  localStorage.setItem(GAME_MODE_STORAGE_KEY, id);
}

/**
 * Hard difficulty: bombs are instant death (except Zen).
 */
export function resolveBombOnSlice(gameMode, difficulty) {
  if (!gameMode.spawnBombs) return 'none';
  if (difficulty.id === 'hard') return 'instant';
  return gameMode.bombOnSlice;
}
