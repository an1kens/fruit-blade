import { getFruitDef } from './FruitTypes.js';

let nextId = 1;

/**
 * Active fruit entity with physics state and slice metadata.
 */
export class Fruit {
  /**
   * @param {string} type
   * @param {object} launch - { x, y, vx, vy, rotationSpeed }
   */
  constructor(type, launch) {
    this.id = nextId++;
    this.type = type;
    this.def = getFruitDef(type);
    this.radius = this.def.radius;
    this.x = launch.x;
    this.y = launch.y;
    this.vx = launch.vx;
    this.vy = launch.vy;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = launch.rotationSpeed;
    this.alive = true;
    this.sliced = false;
    this.isBomb = false;
    this.spawnTime = performance.now();
  }

  update(dt, physics) {
    if (!this.alive) return;
    physics.update(this, dt);
    this.rotation += this.rotationSpeed * dt;
  }
}
