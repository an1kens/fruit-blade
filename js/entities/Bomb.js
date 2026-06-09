import { Fruit } from './Fruit.js';

/**
 * Bomb entity — inherits fruit physics but triggers game over on slice.
 */
export class Bomb extends Fruit {
  constructor(launch) {
    super('apple', launch);
    this.type = 'bomb';
    this.isBomb = true;
    this.radius = 36;
    this.fusePhase = Math.random() * Math.PI * 2;
  }

  update(dt, physics) {
    super.update(dt, physics);
    this.fusePhase += dt * 8;
  }
}
