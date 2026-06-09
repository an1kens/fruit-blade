import { CONFIG } from '../config.js';

/**
 * Manages juice splashes, splat sprites, sparks, and ambient particles with object pooling.
 */
export class ParticleSystem {
  constructor(assetLoader = null) {
    this.assetLoader = assetLoader;
    this.particles = [];
    this.max = CONFIG.particles.maxParticles;
  }

  setAssetLoader(assetLoader) {
    this.assetLoader = assetLoader;
  }

  /**
   * Burst of juice droplets at slice point (reduced count when splats are available).
   */
  spawnJuice(x, y, colors, sliceAngle, count = CONFIG.particles.juiceCount) {
    const splatCount = this.spawnSplats(x, y, sliceAngle, colors);
    const dropletCount = splatCount > 0 ? Math.max(6, Math.floor(count * 0.55)) : count;

    for (let i = 0; i < dropletCount; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const angle = sliceAngle + (Math.random() - 0.5) * Math.PI;
      const speed = 120 + Math.random() * 320;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        radius: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: 0.3 + Math.random() * 0.5,
        gravity: 600,
        type: 'juice',
      });
    }
  }

  /**
   * Spawn 1–2 fading splat sprites at the slice point.
   * @returns {number} splats spawned
   */
  spawnSplats(x, y, sliceAngle, colors = ['#ff5252']) {
    const loader = this.assetLoader;
    if (!loader?.isReady?.()) return 0;

    const count = 1 + Math.floor(Math.random() * 2);
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      const splatId = loader.pickSplatId?.();
      const img = splatId ? loader.getVfx(splatId) : null;
      if (!img) continue;

      if (this.particles.length >= this.max) this.particles.shift();

      const offset = (i - 0.5) * 18;
      const ox = Math.cos(sliceAngle + Math.PI / 2) * offset;
      const oy = Math.sin(sliceAngle + Math.PI / 2) * offset;

      this.particles.push({
        x: x + ox,
        y: y + oy,
        vx: 0,
        vy: 0,
        rotation: sliceAngle + (Math.random() - 0.5) * 0.8,
        scale: 0.55 + Math.random() * 0.35,
        img,
        tint: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: (CONFIG.particles.splashLifetime || 600) / 1000,
        gravity: 0,
        type: 'splat',
      });
      spawned += 1;
    }

    return spawned;
  }

  spawnExplosion(x, y, count = 40) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 400;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 8,
        color: i % 3 === 0 ? '#ffeb3b' : i % 3 === 1 ? '#ff5722' : '#212121',
        life: 0,
        maxLife: 0.4 + Math.random() * 0.6,
        gravity: 400,
        type: 'explosion',
      });
    }
  }

  spawnSparkle(x, y, color = '#fff59d') {
    for (let i = 0; i < 6; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (60 + Math.random() * 100),
        vy: Math.sin(angle) * (60 + Math.random() * 100),
        radius: 1 + Math.random() * 2,
        color,
        life: 0,
        maxLife: 0.2 + Math.random() * 0.3,
        gravity: 0,
        type: 'sparkle',
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;

      if (p.type === 'splat' && p.img) {
        const size = 72 * p.scale * (1 + (1 - alpha) * 0.15);
        ctx.save();
        ctx.globalAlpha = alpha * 0.92;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (p.tint) {
          ctx.filter = `drop-shadow(0 0 6px ${p.tint})`;
        }
        ctx.drawImage(p.img, -size / 2, -size / 2, size, size);
        ctx.restore();
        continue;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
  }

  clear() {
    this.particles = [];
  }
}
