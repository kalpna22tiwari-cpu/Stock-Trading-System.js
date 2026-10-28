/**
 * ChartEngine
 * High-performance, Retina-ready HTML5 Canvas Charting Engine
 * Supports Candlestick, Line/Area, Moving Averages (SMA/EMA), Volume histogram,
 * interactive crosshairs, and dynamic inspection tooltips.
 */
export class ChartEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.data = []; // OHLCV array
    this.mode = 'candlestick'; // 'candlestick' | 'line'
    this.timeframe = '1M'; // '1D', '1W', '1M', 'ALL'
    this.showSMA = true;
    this.showEMA = false;
    this.showVolume = true;

    // Crosshair state
    this.mouse = { x: null, y: null, active: false };
    this.hoveredBar = null;

    this.initEventListeners();
    this.resize();
  }

  initEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      this.mouse.active = true;
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.active = false;
      this.hoveredBar = null;
      this.render();
    });

    window.addEventListener('resize', () => {
      this.resize();
      this.render();
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    // Set actual canvas resolution
    this.canvas.width = Math.max(300, rect.width * dpr);
    this.canvas.height = Math.max(200, rect.height * dpr);

    // Normalize coordinates back to CSS pixels
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  }

  setData(ohlcvList) {
    this.data = Array.isArray(ohlcvList) ? ohlcvList : [];
    this.render();
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  setTimeframe(tf) {
    this.timeframe = tf;
    this.render();
  }

  toggleSMA(enabled) {
    this.showSMA = enabled;
    this.render();
  }

  toggleEMA(enabled) {
    this.showEMA = enabled;
    this.render();
  }

  getFilteredData() {
    if (!this.data || this.data.length === 0) return [];
    let count = this.data.length;
    if (this.timeframe === '1D') count = 20;
    else if (this.timeframe === '1W') count = 35;
    else if (this.timeframe === '1M') count = 60;
    else if (this.timeframe === 'ALL') count = this.data.length;

    return this.data.slice(-count);
  }

  render() {
    const { ctx, width, height } = this;
    if (!ctx || !width || !height) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const bars = this.getFilteredData();
    if (bars.length < 2) {
      this.renderEmptyState();
      return;
    }

    // Chart dimensions
    const padding = { top: 25, right: 65, bottom: 45, left: 15 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const volumeH = this.showVolume ? chartH * 0.22 : 0;
    const priceH = chartH - volumeH;

    // Compute Min and Max
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    for (const b of bars) {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
      if (b.volume > maxVol) maxVol = b.volume;
    }

    const priceBuffer = (maxPrice - minPrice) * 0.08 || 1;
    minPrice -= priceBuffer;
    maxPrice += priceBuffer;
    const priceRange = maxPrice - minPrice;

    // Helper functions for coordinates
    const getX = (index) => padding.left + (index / (bars.length - 1)) * chartW;
    const getY = (price) => padding.top + priceH - ((price - minPrice) / priceRange) * priceH;
    const getVolY = (vol) => padding.top + chartH - (vol / (maxVol || 1)) * volumeH;

    // 1. Draw Background Grid
    this.drawGrid(padding, chartW, chartH, priceH, minPrice, maxPrice, bars);

    // 2. Draw Volume Bars
    if (this.showVolume) {
      this.drawVolume(bars, padding, chartW, chartH, getX, getVolY);
    }

    // 3. Draw Main Price Chart (Candlestick or Line)
    if (this.mode === 'candlestick') {
      this.drawCandlesticks(bars, chartW, getX, getY);
    } else {
      this.drawAreaLine(bars, padding, chartW, priceH, getX, getY);
    }

    // 4. Moving Averages
    if (this.showSMA) {
      this.drawMovingAverage(bars, 20, '#f59e0b', getX, getY); // Amber SMA 20
    }
    if (this.showEMA) {
      this.drawEMA(bars, 50, '#06b6d4', getX, getY); // Cyan EMA 50
    }

    // 5. Draw Interactive Crosshair & Tooltip
    this.drawCrosshair(bars, padding, chartW, chartH, priceH, minPrice, maxPrice, getX, getY);
  }

  drawGrid(padding, chartW, chartH, priceH, minPrice, maxPrice, bars) {
    const { ctx, width } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    // Horizontal Price Lines (5 levels)
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const p = minPrice + (i / steps) * (maxPrice - minPrice);
      const y = padding.top + priceH - (i / steps) * priceH;

      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Right Y-axis label
      ctx.fillText(`$${p.toFixed(2)}`, width - padding.right + 8, y);
    }

    // Vertical Date Grid Lines (approx 5 markers)
    ctx.setLineDash([4, 4]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const dateSteps = Math.min(5, bars.length - 1);
    for (let i = 0; i <= dateSteps; i++) {
      const barIdx = Math.floor((i / dateSteps) * (bars.length - 1));
      const bar = bars[barIdx];
      const x = padding.left + (barIdx / (bars.length - 1)) * chartW;

      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartH);
      ctx.stroke();

      // Date label below
      const d = new Date(bar.timestamp);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      ctx.fillText(label, x, padding.top + chartH + 8);
    }

    ctx.restore();
  }

  drawVolume(bars, padding, chartW, chartH, getX, getVolY) {
    const { ctx } = this;
    const barWidth = Math.max(2, (chartW / bars.length) * 0.7);

    bars.forEach((b, i) => {
      const x = getX(i);
      const y = getVolY(b.volume);
      const h = (padding.top + chartH) - y;
      const isUp = b.close >= b.open;

      ctx.fillStyle = isUp ? 'rgba(0, 230, 118, 0.22)' : 'rgba(255, 59, 87, 0.22)';
      ctx.fillRect(x - barWidth / 2, y, barWidth, h);
    });
  }

  drawCandlesticks(bars, chartW, getX, getY) {
    const { ctx } = this;
    const candleWidth = Math.max(3, Math.min(24, (chartW / bars.length) * 0.75));

    bars.forEach((b, i) => {
      const x = getX(i);
      const openY = getY(b.open);
      const closeY = getY(b.close);
      const highY = getY(b.high);
      const lowY = getY(b.low);

      const isUp = b.close >= b.open;
      const color = isUp ? '#00e676' : '#ff3b57';

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.2;

      // Draw wick
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw candle body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });
  }

  drawAreaLine(bars, padding, chartW, priceH, getX, getY) {
    const { ctx, height } = this;
    if (bars.length < 2) return;

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + priceH);
    gradient.addColorStop(0, 'rgba(0, 230, 118, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 230, 118, 0.00)');

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(bars[0].close));

    for (let i = 1; i < bars.length; i++) {
      ctx.lineTo(getX(i), getY(bars[i].close));
    }

    // Fill region
    ctx.lineTo(getX(bars.length - 1), padding.top + priceH);
    ctx.lineTo(getX(0), padding.top + priceH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Glowing stroke
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(bars[0].close));
    for (let i = 1; i < bars.length; i++) {
      ctx.lineTo(getX(i), getY(bars[i].close));
    }
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 230, 118, 0.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  drawMovingAverage(bars, period, color, getX, getY) {
    const { ctx } = this;
    if (bars.length < period) return;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;

    let started = false;
    for (let i = period - 1; i < bars.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += bars[i - j].close;
      }
      const sma = sum / period;
      const x = getX(i);
      const y = getY(sma);

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  drawEMA(bars, period, color, getX, getY) {
    const { ctx } = this;
    if (bars.length < 5) return;

    const k = 2 / (period + 1);
    let ema = bars[0].close;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.moveTo(getX(0), getY(ema));

    for (let i = 1; i < bars.length; i++) {
      ema = bars[i].close * k + ema * (1 - k);
      ctx.lineTo(getX(i), getY(ema));
    }
    ctx.stroke();
    ctx.restore();
  }

  drawCrosshair(bars, padding, chartW, chartH, priceH, minPrice, maxPrice, getX, getY) {
    const { ctx, width, mouse } = this;
    if (!mouse.active || mouse.x < padding.left || mouse.x > width - padding.right) return;

    // Find nearest bar
    const ratio = (mouse.x - padding.left) / chartW;
    const nearestIdx = Math.max(0, Math.min(bars.length - 1, Math.round(ratio * (bars.length - 1))));
    const bar = bars[nearestIdx];
    this.hoveredBar = bar;

    const snapX = getX(nearestIdx);
    const snapY = getY(bar.close);

    ctx.save();
    // Dotted crosshair lines
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(snapX, padding.top);
    ctx.lineTo(snapX, padding.top + chartH);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(padding.left, mouse.y);
    ctx.lineTo(width - padding.right, mouse.y);
    ctx.stroke();

    // Snap point circle
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.arc(snapX, snapY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#00e676';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dynamic Price Tag on Y Axis
    const currentHoverPrice = maxPrice - ((mouse.y - padding.top) / priceH) * (maxPrice - minPrice);
    if (mouse.y >= padding.top && mouse.y <= padding.top + priceH) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(width - padding.right + 2, mouse.y - 10, 60, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${currentHoverPrice.toFixed(2)}`, width - padding.right + 6, mouse.y);
    }

    // Dynamic Tooltip HUD Card (Upper Left)
    const isUp = bar.close >= bar.open;
    const change = +(bar.close - bar.open).toFixed(2);
    const changePct = +((change / bar.open) * 100).toFixed(2);
    const dateStr = new Date(bar.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(padding.left + 10, padding.top + 8, 380, 26, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    
    let textX = padding.left + 20;
    const hudY = padding.top + 21;

    ctx.fillText(`${dateStr}`, textX, hudY);
    textX += 105;

    ctx.fillText(`O: $${bar.open.toFixed(2)}`, textX, hudY);
    textX += 65;

    ctx.fillText(`H: $${bar.high.toFixed(2)}`, textX, hudY);
    textX += 65;

    ctx.fillText(`L: $${bar.low.toFixed(2)}`, textX, hudY);
    textX += 65;

    ctx.fillStyle = isUp ? '#00e676' : '#ff3b57';
    ctx.fillText(`C: $${bar.close.toFixed(2)} (${change >= 0 ? '+' : ''}${changePct}%)`, textX, hudY);

    ctx.restore();
  }

  renderEmptyState() {
    const { ctx, width, height } = this;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Awaiting market quote data...', width / 2, height / 2);
  }
}
