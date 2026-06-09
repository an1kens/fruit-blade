import { CONFIG } from '../config.js';

/**
 * Simple 2D physics helpers for projectile motion and sliced debris.
 */
export class Physics {
  constructor() {
    this.gravity = CONFIG.physics.gravity;
    this.airDrag = CONFIG.physics.airDrag;
    this.groundY = 0;
    this.launchOptions = {};
  }

  setLaunchOptions(options = {}) {
    this.launchOptions = options;
  }

  setGroundY(y) {
    this.groundY = y;
  }

  update(body, dt) {
    body.vy += this.gravity * dt;
    body.vx *= this.airDrag;
    body.vy *= this.airDrag;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }

  isBelowGround(y, radius = 0) {
    return y - radius > this.groundY;
  }

  randomRotationSpeed() {
    const [min, max] = CONFIG.fruits.rotationSpeedRange;
    return min + Math.random() * (max - min);
  }

  /**
   * Pick a launch angle (degrees from +X axis) based on spawn position.
   * Left spawns tend up-right, right spawns tend up-left, centre picks either.
   * Angles deliberately avoid the near-vertical band so fruits arc across the screen.
   */
  pickLaunchAngle(x, canvasWidth, opts) {
    const centerX = canvasWidth * 0.5;
    const zone = canvasWidth * 0.28;

    const [rightMin, rightMax] = opts.angleUpRight ?? [40, 68];
    const [leftMin, leftMax] = opts.angleUpLeft ?? [112, 148];

    const upRight = rightMin + Math.random() * (rightMax - rightMin);
    const upLeft = leftMin + Math.random() * (leftMax - leftMin);

    if (x < centerX - zone) return upRight;
    if (x > centerX + zone) return upLeft;
    return Math.random() < 0.5 ? upRight : upLeft;
  }

  /**
   * Launch with a random angle + speed inside safe limits.
   *
   * No aim-at-point targeting — fruits follow natural arcs shaped only by:
   *   • launch angle band (never near-vertical)
   *   • minimum horizontal speed (prevents straight-up flight)
   *   • minimum peak height (minRiseRatio)
   *   • screen-edge clamps (won't fly off before apex)
   */
  randomLaunchParams(canvasWidth, canvasHeight, speedMultiplier = 1) {
    const opts = this.launchOptions;
    const margin = CONFIG.fruits.spawnMargin;
    const centerX = canvasWidth * 0.5;
    const g = this.gravity;

    // Spawn across most of the bottom edge
    const spawnSpread = canvasWidth * (opts.spawnSpread ?? 0.88);
    const x = centerX + (Math.random() - 0.5) * spawnSpread;
    const y = canvasHeight + CONFIG.fruits.defaultRadius;

    const minRiseRatio = opts.minRiseRatio ?? CONFIG.fruits.minRiseRatio ?? 0.46;
    const minRise = canvasHeight * minRiseRatio;
    const minVy = -Math.sqrt(2 * g * minRise);

    const [minSpd, maxSpd] = CONFIG.fruits.launchSpeedRange;
    const speed = (minSpd + Math.random() * (maxSpd - minSpd)) * speedMultiplier;

    const angleDeg = this.pickLaunchAngle(x, canvasWidth, opts);
    const rad = (angleDeg * Math.PI) / 180;

    let vx = Math.cos(rad) * speed;
    let vy = -Math.sin(rad) * speed;

    // ── Limit 1: minimum peak height ────────────────────────────────────
    const vyJitter = 0.96 + Math.random() * 0.1;
    if (vy > minVy) {
      vy = minVy * vyJitter;
    }

    // ── Limit 2: minimum horizontal speed (no straight-up launches) ───
    const minHoriz = opts.minHorizontalSpeed ?? CONFIG.fruits.minHorizontalSpeed;
    if (Math.abs(vx) < minHoriz) {
      vx = vx >= 0 ? minHoriz : -minHoriz;
    }

    const tApex = Math.abs(vy) / g;

    // ── Limit 3: stay on screen through apex ────────────────────────────
    const safeMargin = margin + CONFIG.fruits.defaultRadius;
    const maxVxRight = (canvasWidth - safeMargin - x) / tApex;
    const maxVxLeft = (-safeMargin - x) / tApex;
    vx = Math.max(maxVxLeft, Math.min(maxVxRight, vx));

    // ── Limit 4: cap excessive horizontal drift ─────────────────────────
    const maxHoriz = (canvasWidth * (opts.maxHorizontalDrift ?? 0.5)) / tApex;
    vx = Math.max(-maxHoriz, Math.min(maxHoriz, vx));

    // Re-apply minimum horizontal after clamps
    if (Math.abs(vx) < minHoriz * 0.6) {
      const sign = vx >= 0 ? 1 : -1;
      vx = sign * Math.min(minHoriz, maxHoriz, Math.abs(maxVxRight), Math.abs(maxVxLeft));
    }

    return { x, y, vx, vy, rotationSpeed: this.randomRotationSpeed() };
  }
}
