/**
 * Fruit/bomb rendering — illustrated sprites when loaded, procedural fallback otherwise.
 */
export class FruitRenderer {
  constructor(assetLoader = null) {
    this.assetLoader = assetLoader;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this._motionMq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this._motionMq?.addEventListener?.('change', (e) => {
      this.reducedMotion = e.matches;
    });
  }

  setAssetLoader(assetLoader) {
    this.assetLoader = assetLoader;
  }

  drawSprite(ctx, type, entity, scale = 2.38, category = 'fruits') {
    const img = category === 'fruits'
      ? this.assetLoader?.get(type)
      : this.assetLoader?.get(category, type);
    if (!img) return false;

    const { x, y, radius, rotation } = entity;
    const size = radius * scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.shadowColor = 'rgba(55, 40, 65, 0.32)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }

  drawBombFuse(ctx, bomb) {
    const { x, y, radius, fusePhase } = bomb;
    const spark = 0.5 + 0.5 * Math.sin(fusePhase || 0);
    const r = 4 + spark * 2;
    ctx.save();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(x, y - radius - 14, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 245, 0.85)';
    ctx.beginPath();
    ctx.arc(x - 1, y - radius - 15, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  /**
   * Menu fruit with label and selection glow.
   */
  drawMenuFruit(ctx, menuFruit) {
    const { x, y, radius, rotation, selected, label, sublabel, compact } = menuFruit;
    const isChoice = menuFruit.group === 'mode' || menuFruit.group === 'difficulty';
    const ringPad = compact ? 6 : 10;
    const labelGap = compact ? 14 : 22;
    const sublabelGap = compact ? 28 : 40;
    const pulseT = menuFruit.selectionPulse
      ? Math.max(0, (menuFruit.selectionPulse - performance.now()) / 450)
      : 0;

    ctx.save();
    if (isChoice && !selected && !menuFruit.keyboardFocus) {
      ctx.globalAlpha = 0.52;
    }

    if (selected || menuFruit.keyboardFocus) {
      ctx.save();
      const ringColor = menuFruit.keyboardFocus ? '#69f0ae' : '#ffeb3b';
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = compact ? 3.5 : 5;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = compact ? 12 : 22;
      ctx.beginPath();
      ctx.arc(x, y, radius + ringPad + pulseT * 6, 0, Math.PI * 2);
      ctx.stroke();

      if (selected) {
        ctx.fillStyle = 'rgba(255, 235, 102, 0.18)';
        ctx.beginPath();
        ctx.arc(x, y, radius + ringPad - 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (pulseT > 0) {
      ctx.strokeStyle = 'rgba(255, 235, 102, 0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, radius + ringPad + pulseT * 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.drawFruit(ctx, { ...menuFruit, x, y, rotation });

    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = selected ? '#ffeb3b' : '#fff';
    ctx.font = `bold ${compact ? 13 : 15}px "Nunito Sans", "Segoe UI", sans-serif`;
    ctx.fillText(label, x, y + radius + labelGap);
    if (sublabel) {
      ctx.font = `14px "Nunito Sans", "Segoe UI", sans-serif`;
      ctx.fillStyle = selected ? 'rgba(255,235,102,0.85)' : 'rgba(255,255,255,0.75)';
      ctx.fillText(sublabel, x, y + radius + sublabelGap);
    }

    if (selected && isChoice) {
      ctx.font = `bold ${compact ? 11 : 12}px "Nunito Sans", sans-serif`;
      ctx.fillStyle = '#ffeb3b';
      ctx.shadowBlur = 6;
      ctx.fillText('SELECTED', x, y - radius - (compact ? 10 : 14));
    }

    ctx.restore();
  }

  drawFruit(ctx, fruit) {
    if (fruit.isBomb) {
      if (this.drawSprite(ctx, 'bomb', fruit)) {
        this.drawBombFuse(ctx, fruit);
        return;
      }
      this.drawBomb(ctx, fruit);
      return;
    }

    if (fruit.isPowerUp) {
      this.drawPowerUpBanana(ctx, fruit);
      return;
    }

    if (this.drawSprite(ctx, fruit.type, fruit)) return;

    const fn = {
      apple: this.drawApple,
      banana: this.drawBanana,
      orange: this.drawOrange,
      watermelon: this.drawWatermelon,
      pineapple: this.drawPineapple,
      strawberry: this.drawStrawberry,
      mango: this.drawMango,
      kiwi: this.drawKiwi,
      coconut: this.drawCoconut,
      peach: this.drawPeach,
    }[fruit.type];

    if (fn) fn.call(this, ctx, fruit);
    else this.drawApple(ctx, fruit);
  }

  drawSlicedPiece(ctx, piece) {
    ctx.save();
    ctx.globalAlpha = piece.alpha;
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);

    // Clip to half based on slice angle and side
    ctx.beginPath();
    if (piece.side === 'left') {
      ctx.rect(-piece.radius, -piece.radius, piece.radius, piece.radius * 2);
    } else {
      ctx.rect(0, -piece.radius, piece.radius, piece.radius * 2);
    }
    ctx.clip();

    const fakeFruit = {
      type: piece.fruitType,
      def: piece.def,
      radius: piece.radius,
      rotation: 0,
      x: 0,
      y: 0,
    };
    this.drawFruit(ctx, fakeFruit);

    // Exposed flesh edge — sprite overlay when available, stroke fallback
    const fleshEdge = this.assetLoader?.getVfx?.('flesh-edge');
    if (fleshEdge) {
      ctx.globalAlpha = piece.alpha * 0.85;
      const edgeH = piece.radius * 2;
      const edgeW = piece.radius * 0.22;
      ctx.drawImage(fleshEdge, -edgeW / 2, -piece.radius, edgeW, edgeH);
    } else {
      ctx.globalAlpha = piece.alpha * 0.9;
      ctx.strokeStyle = piece.def.juice[0];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -piece.radius);
      ctx.lineTo(0, piece.radius);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawBomb(ctx, bomb) {
    const { x, y, radius, fusePhase } = bomb;
    ctx.save();
    ctx.translate(x, y);

    // Body
    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
    grad.addColorStop(0, '#424242');
    grad.addColorStop(1, '#212121');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Skull icon
    ctx.fillStyle = '#bdbdbd';
    ctx.font = `bold ${radius}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☠', 0, 2);

    // Fuse spark
    const spark = 0.5 + 0.5 * Math.sin(fusePhase);
    ctx.fillStyle = `rgba(255, ${Math.floor(100 + spark * 155)}, 0, ${0.6 + spark * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, -radius - 6, 4 + spark * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawApple(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
    grad.addColorStop(0, c.highlight);
    grad.addColorStop(1, c.main);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Stem & leaf
    ctx.strokeStyle = c.stem;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(0, -radius - 10);
    ctx.stroke();
    ctx.fillStyle = c.leaf;
    ctx.beginPath();
    ctx.ellipse(6, -radius - 8, 8, 4, 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawBanana(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.strokeStyle = c.main;
    ctx.lineWidth = radius * 0.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0.3, Math.PI - 0.3);
    ctx.stroke();

    ctx.fillStyle = c.tip;
    ctx.beginPath();
    ctx.arc(radius * 0.55, -radius * 0.35, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawPowerUpBanana(ctx, fruit) {
    const { x, y, radius, rotation } = fruit;
    const powerType = fruit.powerType || 'freeze';

    if (this.drawSprite(ctx, powerType, { x, y, radius, rotation }, 2.5, 'powerups')) {
      return;
    }

    const palette = {
      freeze: { fill: '#4FC3F7', icon: '❄' },
      frenzy: { fill: '#FF5252', icon: '!' },
      double: { fill: '#69F0AE', icon: '×2' },
    };
    const c = palette[powerType] || palette.freeze;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.lineCap = 'round';
    ctx.lineWidth = radius * 0.54;
    ctx.strokeStyle = '#FFEB3B';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.58, 0.35, Math.PI - 0.35);
    ctx.stroke();

    ctx.fillStyle = c.fill;
    ctx.strokeStyle = '#6B5344';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFAF5';
    ctx.font = `bold ${Math.round(radius * 0.3)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, 0, 1);

    ctx.restore();
  }

  drawOrange(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const grad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, 0, 0, 0, radius);
    grad.addColorStop(0, c.highlight);
    grad.addColorStop(1, c.main);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Segments
    ctx.strokeStyle = c.segment;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawWatermelon(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Stripes
    ctx.strokeStyle = c.highlight;
    ctx.lineWidth = 4;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 12, -radius);
      ctx.lineTo(i * 8, radius);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPineapple(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.85, radius, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crosshatch
    ctx.strokeStyle = c.cross;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 8, -radius);
      ctx.lineTo(i * 8 + 10, radius);
      ctx.stroke();
    }

    // Leaves
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.leaf;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 10, -radius - 8, 6, 14, i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawStrawberry(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    for (let i = 0; i < 5; i++) {
      const a = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * radius * 0.9, Math.sin(a) * radius * 0.85 + radius * 0.1);
    }
    ctx.closePath();
    ctx.fill();

    // Seeds (deterministic positions — avoid flicker across frames)
    ctx.fillStyle = c.seed;
    const seed = fruit.id || 1;
    for (let i = 0; i < 12; i++) {
      const a = ((seed * 7 + i * 53) % 360) * (Math.PI / 180);
      const r = ((seed * 3 + i * 17) % 100) / 100 * radius * 0.6;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r + 5, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Leaves
    ctx.fillStyle = c.leaf;
    ctx.beginPath();
    ctx.ellipse(0, -radius + 2, radius * 0.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawMango(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const grad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, 0, 0, 0, radius);
    grad.addColorStop(0, c.highlight);
    grad.addColorStop(0.6, c.main);
    grad.addColorStop(1, c.blush);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.85, radius, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawKiwi(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = c.flesh;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Seeds ring
    ctx.fillStyle = c.seed;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * radius * 0.45, Math.sin(a) * radius * 0.45, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawCoconut(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
    grad.addColorStop(0, c.highlight);
    grad.addColorStop(1, c.main);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Fibers
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();
    }

    // Eyes
    ctx.fillStyle = '#3e2723';
    for (const [ex, ey] of [[-8, -6], [8, -6], [0, 8]]) {
      ctx.beginPath();
      ctx.ellipse(ex, ey, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawPeach(ctx, fruit) {
    const { x, y, radius, rotation, def } = fruit;
    const c = def.colors;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.2, 0, 0, 0, radius);
    grad.addColorStop(0, c.highlight);
    grad.addColorStop(0.7, c.main);
    grad.addColorStop(1, c.blush);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Crease
    ctx.strokeStyle = c.blush;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(6, 0, 0, radius);
    ctx.stroke();

    ctx.restore();
  }
}
