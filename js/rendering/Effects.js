import { CONFIG } from '../config.js';

/**
 * Screen shake, floating scores, motion blur, and dynamic background.
 */
export class Effects {
  constructor() {
    this.shake = { active: false, time: 0, intensity: 0 };
    this.floatingScores = [];
    this.milestoneBanner = null;
    this.milestoneQueue = [];
    this.screenPulse = 0;
    this.bgPhase = 0;
    this._gradientCache = null;
  }

  invalidateGradientCache() {
    this._gradientCache = null;
  }

  _getGradientCache(width, height) {
    if (this._gradientCache?.width === width && this._gradientCache?.height === height) {
      return this._gradientCache;
    }

    const menuScrim = (() => {
      const grad = { stops: [[0, 'rgba(20, 18, 32, 0.55)'], [0.35, 'rgba(20, 18, 32, 0.42)'], [0.7, 'rgba(20, 18, 32, 0.58)'], [1, 'rgba(20, 18, 32, 0.78)']] };
      return grad;
    })();

    const vignette = {
      cx: width / 2,
      cy: height / 2,
      inner: height * 0.25,
      outer: height * 0.85,
      alpha: CONFIG.effects.webcamVignetteAlpha,
    };

    this._gradientCache = { width, height, menuScrim, vignette };
    return this._gradientCache;
  }

  triggerShake(intensity = CONFIG.effects.screenShakeIntensity) {
    this.shake = {
      active: true,
      time: CONFIG.effects.screenShakeDuration,
      intensity,
    };
  }

  showMilestoneBanner(text, duration = 1200, color = '#ffeb3b') {
    const banner = { text, color, life: 0, maxLife: duration };
    if (this.milestoneBanner) {
      this.milestoneQueue.push(banner);
    } else {
      this.milestoneBanner = banner;
    }
  }

  triggerScreenPulse(strength = 0.12) {
    this.screenPulse = Math.max(this.screenPulse, strength);
  }

  addFloatingScore(x, y, text, color = '#fff59d', scale = 1) {
    this.floatingScores.push({
      x,
      y,
      text,
      color,
      scale,
      life: 0,
      maxLife: CONFIG.effects.floatingScoreDuration,
      vy: -80,
    });
  }

  update(dt) {
    this.bgPhase += dt * 0.3;

    if (this.shake.active) {
      this.shake.time -= dt * 1000;
      if (this.shake.time <= 0) this.shake.active = false;
    }

    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const s = this.floatingScores[i];
      s.life += dt * 1000;
      s.y += s.vy * dt;
      if (s.life >= s.maxLife) this.floatingScores.splice(i, 1);
    }

    if (this.milestoneBanner) {
      this.milestoneBanner.life += dt * 1000;
      if (this.milestoneBanner.life >= this.milestoneBanner.maxLife) {
        this.milestoneBanner = this.milestoneQueue.shift() || null;
      }
    }

    if (this.screenPulse > 0) {
      this.screenPulse = Math.max(0, this.screenPulse - dt * 1.8);
    }
  }

  getShakeOffset() {
    if (!this.shake.active) return { x: 0, y: 0 };
    const t = this.shake.time / CONFIG.effects.screenShakeDuration;
    const i = this.shake.intensity * t;
    return {
      x: (Math.random() - 0.5) * i * 2,
      y: (Math.random() - 0.5) * i * 2,
    };
  }

  /**
   * Live mirrored webcam as full-screen background (object-fit: cover).
   * Falls back to the gradient if the video stream isn't ready yet.
   */
  drawWebcamBackground(ctx, video, width, height, mirror = true, vignette = true) {
    if (!video || video.readyState < 2 || !video.videoWidth) {
      this.drawBackground(ctx, width, height);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(width / vw, height / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, dx, dy, dw, dh);
    } else {
      ctx.drawImage(video, dx, dy, dw, dh);
    }
    ctx.restore();

    // Subtle dim so fruits and HUD pop against the live feed
    ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.effects.webcamOverlayAlpha})`;
    ctx.fillRect(0, 0, width, height);

    // Edge vignette (gradient params cached; only recreated on resize)
    if (vignette) {
      const cache = this._getGradientCache(width, height);
      const vignetteGrad = ctx.createRadialGradient(
        cache.vignette.cx, cache.vignette.cy, cache.vignette.inner,
        cache.vignette.cx, cache.vignette.cy, cache.vignette.outer
      );
      vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vignetteGrad.addColorStop(1, `rgba(0,0,0,${cache.vignette.alpha})`);
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  /** Full-bleed vertical scrim for menu readability over any webcam feed. */
  drawMenuScrim(ctx, width, height) {
    const cache = this._getGradientCache(width, height);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    for (const [stop, color] of cache.menuScrim.stops) {
      grad.addColorStop(stop, color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  drawBackground(ctx, width, height) {
    const phase = this.bgPhase;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, `hsl(${220 + Math.sin(phase) * 10}, 45%, 18%)`);
    grad.addColorStop(0.5, `hsl(${260 + Math.cos(phase * 0.7) * 8}, 40%, 12%)`);
    grad.addColorStop(1, `hsl(${200 + Math.sin(phase * 0.5) * 6}, 35%, 8%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Ambient light rays
    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 5; i++) {
      const x = width * (0.2 + i * 0.15) + Math.sin(phase + i) * 40;
      const rayGrad = ctx.createLinearGradient(x, 0, x + 60, height);
      rayGrad.addColorStop(0, '#fff');
      rayGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = rayGrad;
      ctx.fillRect(x - 30, 0, 60, height);
    }
    ctx.restore();

    // Wood cutting board surface at bottom
    const boardH = 60;
    const boardGrad = ctx.createLinearGradient(0, height - boardH, 0, height);
    boardGrad.addColorStop(0, '#5d4037');
    boardGrad.addColorStop(1, '#3e2723');
    ctx.fillStyle = boardGrad;
    ctx.fillRect(0, height - boardH, width, boardH);

    // Wood grain lines
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = height - boardH + i * 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + 2);
      ctx.stroke();
    }
  }

  drawScreenPulse(ctx, width, height) {
    if (this.screenPulse <= 0) return;
    ctx.save();
    ctx.fillStyle = `rgba(255, 235, 59, ${this.screenPulse * 0.35})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  drawMilestoneBanner(ctx, width, height) {
    const banner = this.milestoneBanner;
    if (!banner) return;

    const t = banner.life / banner.maxLife;
    const alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
    const scale = 1 + (1 - Math.min(1, t * 2)) * 0.25;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = banner.color;
    ctx.font = `bold ${Math.round(52 * scale)}px "Segoe UI", sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 12;
    ctx.fillText(banner.text, width / 2, height * 0.38);
    ctx.restore();
  }

  drawFloatingScores(ctx) {
    for (const s of this.floatingScores) {
      const alpha = 1 - s.life / s.maxLife;
      const scale = s.scale * (1 + (1 - alpha) * 0.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.font = `bold ${24 * scale}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(s.text, s.x, s.y);
      ctx.restore();
    }
  }

  /**
   * Glowing sword trail following hand movement.
   * @param {object|null} bladeSkin - { color, tip } from PlayerStatsStore
   */
  drawBladeTrail(ctx, trails, bladeSkin = null, { lightweight = false } = {}) {
    const strokeColor = bladeSkin?.color || '#FFE566';
    const strokeSoft = bladeSkin?.tip || '#FFF3B8';
    const glowColor = bladeSkin?.color
      ? `${bladeSkin.color}73`
      : 'rgba(255, 229, 102, 0.45)';

    for (const trail of trails) {
      if (trail.length < 2) continue;

      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const t = i / trail.length;
        const age = (performance.now() - b.time) / CONFIG.handTracking.trailMaxAge;
        const alpha = (1 - age) * t * (lightweight ? 0.75 : 0.9);
        const width = lightweight ? 3 + t * 10 : 4 + t * 14;
        const velocityFactor = Math.min(1, (b.velocity || 0) / 2000);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = velocityFactor > 0.5 ? strokeColor : strokeSoft;
        if (!lightweight) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 6 + velocityFactor * 8;
        }
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }

      if (lightweight) continue;

      const tip = trail[trail.length - 1];
      if (tip) {
        const velocityFactor = Math.min(1, (tip.velocity || 0) / 2000);
        ctx.save();
        ctx.globalAlpha = 0.7 + velocityFactor * 0.3;
        const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 20);
        glow.addColorStop(0, strokeSoft);
        glow.addColorStop(0.5, strokeColor);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  clear() {
    this.floatingScores = [];
    this.milestoneBanner = null;
    this.milestoneQueue = [];
    this.screenPulse = 0;
    this.shake.active = false;
  }
}
