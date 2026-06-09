let pieceId = 1;

/**
 * Half of a sliced fruit — flies apart with rotation and fades out.
 */
export class SlicedPiece {
  constructor(fruit, side, sliceAngle) {
    this.id = pieceId++;
    this.fruitType = fruit.type;
    this.def = fruit.def;
    this.side = side; // 'left' | 'right'
    this.x = fruit.x;
    this.y = fruit.y;
    this.rotation = fruit.rotation;
    this.rotationSpeed = fruit.rotationSpeed * (side === 'left' ? 1.5 : -1.5);
    this.radius = fruit.radius;
    this.sliceAngle = sliceAngle;
    this.alpha = 1;
    this.alive = true;

    const push = 280;
    const perp = sliceAngle + (side === 'left' ? -Math.PI / 2 : Math.PI / 2);
    this.vx = fruit.vx + Math.cos(perp) * push;
    this.vy = fruit.vy + Math.sin(perp) * push - 120;
    this.lifetime = 0;
    this.maxLifetime = 1.2;
  }

  update(dt, physics) {
    if (!this.alive) return;
    physics.update(this, dt);
    this.rotation += this.rotationSpeed * dt;
    this.lifetime += dt;
    this.alpha = Math.max(0, 1 - this.lifetime / this.maxLifetime);
    if (this.lifetime >= this.maxLifetime) this.alive = false;
  }
}
