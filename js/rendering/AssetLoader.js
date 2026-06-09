import { FRUIT_TYPES } from '../config.js';

const MANIFEST = {
  fruits: [...FRUIT_TYPES, 'bomb'],
  vfx: ['splat-1', 'splat-2', 'splat-3', 'splat-4', 'flesh-edge'],
  powerups: ['freeze', 'frenzy', 'double'],
  icons: ['heart', 'timer', 'combo', 'bomb', 'pause', 'music', 'sfx', 'settings', 'hand'],
};

const BASE_PATHS = {
  fruits: 'assets/fruits',
  vfx: 'assets/vfx',
  powerups: 'assets/powerups',
  icons: 'assets/icons',
};

/**
 * Preloads fruit, VFX, power-up, and HUD sprites.
 * Falls back to procedural rendering when a file is missing.
 */
export class AssetLoader {
  constructor(basePaths = BASE_PATHS) {
    this.basePaths = basePaths;
    this.images = new Map();
    this.failed = new Set();
    this.loaded = false;
    this.progress = 0;
    this.total = 0;
    this.loadedCount = 0;
  }

  key(category, id) {
    return `${category}:${id}`;
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });
  }

  async loadAll() {
    const tasks = [];
    for (const [category, ids] of Object.entries(MANIFEST)) {
      const base = this.basePaths[category];
      for (const id of ids) {
        tasks.push({ category, id, src: `${base}/${id}.svg` });
      }
    }

    this.total = tasks.length;
    this.loadedCount = 0;
    this.progress = 0;

    await Promise.all(
      tasks.map(async ({ category, id, src }) => {
        const mapKey = this.key(category, id);
        try {
          const img = await this.loadImage(src);
          this.images.set(mapKey, img);
        } catch {
          this.failed.add(mapKey);
        } finally {
          this.loadedCount += 1;
          this.progress = this.loadedCount / this.total;
        }
      })
    );

    this.loaded = true;
    return {
      loaded: this.images.size,
      failed: [...this.failed],
      total: this.total,
    };
  }

  has(category, id) {
    const mapKey = this.key(category, id);
    return this.images.has(mapKey) && !this.failed.has(mapKey);
  }

  get(category, id) {
    if (arguments.length === 1) {
      return this.has('fruits', category) ? this.images.get(this.key('fruits', category)) : null;
    }
    return this.has(category, id) ? this.images.get(this.key(category, id)) : null;
  }

  getFruit(id) {
    return this.get('fruits', id);
  }

  getVfx(id) {
    return this.get('vfx', id);
  }

  getPowerUp(id) {
    return this.get('powerups', id);
  }

  getIcon(id) {
    return this.get('icons', id);
  }

  getProgress() {
    return this.progress;
  }

  isReady() {
    return this.loaded;
  }

  /** Random juice splat sprite id that loaded successfully. */
  pickSplatId() {
    const ids = MANIFEST.vfx.filter((id) => id.startsWith('splat-') && this.has('vfx', id));
    if (!ids.length) return null;
    return ids[Math.floor(Math.random() * ids.length)];
  }
}
