import { Fruit } from './Fruit.js';

const POWER_TYPES = ['freeze', 'frenzy', 'double'];

/**
 * Sliceable power-up banana — activates an effect on slice.
 */
export class PowerUpBanana extends Fruit {
  constructor(powerType, launch) {
    super('banana', launch);
    this.powerType = POWER_TYPES.includes(powerType)
      ? powerType
      : POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
    this.isPowerUp = true;
    this.isBomb = false;
    this.radius = 38;
    this.glowPhase = Math.random() * Math.PI * 2;
  }

  update(dt, physics) {
    super.update(dt, physics);
    this.glowPhase += dt * 5;
  }

  static randomType() {
    return POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  }
}
