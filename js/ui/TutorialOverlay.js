import { CONFIG } from '../config.js';

const STEPS = [
  {
    title: 'Open your hand',
    body: 'Extend index + middle fingers — your blade appears on screen.',
    icon: '✋',
  },
  {
    title: 'Swipe fast!',
    body: 'Move your hand quickly through fruits. Slow drags won\'t slice.',
    icon: '⚡',
  },
  {
    title: 'Fist to pause blade',
    body: 'Close your fist to hide the blade. Open again to slash.',
    icon: '✊',
  },
];

/**
 * Onboarding completion flag — practice slice step calls complete().
 * Steps: (1) HTML camera CTA, (2) canvas calibration ring, (3) practice watermelon slice.
 */
export class TutorialOverlay {
  constructor() {
    this.key = CONFIG.storage.tutorialKey;
    this.done = localStorage.getItem(this.key) === '1';
    this.step = 0;
    this.visible = false;
  }

  shouldShow(calibrated) {
    return calibrated && !this.done && this.visible;
  }

  startAfterCalibration() {
    if (this.done || this.visible) return;
    this.step = 0;
    this.visible = true;
  }

  advance() {
    this.step += 1;
    if (this.step >= STEPS.length) this.complete();
  }

  complete() {
    this.done = true;
    this.visible = false;
    localStorage.setItem(this.key, '1');
  }

  skip() {
    this.complete();
  }

  getCurrent() {
    return STEPS[this.step] || null;
  }

  getProgress() {
    return (this.step + 1) / STEPS.length;
  }

  draw(ctx, width, height) {
    const current = this.getCurrent();
    if (!current) return;

    ctx.save();
    ctx.fillStyle = 'rgba(20, 18, 32, 0.55)';
    ctx.fillRect(0, 0, width, height);

    const cardW = Math.min(400, width * 0.88);
    const cardH = 168;
    const cx = (width - cardW) / 2;
    const cy = height * 0.22;

    ctx.fillStyle = 'rgba(42, 38, 64, 0.92)';
    ctx.strokeStyle = 'rgba(255, 250, 245, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFE566';
    ctx.font = '32px sans-serif';
    ctx.fillText(current.icon, width / 2, cy + 42);

    ctx.fillStyle = '#FFFAF5';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText(current.title, width / 2, cy + 72);

    ctx.fillStyle = 'rgba(255,250,245,0.72)';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText(current.body, width / 2, cy + 98);

    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,250,245,0.45)';
    ctx.fillText(`Step ${this.step + 1} of ${STEPS.length} · slice anywhere to continue`, width / 2, cy + cardH - 18);

    ctx.restore();
  }
}
