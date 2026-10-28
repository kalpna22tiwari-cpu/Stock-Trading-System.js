/**
 * Stock Model
 * Represents an individual tradable stock/asset in the simulation.
 * Manages price history, OHLCV candle generation, and price fluctuation mechanics.
 */
export class Stock {
  /**
   * @param {Object} config
   * @param {string} config.symbol - Ticker symbol (e.g., AAPL)
   * @param {string} config.name - Full company name
   * @param {string} config.sector - Industry sector (e.g., Technology, Finance)
   * @param {number} config.basePrice - Starting price
   * @param {number} config.volatility - Daily price volatility (0.01 to 0.05)
   * @param {number} [config.peRatio] - Price-to-earnings ratio
   * @param {string} [config.marketCap] - Market capitalization string
   */
  constructor({ symbol, name, sector, basePrice, volatility = 0.02, peRatio = 25.4, marketCap = '$2.8T' }) {
    this.symbol = symbol;
    this.name = name;
    this.sector = sector;
    this.basePrice = Number(basePrice);
    this.currentPrice = Number(basePrice);
    this.openPrice = Number(basePrice);
    this.highPrice = Number(basePrice);
    this.lowPrice = Number(basePrice);
    this.prevClose = Number(basePrice);
    this.volume = Math.floor(Math.random() * 5000000) + 1000000;
    this.volatility = volatility;
    this.peRatio = peRatio;
    this.marketCap = marketCap;
    this.drift = 0.0002; // Slight upward drift on average
    
    // Sparkline history for quick preview (last 30 ticks)
    this.sparkline = [this.currentPrice];
    
    // Array of OHLCV bars for charts: { timestamp, open, high, low, close, volume }
    this.history = [];
    
    // Seed initial historical data
    this.generateHistoricalData(60);
  }

  /**
   * Generates realistic historical OHLCV data using Geometric Brownian Motion
   * @param {number} days - Number of historical days to generate
   */
  generateHistoricalData(days = 60) {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let price = this.basePrice * (1 - (days * 0.003)); // historical start
    if (price <= 5) price = this.basePrice * 0.8;

    this.history = [];
    for (let i = days; i >= 1; i--) {
      const timestamp = now - (i * oneDayMs);
      const dayReturn = (Math.random() - 0.485) * (this.volatility * 2);
      const open = price;
      const close = Math.max(1, +(open * (1 + dayReturn)).toFixed(2));
      const high = +(Math.max(open, close) * (1 + Math.random() * this.volatility)).toFixed(2);
      const low = +(Math.min(open, close) * (1 - Math.random() * this.volatility)).toFixed(2);
      const vol = Math.floor((Math.random() * 0.8 + 0.6) * this.volume);

      this.history.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume: vol
      });

      price = close;
    }

    // Set today's values
    this.prevClose = this.history[this.history.length - 1].close;
    this.openPrice = this.prevClose;
    this.currentPrice = this.prevClose;
    this.highPrice = this.prevClose;
    this.lowPrice = this.prevClose;
    this.sparkline = this.history.slice(-25).map(h => h.close);
  }

  /**
   * Simulates a real-time price tick
   * @param {number} marketTrend - Market-wide sentiment factor (-0.02 to +0.02)
   * @param {number} newsImpact - Specific catalyst impact (-0.1 to +0.1)
   * @returns {Object} { oldPrice, newPrice, change, changePercent }
   */
  tick(marketTrend = 0, newsImpact = 0) {
    const oldPrice = this.currentPrice;
    
    // Geometric Brownian Motion step with stochastic shock
    const u1 = Math.random();
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);

    const stepVolatility = this.volatility * 0.35;
    const changeFactor = (this.drift + marketTrend + newsImpact) + (stepVolatility * randStdNormal);
    
    let newPrice = +(oldPrice * (1 + changeFactor)).toFixed(2);
    // Prevent prices from becoming negative or zero
    if (newPrice < 1.00) newPrice = 1.00;

    this.currentPrice = newPrice;
    if (newPrice > this.highPrice) this.highPrice = newPrice;
    if (newPrice < this.lowPrice) this.lowPrice = newPrice;

    // Simulate volume surge on ticks
    const tickVolume = Math.floor(Math.random() * 25000) + 1000;
    this.volume += tickVolume;

    // Update sparkline
    this.sparkline.push(newPrice);
    if (this.sparkline.length > 30) {
      this.sparkline.shift();
    }

    // Update or append current active candle in history
    const now = Date.now();
    const lastBar = this.history[this.history.length - 1];
    
    // If last bar is recent (within 5 minutes in sim time), update it; else push new
    if (lastBar && (now - lastBar.timestamp) < 300000) {
      lastBar.close = newPrice;
      lastBar.high = Math.max(lastBar.high, newPrice);
      lastBar.low = Math.min(lastBar.low, newPrice);
      lastBar.volume += tickVolume;
    } else {
      this.history.push({
        timestamp: now,
        open: oldPrice,
        high: Math.max(oldPrice, newPrice),
        low: Math.min(oldPrice, newPrice),
        close: newPrice,
        volume: tickVolume
      });
      if (this.history.length > 200) {
        this.history.shift();
      }
    }

    return {
      symbol: this.symbol,
      oldPrice,
      newPrice,
      diff: +(newPrice - oldPrice).toFixed(2),
      percent: +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(2)
    };
  }

  /**
   * Computes the daily price change and percentage
   */
  getDailyChange() {
    const diff = +(this.currentPrice - this.prevClose).toFixed(2);
    const percent = +((diff / (this.prevClose || 1)) * 100).toFixed(2);
    return { diff, percent, isPositive: diff >= 0 };
  }

  /**
   * Serializes stock state for persistence
   */
  toJSON() {
    return {
      symbol: this.symbol,
      name: this.name,
      sector: this.sector,
      basePrice: this.basePrice,
      currentPrice: this.currentPrice,
      openPrice: this.openPrice,
      highPrice: this.highPrice,
      lowPrice: this.lowPrice,
      prevClose: this.prevClose,
      volume: this.volume,
      volatility: this.volatility,
      peRatio: this.peRatio,
      marketCap: this.marketCap,
      sparkline: this.sparkline,
      history: this.history
    };
  }

  /**
   * Rehydrates stock instance from JSON
   */
  static fromJSON(data) {
    const stock = new Stock({
      symbol: data.symbol,
      name: data.name,
      sector: data.sector,
      basePrice: data.basePrice,
      volatility: data.volatility,
      peRatio: data.peRatio,
      marketCap: data.marketCap
    });
    stock.currentPrice = data.currentPrice;
    stock.openPrice = data.openPrice;
    stock.highPrice = data.highPrice;
    stock.lowPrice = data.lowPrice;
    stock.prevClose = data.prevClose;
    stock.volume = data.volume;
    stock.sparkline = data.sparkline || [data.currentPrice];
    stock.history = data.history || [];
    return stock;
  }
}
