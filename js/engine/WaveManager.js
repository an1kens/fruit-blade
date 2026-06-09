import { CONFIG } from '../config.js';
import { getDifficulty } from '../config/Difficulty.js';
import { getGameMode } from '../config/GameModes.js';
import { Fruit } from '../entities/Fruit.js';
import { Bomb } from '../entities/Bomb.js';
import { PowerUpBanana } from '../entities/PowerUpBanana.js';
import { getRandomFruitType } from '../entities/FruitTypes.js';

/**
 * Controls fruit/bomb/power-up spawning in waves with progressive difficulty.
 */
export class WaveManager {
  constructor(physics) {
    this.physics = physics;
    this.difficulty = getDifficulty();
    this.gameMode = getGameMode();
    this.wave = 1;
    this.fruitsSpawned = 0;
    this.fruitsToSpawn = this.difficulty.baseFruitsPerWave;
    this.spawnTimer = 0;
    this.waveBreakTimer = 0;
    this.inWaveBreak = false;
    this.entities = [];
    this.gameElapsed = 0;
    this.wavesSinceBasket = 0;
    this.nextBasketWave = this.rollBasketInterval();
    this.pendingBasket = false;
    this.frenzySpawnRemaining = 0;
    this.frenzySpawnTimer = 0;
    this.spawnQueue = [];
  }

  rollBasketInterval() {
    const { minWavesBetween, maxWavesBetween } = CONFIG.baskets;
    return minWavesBetween + Math.floor(Math.random() * (maxWavesBetween - minWavesBetween + 1));
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    this.refreshLaunchOptions();
  }

  setGameMode(gameMode) {
    this.gameMode = gameMode;
    this.refreshLaunchOptions();
  }

  refreshLaunchOptions() {
    const d = this.difficulty;
    const m = this.gameMode;
    this.physics.setLaunchOptions({
      spawnSpread: m.spawnSpread ?? d.spawnSpread,
      minRiseRatio: m.minRiseRatio ?? d.minRiseRatio,
      minHorizontalSpeed: m.minHorizontalSpeed ?? d.minHorizontalSpeed,
      maxHorizontalDrift: m.maxHorizontalDrift ?? d.maxHorizontalDrift,
      angleUpRight: m.angleUpRight ?? d.angleUpRight,
      angleUpLeft: m.angleUpLeft ?? d.angleUpLeft,
    });
  }

  reset() {
    this.wave = 1;
    this.fruitsSpawned = 0;
    this.fruitsToSpawn = this.getFruitsPerWave();
    this.spawnTimer = 0;
    this.waveBreakTimer = 0;
    this.inWaveBreak = false;
    this.entities = [];
    this.gameElapsed = 0;
    this.wavesSinceBasket = 0;
    this.nextBasketWave = this.rollBasketInterval();
    this.pendingBasket = false;
    this.frenzySpawnRemaining = 0;
    this.frenzySpawnTimer = 0;
    this.spawnQueue = [];
  }

  enqueueSpawn(options = {}) {
    if (this.spawnQueue.length >= 24) return;
    this.spawnQueue.push(options);
  }

  flushSpawnQueue(canvasWidth, canvasHeight, maxEntities) {
    while (this.spawnQueue.length > 0 && this.getActiveCount() < maxEntities) {
      const opts = this.spawnQueue.shift();
      const entity = this.spawnEntity(canvasWidth, canvasHeight, opts);
      if (entity) {
        this.entities.push(entity);
        this.fruitsSpawned++;
      }
    }
  }

  getActiveCount() {
    return this.entities.filter((e) => e.alive && !e.sliced).length;
  }

  getSpeedMultiplier() {
    let mult =
      this.difficulty.speedMultiplierBase +
      (this.wave - 1) * this.difficulty.speedMultiplierPerWave;

    if (
      this.gameMode.id === 'arcade' &&
      this.gameElapsed < (this.gameMode.arcadeRampSeconds || 30)
    ) {
      mult *= this.gameMode.arcadeRampMult || 1.1;
    }
    return mult;
  }

  getSpawnInterval() {
    const reduction = this.gameMode.waveBreaks ? (this.wave - 1) * 80 : this.wave * 40;
    const base = Math.max(
      this.difficulty.minSpawnInterval,
      this.difficulty.baseSpawnInterval - reduction
    );
    return base * (this.gameMode.spawnIntervalMult || 1);
  }

  getBombChance() {
    if (!this.gameMode.spawnBombs) return 0;
    return Math.min(
      this.difficulty.bombChanceMax,
      this.difficulty.bombChanceBase + this.wave * 0.01
    );
  }

  getPowerUpChance() {
    return this.gameMode.powerUpChance || 0;
  }

  getFruitsPerWave() {
    if (!this.gameMode.waveBreaks) {
      return this.difficulty.baseFruitsPerWave + Math.floor(this.wave * 0.5);
    }
    return Math.min(
      this.difficulty.maxFruitsPerWave,
      this.difficulty.baseFruitsPerWave + Math.floor(this.wave * 0.8)
    );
  }

  queueFrenzyBurst() {
    const { frenzyBurstMin, frenzyBurstMax } = CONFIG.powerUps;
    this.frenzySpawnRemaining =
      frenzyBurstMin + Math.floor(Math.random() * (frenzyBurstMax - frenzyBurstMin + 1));
    this.frenzySpawnTimer = 0;
  }

  updateFrenzyBurst(dt, canvasWidth, canvasHeight) {
    if (this.frenzySpawnRemaining <= 0) return;

    this.frenzySpawnTimer -= dt * 1000;
    if (this.frenzySpawnTimer > 0) return;

    this.frenzySpawnTimer = CONFIG.powerUps.frenzyBurstIntervalMs;
    const entity = this.spawnEntity(canvasWidth, canvasHeight, {
      forceFruit: true,
      frenzySpawn: true,
    });
    if (entity) {
      this.entities.push(entity);
      this.frenzySpawnRemaining--;
    }
  }

  maybeScheduleBasket() {
    if (!this.gameMode.spawnBaskets) return;

    this.wavesSinceBasket++;
    if (this.wavesSinceBasket >= this.nextBasketWave) {
      this.pendingBasket = true;
      this.wavesSinceBasket = 0;
      this.nextBasketWave = this.rollBasketInterval();
    }
  }

  spawnBasket(canvasWidth, canvasHeight) {
    const { minFruits, maxFruits } = CONFIG.baskets;
    const count = minFruits + Math.floor(Math.random() * (maxFruits - minFruits + 1));
    const speedMult = this.getSpeedMultiplier() * 0.95;
    const baseLaunch = this.physics.randomLaunchParams(canvasWidth, canvasHeight, speedMult);
    const centerX = canvasWidth * 0.5;
    const spread = canvasWidth * 0.38;

    for (let i = 0; i < count; i++) {
      if (this.getActiveCount() >= (this.gameMode.maxActiveEntities || CONFIG.gameplay.maxActiveEntities)) {
        break;
      }

      const t = count === 1 ? 0.5 : i / (count - 1);
      const launch = {
        ...baseLaunch,
        x: centerX + (t - 0.5) * spread,
        vx: baseLaunch.vx + (t - 0.5) * 200,
        vy: baseLaunch.vy * (0.97 + Math.random() * 0.05),
        rotationSpeed: baseLaunch.rotationSpeed * (0.8 + Math.random() * 0.4),
      };
      this.entities.push(new Fruit(getRandomFruitType(), launch));
    }
  }

  update(dt, canvasWidth, canvasHeight) {
    this.gameElapsed += dt;
    const maxEntities = this.gameMode.maxActiveEntities || CONFIG.gameplay.maxActiveEntities;

    this.updateFrenzyBurst(dt, canvasWidth, canvasHeight);
    this.flushSpawnQueue(canvasWidth, canvasHeight, maxEntities);

    if (this.getActiveCount() >= maxEntities) {
      return null;
    }

    if (this.gameMode.waveBreaks && this.inWaveBreak) {
      this.waveBreakTimer -= dt * 1000;
        if (this.waveBreakTimer <= 0) {
        this.inWaveBreak = false;
        this.fruitsSpawned = 0;
        this.fruitsToSpawn = this.getFruitsPerWave();
        this.spawnTimer = 0;
        if (this.pendingBasket) {
          this.spawnBasket(canvasWidth, canvasHeight);
          this.pendingBasket = false;
        }
        this.flushSpawnQueue(canvasWidth, canvasHeight, maxEntities);
      }
      return null;
    }

    this.spawnTimer -= dt * 1000;
    if (this.spawnTimer <= 0) {
      const limit = this.gameMode.waveBreaks
        ? this.fruitsToSpawn
        : Infinity;

      if (this.fruitsSpawned < limit || !this.gameMode.waveBreaks) {
        this.spawnTimer = this.getSpawnInterval();
        const entity = this.spawnEntity(canvasWidth, canvasHeight);
        if (entity) {
          this.entities.push(entity);
          this.fruitsSpawned++;

          if (this.gameMode.waveBreaks && this.fruitsSpawned >= this.fruitsToSpawn) {
            this.startWaveBreak();
          } else if (!this.gameMode.waveBreaks) {
            const prevWave = this.wave;
            this.wave = 1 + Math.floor(this.gameElapsed / 25);
            if (this.wave > prevWave) {
              this.maybeScheduleBasket();
              if (this.pendingBasket) {
                this.spawnBasket(canvasWidth, canvasHeight);
                this.pendingBasket = false;
              }
            }
          }
        } else if (this.getActiveCount() >= maxEntities) {
          this.enqueueSpawn({});
        }
        return entity;
      }
    }
    return null;
  }

  spawnEntity(canvasWidth, canvasHeight, options = {}) {
    const maxEntities = this.gameMode.maxActiveEntities || CONFIG.gameplay.maxActiveEntities;
    const bypassCap = options.frenzySpawn === true;
    if (!bypassCap && this.getActiveCount() >= maxEntities) {
      return null;
    }

    const launch = this.physics.randomLaunchParams(
      canvasWidth,
      canvasHeight,
      this.getSpeedMultiplier()
    );

    if (!options.forceFruit && this.gameMode.spawnBombs && Math.random() < this.getBombChance()) {
      return new Bomb(launch);
    }

    if (!options.forceFruit && this.getPowerUpChance() > 0 && Math.random() < this.getPowerUpChance()) {
      return new PowerUpBanana(PowerUpBanana.randomType(), launch);
    }

    return new Fruit(getRandomFruitType(), launch);
  }

  startWaveBreak() {
    this.inWaveBreak = true;
    this.waveBreakTimer = this.difficulty.waveBreakMs;
    this.wave++;
    this.maybeScheduleBasket();
  }

  onEntityRemoved(canvasWidth, canvasHeight) {
    const maxEntities = this.gameMode.maxActiveEntities || CONFIG.gameplay.maxActiveEntities;
    this.flushSpawnQueue(canvasWidth, canvasHeight, maxEntities);
  }

  getActiveFruits() {
    return this.entities.filter((e) => e.alive && !e.sliced);
  }

  removeDead() {
    this.entities = this.entities.filter((e) => e.alive || e.sliced);
  }
}
