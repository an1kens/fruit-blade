/**
 * Blade slice hit-testing for HTML elements marked data-sliceable.
 */
export class SliceHitTest {
  constructor(root = document) {
    this.root = root;
    this.lastHitIds = new Set();
  }

  getTargets() {
    return Array.from(this.root.querySelectorAll('[data-sliceable]'));
  }

  /**
   * Test blade trails against sliceable elements.
   * @returns {HTMLElement[]} newly hit elements this frame
   */
  testTrails(trails, threshold) {
    const hits = [];
    const hitIds = new Set();

    for (const trail of trails) {
      if (trail.length < 2) continue;
      const tip = trail[trail.length - 1];
      const prev = trail[trail.length - 2];
      if ((tip.velocity || 0) < threshold) continue;

      const dx = tip.x - prev.x;
      const dy = tip.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 4) continue;

      for (const el of this.getTargets()) {
        if (!this.isTargetVisible(el)) continue;
        const id = el.id || el.dataset.sliceable;
        if (hitIds.has(id)) continue;

        const rect = el.getBoundingClientRect();
        if (this.segmentIntersectsRect(prev.x, prev.y, tip.x, tip.y, rect)) {
          hitIds.add(id);
          hits.push(el);
        }
      }
    }

    this.lastHitIds = hitIds;
    return hits;
  }

  isTargetVisible(el) {
    if (el.closest('#boot-loader:not(.hidden), .overlay.active, .screen.active, #screen-menu.active')) {
      return true;
    }
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
  }

  segmentIntersectsRect(x1, y1, x2, y2, rect) {
    if (this.pointInRect(x1, y1, rect) || this.pointInRect(x2, y2, rect)) return true;

    const left = rect.left;
    const right = rect.right;
    const top = rect.top;
    const bottom = rect.bottom;

    return (
      this.segmentsIntersect(x1, y1, x2, y2, left, top, right, top) ||
      this.segmentsIntersect(x1, y1, x2, y2, right, top, right, bottom) ||
      this.segmentsIntersect(x1, y1, x2, y2, right, bottom, left, bottom) ||
      this.segmentsIntersect(x1, y1, x2, y2, left, bottom, left, top)
    );
  }

  pointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const det = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (Math.abs(det) < 1e-9) return false;
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / det;
    const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / det;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  reset() {
    this.lastHitIds.clear();
  }
}
