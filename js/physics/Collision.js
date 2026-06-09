import { CONFIG } from '../config.js';

/**
 * Collision detection between swipe blade path and circular fruit hitboxes.
 */
export class Collision {
  constructor() {
    this.padding = CONFIG.collision.hitboxPadding;
    this.minSegLen = CONFIG.collision.minSegmentLength;
    this.subdivisions = 3;
  }

  setPadding(padding) {
    this.padding = padding;
  }

  segmentHitsCircle(x1, y1, x2, y2, cx, cy, radius) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < this.minSegLen * this.minSegLen) return false;

    const r = radius + this.padding;
    const fx = cx - x1;
    const fy = cy - y1;
    let t = (fx * dx + fy * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;
    const distSq = (cx - nearestX) ** 2 + (cy - nearestY) ** 2;
    return distSq <= r * r;
  }

  /**
   * Subdivide trail segments so fast swipes don't skip fruits between frames.
   */
  findHits(trail, entities, velocityThreshold) {
    const hits = [];
    if (trail.length < 2) return hits;

    const steps = this.subdivisions;

    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const segVelocity = Math.max(a.velocity || 0, b.velocity || 0);
      if (segVelocity < velocityThreshold) continue;

      for (let s = 0; s < steps; s++) {
        const t1 = s / steps;
        const t2 = (s + 1) / steps;
        const x1 = a.x + (b.x - a.x) * t1;
        const y1 = a.y + (b.y - a.y) * t1;
        const x2 = a.x + (b.x - a.x) * t2;
        const y2 = a.y + (b.y - a.y) * t2;

        for (const entity of entities) {
          if (!entity.alive || entity.sliced) continue;
          if (this.segmentHitsCircle(x1, y1, x2, y2, entity.x, entity.y, entity.radius)) {
            hits.push({
              entity,
              segmentIndex: i,
              sliceAngle: Math.atan2(y2 - y1, x2 - x1),
              velocity: segVelocity,
            });
          }
        }
      }
    }
    return hits;
  }

  getSliceAngle(trail, segmentIndex) {
    if (segmentIndex < 1 || segmentIndex >= trail.length) return 0;
    const a = trail[segmentIndex - 1];
    const b = trail[segmentIndex];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
}
