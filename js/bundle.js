/**
 * ApexTrader Pro - Consolidated Production Bundle
 * Fully self-contained for direct browser execution (double-clicking index.html)
 * without CORS restrictions from file:// protocol.
 */

// ==========================================
// 1. Stock Model
// ==========================================
class Stock {
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
    this.drift = 0.0002;
    this.sparkline = [this.currentPrice];
    this.history = [];
    this.generateHistoricalData(60);
  }

  generateHistoricalData(days = 60) {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let price = this.basePrice * (1 - (days * 0.003));
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

      this.history.push({ timestamp, open, high, low, close, volume: vol });
      price = close;
    }

    this.prevClose = this.history[this.history.length - 1].close;
    this.openPrice = this.prevClose;
    this.currentPrice = this.prevClose;
    this.highPrice = this.prevClose;
    this.lowPrice = this.prevClose;
    this.sparkline = this.history.slice(-25).map(h => h.close);
  }

  tick(marketTrend = 0, newsImpact = 0) {
    const oldPrice = this.currentPrice;
    const u1 = Math.random();
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);

    const stepVolatility = this.volatility * 0.35;
    const changeFactor = (this.drift + marketTrend + newsImpact) + (stepVolatility * randStdNormal);
    
    let newPrice = +(oldPrice * (1 + changeFactor)).toFixed(2);
    if (newPrice < 1.00) newPrice = 1.00;

    this.currentPrice = newPrice;
    if (newPrice > this.highPrice) this.highPrice = newPrice;
    if (newPrice < this.lowPrice) this.lowPrice = newPrice;

    const tickVolume = Math.floor(Math.random() * 25000) + 1000;
    this.volume += tickVolume;

    this.sparkline.push(newPrice);
    if (this.sparkline.length > 30) this.sparkline.shift();

    const now = Date.now();
    const lastBar = this.history[this.history.length - 1];
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
      if (this.history.length > 200) this.history.shift();
    }

    return {
      symbol: this.symbol,
      oldPrice,
      newPrice,
      diff: +(newPrice - oldPrice).toFixed(2),
      percent: +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(2)
    };
  }

  getDailyChange() {
    const diff = +(this.currentPrice - this.prevClose).toFixed(2);
    const percent = +((diff / (this.prevClose || 1)) * 100).toFixed(2);
    return { diff, percent, isPositive: diff >= 0 };
  }

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

  static fromJSON(data) {
    const stock = new Stock(data);
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

// ==========================================
// 2. Position Model
// ==========================================
class Position {
  constructor(symbol, shares = 0, price = 0) {
    this.symbol = symbol;
    this.shares = Number(shares);
    this.totalCost = Number((shares * price).toFixed(2));
    this.averagePrice = shares > 0 ? Number(price.toFixed(2)) : 0;
  }

  addShares(qty, price) {
    if (qty <= 0 || price <= 0) throw new Error("Quantity and price must be greater than zero.");
    const newCost = +(qty * price).toFixed(2);
    this.shares += qty;
    this.totalCost = +(this.totalCost + newCost).toFixed(2);
    this.averagePrice = +(this.totalCost / this.shares).toFixed(2);
  }

  removeShares(qty, price) {
    if (qty <= 0) throw new Error("Quantity must be greater than zero.");
    if (qty > this.shares) throw new Error(`Insufficient shares. You own ${this.shares} but attempted to sell ${qty}.`);

    const proceeds = +(qty * price).toFixed(2);
    const costBasisPortion = +(qty * this.averagePrice).toFixed(2);
    const realizedPnL = +(proceeds - costBasisPortion).toFixed(2);

    this.shares -= qty;
    this.totalCost = +(this.shares * this.averagePrice).toFixed(2);

    if (this.shares === 0) {
      this.totalCost = 0;
      this.averagePrice = 0;
    }

    return { realizedPnL, remainingShares: this.shares, proceeds };
  }

  getMarketValue(currentPrice) {
    return +(this.shares * currentPrice).toFixed(2);
  }

  getUnrealizedPnL(currentPrice) {
    return +(this.getMarketValue(currentPrice) - this.totalCost).toFixed(2);
  }

  getUnrealizedPnLPercent(currentPrice) {
    if (this.totalCost === 0) return 0;
    return +((this.getUnrealizedPnL(currentPrice) / this.totalCost) * 100).toFixed(2);
  }

  toJSON() {
    return {
      symbol: this.symbol,
      shares: this.shares,
      totalCost: this.totalCost,
      averagePrice: this.averagePrice
    };
  }

  static fromJSON(data) {
    const pos = new Position(data.symbol, 0, 0);
    pos.shares = Number(data.shares);
    pos.totalCost = Number(data.totalCost);
    pos.averagePrice = Number(data.averagePrice);
    return pos;
  }
}

// ==========================================
// 3. Transaction Model
// ==========================================
class Transaction {
  constructor({ id = null, timestamp = null, symbol, type, shares, price, totalAmount = null, fee = 0, realizedPnL = 0 }) {
    this.id = id || 'TX-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    this.timestamp = timestamp || Date.now();
    this.symbol = symbol.toUpperCase();
    this.type = type.toUpperCase();
    this.shares = Number(shares);
    this.price = Number(price);
    this.totalAmount = totalAmount !== null ? Number(totalAmount) : +(this.shares * this.price).toFixed(2);
    this.fee = Number(fee);
    this.realizedPnL = Number(realizedPnL);
  }

  getFormattedDate() {
    return new Date(this.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      symbol: this.symbol,
      type: this.type,
      shares: this.shares,
      price: this.price,
      totalAmount: this.totalAmount,
      fee: this.fee,
      realizedPnL: this.realizedPnL
    };
  }

  static fromJSON(data) {
    return new Transaction(data);
  }
}

// ==========================================
// 4. Order Model
// ==========================================
class Order {
  constructor({ id = null, timestamp = null, symbol, type, orderType = 'MARKET', shares, targetPrice = 0, status = 'PENDING' }) {
    this.id = id || 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    this.timestamp = timestamp || Date.now();
    this.symbol = symbol.toUpperCase();
    this.type = type.toUpperCase();
    this.orderType = orderType.toUpperCase();
    this.shares = Number(shares);
    this.targetPrice = Number(targetPrice);
    this.status = status;
    this.executionPrice = null;
    this.executedAt = null;
  }

  shouldTrigger(currentPrice) {
    if (this.status !== 'PENDING') return false;
    if (this.orderType === 'MARKET') return true;
    if (this.orderType === 'LIMIT') {
      if (this.type === 'BUY' && currentPrice <= this.targetPrice) return true;
      if (this.type === 'SELL' && currentPrice >= this.targetPrice) return true;
    }
    if (this.orderType === 'STOP_LOSS') {
      if (this.type === 'SELL' && currentPrice <= this.targetPrice) return true;
    }
    return false;
  }

  markFilled(executionPrice) {
    this.status = 'FILLED';
    this.executionPrice = executionPrice;
    this.executedAt = Date.now();
  }

  markCancelled() {
    this.status = 'CANCELLED';
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      symbol: this.symbol,
      type: this.type,
      orderType: this.orderType,
      shares: this.shares,
      targetPrice: this.targetPrice,
      status: this.status,
      executionPrice: this.executionPrice,
      executedAt: this.executedAt
    };
  }

  static fromJSON(data) {
    const ord = new Order(data);
    ord.executionPrice = data.executionPrice;
    ord.executedAt = data.executedAt;
    return ord;
  }
}

// ==========================================
// 5. Portfolio Model
// ==========================================
class Portfolio {
  constructor(initialCapital = 100000) {
    this.initialCapital = Number(initialCapital);
    this.cashBalance = Number(initialCapital);
    this.reservedCash = 0;
    this.positions = new Map();
    this.transactions = [];
    this.pendingOrders = [];
    this.performanceSnapshots = [];
    this.recordInitialSnapshot();
  }

  recordInitialSnapshot() {
    this.performanceSnapshots = [{
      timestamp: Date.now() - 3600000,
      totalValue: this.initialCapital,
      cash: this.initialCapital,
      investedValue: 0,
      totalReturn: 0
    }];
  }

  getAvailableCash() {
    return +(this.cashBalance - this.reservedCash).toFixed(2);
  }

  getPosition(symbol) {
    const pos = this.positions.get(symbol.toUpperCase());
    return (pos && pos.shares > 0) ? pos : null;
  }

  buy(symbol, shares, price) {
    const sym = symbol.toUpperCase();
    const qty = Math.floor(Number(shares));
    const unitPrice = Number(price);

    if (qty <= 0) throw new Error("Number of shares must be at least 1.");
    if (unitPrice <= 0) throw new Error("Invalid execution price.");

    const totalCost = +(qty * unitPrice).toFixed(2);
    if (this.cashBalance < totalCost) {
      throw new Error(`Insufficient funds. Cost is $${totalCost.toLocaleString()}, but available balance is $${this.cashBalance.toLocaleString()}.`);
    }

    this.cashBalance = +(this.cashBalance - totalCost).toFixed(2);

    let position = this.positions.get(sym);
    if (!position) {
      position = new Position(sym, qty, unitPrice);
      this.positions.set(sym, position);
    } else {
      position.addShares(qty, unitPrice);
    }

    const tx = new Transaction({
      symbol: sym,
      type: 'BUY',
      shares: qty,
      price: unitPrice,
      totalAmount: totalCost,
      fee: 0,
      realizedPnL: 0
    });

    this.transactions.unshift(tx);
    return tx;
  }

  sell(symbol, shares, price) {
    const sym = symbol.toUpperCase();
    const qty = Math.floor(Number(shares));
    const unitPrice = Number(price);

    if (qty <= 0) throw new Error("Number of shares must be at least 1.");

    const position = this.getPosition(sym);
    if (!position || position.shares < qty) {
      const owned = position ? position.shares : 0;
      throw new Error(`Cannot sell ${qty} shares of ${sym}. You only own ${owned} shares.`);
    }

    const { realizedPnL, proceeds } = position.removeShares(qty, unitPrice);
    this.cashBalance = +(this.cashBalance + proceeds).toFixed(2);

    if (position.shares === 0) {
      this.positions.delete(sym);
    }

    const tx = new Transaction({
      symbol: sym,
      type: 'SELL',
      shares: qty,
      price: unitPrice,
      totalAmount: proceeds,
      fee: 0,
      realizedPnL: realizedPnL
    });

    this.transactions.unshift(tx);
    return tx;
  }

  placeOrder(order) {
    if (order.type === 'BUY') {
      const estimatedCost = order.shares * (order.targetPrice || 0);
      if (this.getAvailableCash() < estimatedCost) {
        throw new Error(`Cannot place limit buy: need $${estimatedCost.toFixed(2)} cash available.`);
      }
      this.reservedCash = +(this.reservedCash + estimatedCost).toFixed(2);
    } else if (order.type === 'SELL') {
      const pos = this.getPosition(order.symbol);
      if (!pos || pos.shares < order.shares) {
        throw new Error(`Cannot place limit sell: you only hold ${pos ? pos.shares : 0} shares of ${order.symbol}.`);
      }
    }

    this.pendingOrders.unshift(order);
    return order;
  }

  cancelOrder(orderId) {
    const index = this.pendingOrders.findIndex(o => o.id === orderId);
    if (index === -1) return false;

    const order = this.pendingOrders[index];
    if (order.status === 'PENDING') {
      order.markCancelled();
      if (order.type === 'BUY') {
        const reserved = order.shares * order.targetPrice;
        this.reservedCash = Math.max(0, +(this.reservedCash - reserved).toFixed(2));
      }
    }

    this.pendingOrders.splice(index, 1);
    return true;
  }

  processPendingOrders(stockMap) {
    const executed = [];
    const remaining = [];

    for (const order of this.pendingOrders) {
      if (order.status !== 'PENDING') continue;
      const stock = stockMap.get(order.symbol);
      if (!stock) {
        remaining.push(order);
        continue;
      }

      if (order.shouldTrigger(stock.currentPrice)) {
        try {
          if (order.type === 'BUY') {
            const reserved = order.shares * order.targetPrice;
            this.reservedCash = Math.max(0, +(this.reservedCash - reserved).toFixed(2));
            const tx = this.buy(order.symbol, order.shares, stock.currentPrice);
            order.markFilled(stock.currentPrice);
            executed.push({ order, transaction: tx });
          } else {
            const tx = this.sell(order.symbol, order.shares, stock.currentPrice);
            order.markFilled(stock.currentPrice);
            executed.push({ order, transaction: tx });
          }
        } catch (err) {
          remaining.push(order);
        }
      } else {
        remaining.push(order);
      }
    }

    this.pendingOrders = remaining;
    return executed;
  }

  getTotalInvestedValue(stockMap) {
    let sum = 0;
    for (const [symbol, position] of this.positions.entries()) {
      const stock = stockMap.get(symbol);
      const price = stock ? stock.currentPrice : position.averagePrice;
      sum += position.getMarketValue(price);
    }
    return +sum.toFixed(2);
  }

  getTotalPortfolioValue(stockMap) {
    return +(this.cashBalance + this.getTotalInvestedValue(stockMap)).toFixed(2);
  }

  getTotalPnL(stockMap) {
    return +(this.getTotalPortfolioValue(stockMap) - this.initialCapital).toFixed(2);
  }

  getTotalPnLPercent(stockMap) {
    if (this.initialCapital === 0) return 0;
    return +((this.getTotalPnL(stockMap) / this.initialCapital) * 100).toFixed(2);
  }

  getDailyPnL(stockMap) {
    let dayPnL = 0;
    for (const [symbol, position] of this.positions.entries()) {
      const stock = stockMap.get(symbol);
      if (stock) {
        const change = stock.getDailyChange();
        dayPnL += (change.diff * position.shares);
      }
    }
    return +dayPnL.toFixed(2);
  }

  recordSnapshot(stockMap) {
    const totalVal = this.getTotalPortfolioValue(stockMap);
    const invested = this.getTotalInvestedValue(stockMap);
    const ret = this.getTotalPnLPercent(stockMap);

    const snapshot = {
      timestamp: Date.now(),
      totalValue: totalVal,
      cash: this.cashBalance,
      investedValue: invested,
      totalReturn: ret
    };

    const last = this.performanceSnapshots[this.performanceSnapshots.length - 1];
    if (!last || (Date.now() - last.timestamp > 15000) || Math.abs(last.totalValue - totalVal) > 5) {
      this.performanceSnapshots.push(snapshot);
      if (this.performanceSnapshots.length > 250) this.performanceSnapshots.shift();
    }
  }

  reset(newInitialCapital) {
    if (newInitialCapital) this.initialCapital = Number(newInitialCapital);
    this.cashBalance = this.initialCapital;
    this.reservedCash = 0;
    this.positions.clear();
    this.transactions = [];
    this.pendingOrders = [];
    this.recordInitialSnapshot();
  }

  toJSON() {
    const positionsObj = {};
    for (const [sym, pos] of this.positions.entries()) {
      positionsObj[sym] = pos.toJSON();
    }
    return {
      initialCapital: this.initialCapital,
      cashBalance: this.cashBalance,
      reservedCash: this.reservedCash,
      positions: positionsObj,
      transactions: this.transactions.map(t => t.toJSON()),
      pendingOrders: this.pendingOrders.map(o => o.toJSON()),
      performanceSnapshots: this.performanceSnapshots
    };
  }

  static fromJSON(data) {
    const port = new Portfolio(data.initialCapital || 100000);
    port.cashBalance = Number(data.cashBalance);
    port.reservedCash = Number(data.reservedCash || 0);
    port.positions = new Map();
    if (data.positions) {
      for (const [sym, posData] of Object.entries(data.positions)) {
        port.positions.set(sym, Position.fromJSON(posData));
      }
    }
    port.transactions = (data.transactions || []).map(t => Transaction.fromJSON(t));
    port.pendingOrders = (data.pendingOrders || []).map(o => Order.fromJSON(o));
    port.performanceSnapshots = data.performanceSnapshots || [];
    return port;
  }
}

// ==========================================
// 6. User Model
// ==========================================
class User {
  constructor({ id = null, name = 'Alex Hunter', portfolio = null, watchlist = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN'], settings = {} } = {}) {
    this.id = id || 'USR-' + Math.floor(100000 + Math.random() * 900000);
    this.name = name;
    this.portfolio = portfolio || new Portfolio(100000);
    this.watchlist = new Set(watchlist);
    this.settings = Object.assign({ soundEnabled: true, simSpeed: 1, isPaused: false }, settings);
    this.joinDate = Date.now();
  }

  toggleWatchlist(symbol) {
    const sym = symbol.toUpperCase();
    if (this.watchlist.has(sym)) {
      this.watchlist.delete(sym);
      return false;
    } else {
      this.watchlist.add(sym);
      return true;
    }
  }

  isInWatchlist(symbol) {
    return this.watchlist.has(symbol.toUpperCase());
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      joinDate: this.joinDate,
      watchlist: Array.from(this.watchlist),
      settings: this.settings,
      portfolio: this.portfolio.toJSON()
    };
  }

  static fromJSON(data) {
    const user = new User({
      id: data.id,
      name: data.name,
      watchlist: data.watchlist || [],
      settings: data.settings || {}
    });
    user.joinDate = data.joinDate || Date.now();
    if (data.portfolio) {
      user.portfolio = Portfolio.fromJSON(data.portfolio);
    }
    return user;
  }
}

// ==========================================
// 7. Market Engine Service
// ==========================================
class MarketEngine {
  constructor() {
    this.stocks = new Map();
    this.subscribers = new Set();
    this.newsSubscribers = new Set();
    this.marketSentiment = 0.001;
    this.simSpeed = 1;
    this.isPaused = false;
    this.intervalId = null;
    this.tickCount = 0;
    this.newsHistory = [];

    this.initDefaultUniverse();
    this.generateInitialNews();
  }

  initDefaultUniverse() {
    const assets = [
      { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', basePrice: 229.40, volatility: 0.018, peRatio: 34.2, marketCap: '$3.51T' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors', basePrice: 141.25, volatility: 0.038, peRatio: 62.4, marketCap: '$3.45T' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', basePrice: 428.15, volatility: 0.016, peRatio: 36.1, marketCap: '$3.18T' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication', basePrice: 169.80, volatility: 0.021, peRatio: 24.3, marketCap: '$2.11T' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', basePrice: 188.50, volatility: 0.024, peRatio: 44.5, marketCap: '$1.96T' },
      { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Automotive', basePrice: 221.75, volatility: 0.042, peRatio: 68.9, marketCap: '$708B' },
      { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Communication', basePrice: 588.60, volatility: 0.026, peRatio: 28.5, marketCap: '$1.49T' },
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', basePrice: 224.30, volatility: 0.015, peRatio: 12.3, marketCap: '$642B' },
      { symbol: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', basePrice: 898.20, volatility: 0.028, peRatio: 112.0, marketCap: '$852B' },
      { symbol: 'XOM', name: 'Exxon Mobil Corp.', sector: 'Energy', basePrice: 119.50, volatility: 0.019, peRatio: 13.8, marketCap: '$473B' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', sector: 'Index ETF', basePrice: 582.40, volatility: 0.011, peRatio: 27.6, marketCap: '$595B' },
      { symbol: 'QQQ', name: 'Invesco QQQ Trust', sector: 'Index ETF', basePrice: 494.80, volatility: 0.015, peRatio: 31.2, marketCap: '$285B' }
    ];

    for (const item of assets) {
      this.stocks.set(item.symbol, new Stock(item));
    }
  }

  generateInitialNews() {
    this.newsHistory = [
      {
        id: 'news-1',
        timestamp: Date.now() - 3600000,
        headline: 'Federal Reserve leaves benchmark interest rates unchanged, signals solid economic growth.',
        sentiment: 'neutral',
        impactSymbol: null,
        impactMagnitude: 0.005
      },
      {
        id: 'news-2',
        timestamp: Date.now() - 1800000,
        headline: 'NVIDIA CEO delivers keynote highlighting enterprise AI accelerator buildouts.',
        sentiment: 'bullish',
        impactSymbol: 'NVDA',
        impactMagnitude: 0.035
      },
      {
        id: 'news-3',
        timestamp: Date.now() - 600000,
        headline: 'Consumer spending beats quarterly estimates across prime retail and cloud sectors.',
        sentiment: 'bullish',
        impactSymbol: 'AMZN',
        impactMagnitude: 0.02
      }
    ];
  }

  start() {
    if (this.intervalId) return;
    this.isPaused = false;
    this.scheduleNextTick();
  }

  pause() {
    this.isPaused = true;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  setSpeed(speed) {
    this.simSpeed = Math.max(0.5, Math.min(10, speed));
    if (!this.isPaused) {
      if (this.intervalId) clearTimeout(this.intervalId);
      this.scheduleNextTick();
    }
  }

  scheduleNextTick() {
    const baseInterval = 1200;
    const delay = Math.max(120, Math.floor(baseInterval / this.simSpeed));

    this.intervalId = setTimeout(() => {
      this.runTick();
      if (!this.isPaused) {
        this.scheduleNextTick();
      }
    }, delay);
  }

  runTick() {
    this.tickCount++;
    this.marketSentiment += (Math.random() - 0.495) * 0.001;
    this.marketSentiment = Math.max(-0.015, Math.min(0.015, this.marketSentiment));

    let activeNews = null;
    if (this.tickCount % 35 === 0) {
      activeNews = this.triggerRandomNews();
    }

    const updatedTickBatch = [];
    for (const [symbol, stock] of this.stocks.entries()) {
      let newsImpact = 0;
      if (activeNews) {
        if (activeNews.impactSymbol === symbol) {
          newsImpact = activeNews.impactMagnitude;
        } else if (!activeNews.impactSymbol) {
          newsImpact = activeNews.impactMagnitude * 0.4;
        }
      }

      const tickResult = stock.tick(this.marketSentiment, newsImpact);
      updatedTickBatch.push(tickResult);
    }

    this.notifySubscribers(updatedTickBatch);
  }

  triggerRandomNews() {
    const stockList = Array.from(this.stocks.values());
    const targetStock = stockList[Math.floor(Math.random() * stockList.length)];
    
    const catalysts = [
      {
        headline: `${targetStock.name} (${targetStock.symbol}) announces blowout quarterly earnings, topping consensus by 18%.`,
        sentiment: 'bullish',
        symbol: targetStock.symbol,
        magnitude: 0.035 + Math.random() * 0.025
      },
      {
        headline: `Major institutional hedge fund initiates significant overweight position in ${targetStock.symbol}.`,
        sentiment: 'bullish',
        symbol: targetStock.symbol,
        magnitude: 0.02 + Math.random() * 0.015
      },
      {
        headline: `${targetStock.symbol} secures groundbreaking multi-year strategic enterprise partnership.`,
        sentiment: 'bullish',
        symbol: targetStock.symbol,
        magnitude: 0.025 + Math.random() * 0.02
      },
      {
        headline: `Regulatory scrutiny and antitrust review announced regarding ${targetStock.name}'s key platform services.`,
        sentiment: 'bearish',
        symbol: targetStock.symbol,
        magnitude: -(0.025 + Math.random() * 0.02)
      },
      {
        headline: `Supply chain bottlenecks expected to slightly temper guidance for ${targetStock.symbol} next quarter.`,
        sentiment: 'bearish',
        symbol: targetStock.symbol,
        magnitude: -(0.018 + Math.random() * 0.015)
      },
      {
        headline: `Global central banks report cooling inflation metrics; equity indices push higher across sectors.`,
        sentiment: 'bullish',
        symbol: null,
        magnitude: 0.012 + Math.random() * 0.01
      }
    ];

    const chosen = catalysts[Math.floor(Math.random() * catalysts.length)];
    const newsItem = {
      id: 'news-' + Date.now(),
      timestamp: Date.now(),
      headline: chosen.headline,
      sentiment: chosen.sentiment,
      impactSymbol: chosen.symbol,
      impactMagnitude: chosen.magnitude
    };

    this.newsHistory.unshift(newsItem);
    if (this.newsHistory.length > 20) this.newsHistory.pop();
    this.notifyNewsSubscribers(newsItem);
    return newsItem;
  }

  getOrderBook(symbol) {
    const stock = this.stocks.get(symbol.toUpperCase());
    if (!stock) return { bids: [], asks: [], spread: 0 };

    const price = stock.currentPrice;
    const spread = +(price * 0.0004 + 0.01).toFixed(2);
    const bestBid = +(price - (spread / 2)).toFixed(2);
    const bestAsk = +(price + (spread / 2)).toFixed(2);

    const bids = [];
    const asks = [];
    let cumBidVol = 0;
    let cumAskVol = 0;

    for (let i = 0; i < 5; i++) {
      const bidPrice = +(bestBid - (i * 0.05)).toFixed(2);
      const bidSize = Math.floor(Math.random() * 800 + 100) * 10;
      cumBidVol += bidSize;
      bids.push({ price: bidPrice, size: bidSize, total: cumBidVol });

      const askPrice = +(bestAsk + (i * 0.05)).toFixed(2);
      const askSize = Math.floor(Math.random() * 800 + 100) * 10;
      cumAskVol += askSize;
      asks.push({ price: askPrice, size: askSize, total: cumAskVol });
    }

    return { bids, asks, spread: +(bestAsk - bestBid).toFixed(2) };
  }

  getStock(symbol) {
    return this.stocks.get(symbol.toUpperCase()) || null;
  }

  getAllStocks() {
    return Array.from(this.stocks.values());
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  subscribeNews(callback) {
    this.newsSubscribers.add(callback);
    return () => this.newsSubscribers.delete(callback);
  }

  notifySubscribers(tickBatch) {
    for (const callback of this.subscribers) {
      try {
        callback(tickBatch, this.stocks);
      } catch (err) {
        console.error('Error in tick subscriber:', err);
      }
    }
  }

  notifyNewsSubscribers(newsItem) {
    for (const callback of this.newsSubscribers) {
      try {
        callback(newsItem);
      } catch (err) {
        console.error('Error in news subscriber:', err);
      }
    }
  }
}

// ==========================================
// 8. Persistence Manager Service
// ==========================================
class PersistenceManager {
  static STORAGE_KEY = 'STOCKS_SIM_USER_DATA_V2';

  static saveToStorage(user) {
    try {
      const serialized = JSON.stringify(user.toJSON());
      localStorage.setItem(this.STORAGE_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }

  static loadFromStorage() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;
      return User.fromJSON(JSON.parse(data));
    } catch {
      return null;
    }
  }

  static exportToFile(user, filename = null) {
    const data = {
      exportVersion: '2.0',
      exportedAt: new Date().toISOString(),
      user: user.toJSON()
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `stock_portfolio_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static importFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected.'));
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = JSON.parse(event.target.result);
          const userData = raw.user || raw;
          if (!userData.portfolio) throw new Error('Invalid portfolio backup file format.');
          const restoredUser = User.fromJSON(userData);
          this.saveToStorage(restoredUser);
          resolve(restoredUser);
        } catch (err) {
          reject(new Error('Failed to parse portfolio file: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('File reading error.'));
      reader.readAsText(file);
    });
  }

  static exportTransactionsCSV(transactions) {
    if (!transactions || transactions.length === 0) throw new Error('No transactions recorded yet to export.');
    const headers = ['Transaction ID', 'Date & Time', 'Symbol', 'Type', 'Shares', 'Price ($)', 'Total Amount ($)', 'Fee ($)', 'Realized P&L ($)'];
    const rows = transactions.map(tx => [
      `"${tx.id}"`,
      `"${new Date(tx.timestamp).toISOString()}"`,
      `"${tx.symbol}"`,
      `"${tx.type}"`,
      tx.shares,
      tx.price.toFixed(2),
      tx.totalAmount.toFixed(2),
      tx.fee.toFixed(2),
      tx.realizedPnL.toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade_history_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// ==========================================
// 9. Audio Service (Web Audio API)
// ==========================================
class AudioService {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  initContext() {
    if (!this.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
  }

  playBuy() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.001, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.3);
      });
    } catch {}
  }

  playSell() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [698.46, 880.00, 1046.50].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.001, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.04 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.32);
      });
    } catch {}
  }

  playError() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.15);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }
}

// ==========================================
// 10. Chart Engine
// ==========================================
class ChartEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = [];
    this.mode = 'candlestick';
    this.timeframe = '1M';
    this.showSMA = true;
    this.showEMA = false;
    this.showVolume = true;
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
    this.canvas.width = Math.max(300, rect.width * dpr);
    this.canvas.height = Math.max(200, rect.height * dpr);
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
    ctx.clearRect(0, 0, width, height);

    const bars = this.getFilteredData();
    if (bars.length < 2) {
      this.renderEmptyState();
      return;
    }

    const padding = { top: 25, right: 65, bottom: 45, left: 15 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const volumeH = this.showVolume ? chartH * 0.22 : 0;
    const priceH = chartH - volumeH;

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

    const getX = (index) => padding.left + (index / (bars.length - 1)) * chartW;
    const getY = (price) => padding.top + priceH - ((price - minPrice) / priceRange) * priceH;
    const getVolY = (vol) => padding.top + chartH - (vol / (maxVol || 1)) * volumeH;

    this.drawGrid(padding, chartW, chartH, priceH, minPrice, maxPrice, bars);

    if (this.showVolume) {
      this.drawVolume(bars, padding, chartW, chartH, getX, getVolY);
    }

    if (this.mode === 'candlestick') {
      this.drawCandlesticks(bars, chartW, getX, getY);
    } else {
      this.drawAreaLine(bars, padding, chartW, priceH, getX, getY);
    }

    if (this.showSMA) this.drawMovingAverage(bars, 20, '#f59e0b', getX, getY);
    if (this.showEMA) this.drawEMA(bars, 50, '#06b6d4', getX, getY);

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

    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const p = minPrice + (i / steps) * (maxPrice - minPrice);
      const y = padding.top + priceH - (i / steps) * priceH;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(`$${p.toFixed(2)}`, width - padding.right + 8, y);
    }

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
      const d = new Date(bar.timestamp);
      ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x, padding.top + chartH + 8);
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

      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });
  }

  drawAreaLine(bars, padding, chartW, priceH, getX, getY) {
    const { ctx } = this;
    if (bars.length < 2) return;
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + priceH);
    gradient.addColorStop(0, 'rgba(0, 230, 118, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 230, 118, 0.00)');

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(bars[0].close));
    for (let i = 1; i < bars.length; i++) ctx.lineTo(getX(i), getY(bars[i].close));
    ctx.lineTo(getX(bars.length - 1), padding.top + priceH);
    ctx.lineTo(getX(0), padding.top + priceH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(bars[0].close));
    for (let i = 1; i < bars.length; i++) ctx.lineTo(getX(i), getY(bars[i].close));
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
      for (let j = 0; j < period; j++) sum += bars[i - j].close;
      const sma = sum / period;
      const x = getX(i);
      const y = getY(sma);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
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

    const ratio = (mouse.x - padding.left) / chartW;
    const nearestIdx = Math.max(0, Math.min(bars.length - 1, Math.round(ratio * (bars.length - 1))));
    const bar = bars[nearestIdx];
    this.hoveredBar = bar;

    const snapX = getX(nearestIdx);
    const snapY = getY(bar.close);

    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(snapX, padding.top);
    ctx.lineTo(snapX, padding.top + chartH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(padding.left, mouse.y);
    ctx.lineTo(width - padding.right, mouse.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.arc(snapX, snapY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#00e676';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

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

// ==========================================
// 11. UI Controller
// ==========================================
class UIController {
  constructor({ user, market, audio, chartEngine }) {
    this.user = user;
    this.market = market;
    this.audio = audio;
    this.chartEngine = chartEngine;
    this.activeSymbol = 'AAPL';
    this.activeTradeTab = 'BUY';
    this.selectedSector = 'ALL';
    this.searchQuery = '';
    this.activeDashboardTab = 'holdings';

    this.initDOMReferences();
    this.bindEvents();
    this.initPerformanceChart();
    this.selectStock('AAPL');
    this.updateAll();
  }

  initDOMReferences() {
    this.elNetWorth = document.getElementById('hdr-net-worth');
    this.elCash = document.getElementById('hdr-cash');
    this.elDayPnL = document.getElementById('hdr-day-pnl');
    this.elTotalPnL = document.getElementById('hdr-total-pnl');
    this.elMarketStatus = document.getElementById('market-status-badge');
    this.elAudioBtn = document.getElementById('btn-toggle-sound');
    this.elSpeedBtns = document.querySelectorAll('.speed-btn');

    this.elTickerTrack = document.getElementById('ticker-track');

    this.elStockList = document.getElementById('stock-list-container');
    this.elSearchInput = document.getElementById('stock-search-input');
    this.elSectorFilter = document.getElementById('sector-filter');

    this.elActiveSymbol = document.getElementById('active-stock-symbol');
    this.elActiveName = document.getElementById('active-stock-name');
    this.elActiveSector = document.getElementById('active-stock-sector');
    this.elActivePrice = document.getElementById('active-stock-price');
    this.elActiveChange = document.getElementById('active-stock-change');
    this.elStatHigh = document.getElementById('stat-high');
    this.elStatLow = document.getElementById('stat-low');
    this.elStatVol = document.getElementById('stat-volume');
    this.elStatCap = document.getElementById('stat-market-cap');
    this.elStatPe = document.getElementById('stat-pe');

    this.elOrderBookBids = document.getElementById('order-book-bids');
    this.elOrderBookAsks = document.getElementById('order-book-asks');
    this.elOrderBookSpread = document.getElementById('order-book-spread');

    this.elTabBuy = document.getElementById('tab-btn-buy');
    this.elTabSell = document.getElementById('tab-btn-sell');
    this.elOrderType = document.getElementById('order-type-select');
    this.elLimitPriceGroup = document.getElementById('limit-price-group');
    this.elLimitPriceInput = document.getElementById('order-limit-price');
    this.elSharesInput = document.getElementById('order-shares-input');
    this.elQuickPercents = document.querySelectorAll('.quick-pct-btn');
    this.elEstimatedTotal = document.getElementById('order-estimated-total');
    this.elTradeBuyingPower = document.getElementById('trade-buying-power');
    this.elTradeSharesOwned = document.getElementById('trade-shares-owned');
    this.elSubmitTradeBtn = document.getElementById('btn-submit-order');
    this.elLimitOrdersContainer = document.getElementById('pending-orders-list');

    this.elDashTabs = document.querySelectorAll('.dash-nav-tab');
    this.elHoldingsTable = document.getElementById('holdings-tbody');
    this.elHistoryTable = document.getElementById('history-tbody');
    this.elNewsContainer = document.getElementById('news-feed-list');

    this.elPerfChartCanvas = document.getElementById('portfolio-perf-canvas');
    this.elAllocContainer = document.getElementById('asset-alloc-bars');
    this.elMetricWinRate = document.getElementById('metric-win-rate');
    this.elMetricRealized = document.getElementById('metric-realized-pnl');
    this.elMetricUnrealized = document.getElementById('metric-unrealized-pnl');
    this.elMetricTotalTrades = document.getElementById('metric-total-trades');

    this.elExportBtn = document.getElementById('btn-export-json');
    this.elExportCsvBtn = document.getElementById('btn-export-csv');
    this.elImportInput = document.getElementById('file-import-input');
    this.elResetBtn = document.getElementById('btn-reset-portfolio');
    this.elPresetCaps = document.querySelectorAll('.preset-cap-btn');
    this.elToastContainer = document.getElementById('toast-container');
  }

  bindEvents() {
    this.elSearchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderWatchlist();
    });

    this.elSectorFilter?.addEventListener('change', (e) => {
      this.selectedSector = e.target.value;
      this.renderWatchlist();
    });

    this.elAudioBtn?.addEventListener('click', () => {
      const isEnabled = !this.user.settings.soundEnabled;
      this.user.settings.soundEnabled = isEnabled;
      this.audio.setEnabled(isEnabled);
      this.elAudioBtn.classList.toggle('active', isEnabled);
      this.elAudioBtn.innerHTML = isEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      this.saveState();
      this.showToast(isEnabled ? 'Audio feedback enabled' : 'Audio muted', 'info');
    });

    this.elSpeedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.elSpeedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = btn.dataset.speed;
        if (speed === 'pause') {
          this.market.pause();
          this.elMarketStatus.className = 'status-badge paused';
          this.elMarketStatus.textContent = '⏸ PAUSED';
          this.showToast('Market simulation paused', 'info');
        } else {
          const numSpeed = parseFloat(speed);
          this.market.setSpeed(numSpeed);
          this.market.start();
          this.elMarketStatus.className = 'status-badge open';
          this.elMarketStatus.textContent = `🟢 LIVE (${numSpeed}x)`;
          this.showToast(`Simulation speed set to ${numSpeed}x`, 'info');
        }
      });
    });

    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.chartEngine.setTimeframe(btn.dataset.tf);
      });
    });

    document.querySelectorAll('.chart-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.chartEngine.setMode(btn.dataset.mode);
      });
    });

    document.getElementById('toggle-sma')?.addEventListener('change', (e) => {
      this.chartEngine.toggleSMA(e.target.checked);
    });
    document.getElementById('toggle-ema')?.addEventListener('change', (e) => {
      this.chartEngine.toggleEMA(e.target.checked);
    });

    this.elTabBuy?.addEventListener('click', () => this.setTradeTab('BUY'));
    this.elTabSell?.addEventListener('click', () => this.setTradeTab('SELL'));

    this.elOrderType?.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'MARKET') {
        this.elLimitPriceGroup.style.display = 'none';
      } else {
        this.elLimitPriceGroup.style.display = 'block';
        const stock = this.market.getStock(this.activeSymbol);
        if (stock && !this.elLimitPriceInput.value) {
          this.elLimitPriceInput.value = stock.currentPrice.toFixed(2);
        }
      }
      this.updateOrderSummary();
    });

    this.elSharesInput?.addEventListener('input', () => this.updateOrderSummary());
    this.elLimitPriceInput?.addEventListener('input', () => this.updateOrderSummary());

    this.elQuickPercents.forEach(btn => {
      btn.addEventListener('click', () => {
        const pct = parseFloat(btn.dataset.pct);
        this.applyQuickPercent(pct);
      });
    });

    this.elSubmitTradeBtn?.addEventListener('click', () => this.handleOrderSubmit());

    this.elDashTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.elDashTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeDashboardTab = tab.dataset.tab;

        document.querySelectorAll('.dash-panel').forEach(panel => {
          panel.classList.remove('active');
        });
        const targetPanel = document.getElementById(`panel-${this.activeDashboardTab}`);
        if (targetPanel) targetPanel.classList.add('active');

        if (this.activeDashboardTab === 'analytics') {
          this.renderPerformanceChart();
        }
      });
    });

    this.elExportBtn?.addEventListener('click', () => {
      PersistenceManager.exportToFile(this.user);
      this.showToast('Portfolio backup exported as JSON file', 'success');
    });

    this.elExportCsvBtn?.addEventListener('click', () => {
      try {
        PersistenceManager.exportTransactionsCSV(this.user.portfolio.transactions);
        this.showToast('Trade ledger exported as CSV', 'success');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    this.elImportInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const restoredUser = await PersistenceManager.importFromFile(file);
        this.user = restoredUser;
        this.updateAll();
        this.showToast('Portfolio successfully restored from file!', 'success');
        this.audio.playBuy();
      } catch (err) {
        this.showToast('Import failed: ' + err.message, 'error');
        this.audio.playError();
      }
      e.target.value = '';
    });

    this.elPresetCaps.forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = Number(btn.dataset.amount);
        if (confirm(`Reset portfolio with $${amount.toLocaleString()} initial cash? Current holdings will be cleared.`)) {
          this.user.portfolio.reset(amount);
          this.saveState();
          this.updateAll();
          this.showToast(`Portfolio reset to $${amount.toLocaleString()} cash`, 'info');
        }
      });
    });

    this.elResetBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to completely reset your simulation portfolio back to $100,000?')) {
        this.user.portfolio.reset(100000);
        this.saveState();
        this.updateAll();
        this.showToast('Portfolio reset to $100,000', 'info');
      }
    });

    this.market.subscribe((tickBatch, stockMap) => {
      this.onMarketTick(tickBatch, stockMap);
    });

    this.market.subscribeNews((newsItem) => {
      this.onNewsReceived(newsItem);
    });
  }

  selectStock(symbol) {
    this.activeSymbol = symbol.toUpperCase();
    const stock = this.market.getStock(this.activeSymbol);
    if (!stock) return;

    if (this.elActiveSymbol) this.elActiveSymbol.textContent = stock.symbol;
    if (this.elActiveName) this.elActiveName.textContent = stock.name;
    if (this.elActiveSector) this.elActiveSector.textContent = stock.sector;
    if (this.elActivePrice) this.elActivePrice.textContent = `$${stock.currentPrice.toFixed(2)}`;

    const change = stock.getDailyChange();
    if (this.elActiveChange) {
      this.elActiveChange.className = `stat-badge ${change.isPositive ? 'positive' : 'negative'}`;
      this.elActiveChange.textContent = `${change.isPositive ? '+' : ''}$${change.diff.toFixed(2)} (${change.isPositive ? '+' : ''}${change.percent}%)`;
    }

    if (this.elStatHigh) this.elStatHigh.textContent = `$${stock.highPrice.toFixed(2)}`;
    if (this.elStatLow) this.elStatLow.textContent = `$${stock.lowPrice.toFixed(2)}`;
    if (this.elStatVol) this.elStatVol.textContent = stock.volume.toLocaleString();
    if (this.elStatCap) this.elStatCap.textContent = stock.marketCap;
    if (this.elStatPe) this.elStatPe.textContent = stock.peRatio ? stock.peRatio.toFixed(1) : 'N/A';

    this.chartEngine.setData(stock.history);

    if (this.elOrderType && this.elOrderType.value !== 'MARKET' && this.elLimitPriceInput) {
      this.elLimitPriceInput.value = stock.currentPrice.toFixed(2);
    }
    this.updateOrderSummary();
    this.renderOrderBook();
    this.highlightActiveWatchlistItem();
  }

  setTradeTab(tab) {
    this.activeTradeTab = tab;
    if (tab === 'BUY') {
      this.elTabBuy.classList.add('active');
      this.elTabSell.classList.remove('active');
      this.elSubmitTradeBtn.className = 'btn-trade-submit buy';
      this.elSubmitTradeBtn.textContent = `Buy ${this.activeSymbol}`;
    } else {
      this.elTabSell.classList.add('active');
      this.elTabBuy.classList.remove('active');
      this.elSubmitTradeBtn.className = 'btn-trade-submit sell';
      this.elSubmitTradeBtn.textContent = `Sell ${this.activeSymbol}`;
    }
    this.updateOrderSummary();
  }

  applyQuickPercent(pct) {
    const stock = this.market.getStock(this.activeSymbol);
    if (!stock) return;

    const price = (this.elOrderType.value !== 'MARKET' && parseFloat(this.elLimitPriceInput.value)) 
      ? parseFloat(this.elLimitPriceInput.value) 
      : stock.currentPrice;

    if (this.activeTradeTab === 'BUY') {
      const availableCash = this.user.portfolio.getAvailableCash();
      const budget = availableCash * (pct / 100);
      const shares = Math.max(0, Math.floor(budget / price));
      this.elSharesInput.value = shares > 0 ? shares : (availableCash >= price ? 1 : 0);
    } else {
      const pos = this.user.portfolio.getPosition(this.activeSymbol);
      const owned = pos ? pos.shares : 0;
      const shares = Math.floor(owned * (pct / 100));
      this.elSharesInput.value = shares;
    }

    this.updateOrderSummary();
  }

  updateOrderSummary() {
    const stock = this.market.getStock(this.activeSymbol);
    if (!stock) return;

    const shares = parseInt(this.elSharesInput?.value || '0', 10);
    const isLimit = this.elOrderType?.value !== 'MARKET';
    const unitPrice = isLimit ? (parseFloat(this.elLimitPriceInput?.value) || stock.currentPrice) : stock.currentPrice;

    const totalCost = +(shares * unitPrice).toFixed(2);
    if (this.elEstimatedTotal) {
      this.elEstimatedTotal.textContent = `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const availableCash = this.user.portfolio.getAvailableCash();
    const pos = this.user.portfolio.getPosition(this.activeSymbol);
    const ownedShares = pos ? pos.shares : 0;

    if (this.elTradeBuyingPower) {
      this.elTradeBuyingPower.textContent = `$${availableCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (this.elTradeSharesOwned) {
      this.elTradeSharesOwned.textContent = `${ownedShares} shares ($${(ownedShares * stock.currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
  }

  handleOrderSubmit() {
    const stock = this.market.getStock(this.activeSymbol);
    if (!stock) return;

    const shares = parseInt(this.elSharesInput.value, 10);
    if (!shares || shares <= 0) {
      this.showToast('Please enter a valid share quantity.', 'warning');
      this.audio.playError();
      return;
    }

    const orderType = this.elOrderType.value;
    const limitPrice = parseFloat(this.elLimitPriceInput.value);

    try {
      if (orderType === 'MARKET') {
        if (this.activeTradeTab === 'BUY') {
          const tx = this.user.portfolio.buy(stock.symbol, shares, stock.currentPrice);
          this.audio.playBuy();
          this.showToast(`Bought ${shares} shares of ${stock.symbol} at $${stock.currentPrice.toFixed(2)}`, 'success');
        } else {
          const tx = this.user.portfolio.sell(stock.symbol, shares, stock.currentPrice);
          this.audio.playSell();
          const pnlText = tx.realizedPnL >= 0 ? `+$${tx.realizedPnL.toFixed(2)} gain` : `-$${Math.abs(tx.realizedPnL).toFixed(2)} loss`;
          this.showToast(`Sold ${shares} shares of ${stock.symbol} at $${stock.currentPrice.toFixed(2)} (${pnlText})`, 'success');
        }
      } else {
        if (!limitPrice || limitPrice <= 0) throw new Error('Please enter a valid target trigger price.');
        const newOrder = new Order({
          symbol: stock.symbol,
          type: this.activeTradeTab,
          orderType: orderType,
          shares: shares,
          targetPrice: limitPrice
        });
        this.user.portfolio.placeOrder(newOrder);
        this.showToast(`Placed ${orderType} ${this.activeTradeTab} for ${shares} ${stock.symbol} @ $${limitPrice.toFixed(2)}`, 'info');
      }

      this.elSharesInput.value = '';
      this.saveState();
      this.updateAll();
    } catch (err) {
      this.audio.playError();
      this.showToast(err.message, 'error');
    }
  }

  onMarketTick(tickBatch, stockMap) {
    const executedFills = this.user.portfolio.processPendingOrders(stockMap);
    if (executedFills.length > 0) {
      for (const fill of executedFills) {
        this.audio.playBuy();
        this.showToast(`Limit order filled: ${fill.order.type} ${fill.order.shares} ${fill.order.symbol} @ $${fill.transaction.price.toFixed(2)}!`, 'success');
      }
      this.saveState();
    }

    this.user.portfolio.recordSnapshot(stockMap);

    const activeTick = tickBatch.find(t => t.symbol === this.activeSymbol);
    if (activeTick) {
      const stock = this.market.getStock(this.activeSymbol);
      if (stock) {
        this.elActivePrice.textContent = `$${stock.currentPrice.toFixed(2)}`;
        const flashClass = activeTick.diff >= 0 ? 'flash-up' : 'flash-down';
        this.elActivePrice.classList.remove('flash-up', 'flash-down');
        void this.elActivePrice.offsetWidth;
        this.elActivePrice.classList.add(flashClass);

        const change = stock.getDailyChange();
        this.elActiveChange.className = `stat-badge ${change.isPositive ? 'positive' : 'negative'}`;
        this.elActiveChange.textContent = `${change.isPositive ? '+' : ''}$${change.diff.toFixed(2)} (${change.isPositive ? '+' : ''}${change.percent}%)`;
        
        this.elStatHigh.textContent = `$${stock.highPrice.toFixed(2)}`;
        this.elStatLow.textContent = `$${stock.lowPrice.toFixed(2)}`;
        this.elStatVol.textContent = stock.volume.toLocaleString();
        this.chartEngine.setData(stock.history);
        this.renderOrderBook();
      }
    }

    this.renderHeaderStats();
    this.updateWatchlistPrices();
    this.renderHoldingsTable();
    this.updateOrderSummary();

    if (this.activeDashboardTab === 'analytics') {
      this.renderPerformanceChart();
    }
  }

  onNewsReceived(newsItem) {
    this.renderNewsFeed();
    this.showToast(`📰 News: ${newsItem.headline.slice(0, 60)}...`, 'info');
  }

  renderHeaderStats() {
    const stockMap = this.market.stocks;
    const netWorth = this.user.portfolio.getTotalPortfolioValue(stockMap);
    const cash = this.user.portfolio.cashBalance;
    const dayPnL = this.user.portfolio.getDailyPnL(stockMap);
    const totalPnL = this.user.portfolio.getTotalPnL(stockMap);
    const totalPnLPct = this.user.portfolio.getTotalPnLPercent(stockMap);

    if (this.elNetWorth) {
      this.elNetWorth.textContent = `$${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (this.elCash) {
      this.elCash.textContent = `$${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (this.elDayPnL) {
      const isPos = dayPnL >= 0;
      this.elDayPnL.className = `stat-num ${isPos ? 'green' : 'red'}`;
      this.elDayPnL.textContent = `${isPos ? '+' : ''}$${dayPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (this.elTotalPnL) {
      const isPos = totalPnL >= 0;
      this.elTotalPnL.className = `stat-num ${isPos ? 'green' : 'red'}`;
      this.elTotalPnL.textContent = `${isPos ? '+' : ''}$${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${isPos ? '+' : ''}${totalPnLPct}%)`;
    }
  }

  renderTickerTape() {
    if (!this.elTickerTrack) return;
    const stocks = this.market.getAllStocks();
    const items = [...stocks, ...stocks];

    this.elTickerTrack.innerHTML = items.map(s => {
      const chg = s.getDailyChange();
      const colorCls = chg.isPositive ? 'green' : 'red';
      return `
        <div class="ticker-item" data-symbol="${s.symbol}">
          <span class="ticker-symbol">${s.symbol}</span>
          <span class="ticker-price">$${s.currentPrice.toFixed(2)}</span>
          <span class="ticker-chg ${colorCls}">${chg.isPositive ? '▲' : '▼'} ${chg.percent}%</span>
        </div>
      `;
    }).join('');

    this.elTickerTrack.querySelectorAll('.ticker-item').forEach(el => {
      el.addEventListener('click', () => {
        this.selectStock(el.dataset.symbol);
      });
    });
  }

  renderWatchlist() {
    if (!this.elStockList) return;
    let stocks = this.market.getAllStocks();

    if (this.selectedSector !== 'ALL') {
      stocks = stocks.filter(s => s.sector.toLowerCase().includes(this.selectedSector.toLowerCase()));
    }

    if (this.searchQuery) {
      stocks = stocks.filter(s => 
        s.symbol.toLowerCase().includes(this.searchQuery) || 
        s.name.toLowerCase().includes(this.searchQuery)
      );
    }

    this.elStockList.innerHTML = stocks.map(stock => {
      const isFav = this.user.isInWatchlist(stock.symbol);
      const chg = stock.getDailyChange();
      const isPos = chg.isPositive;
      const isActive = stock.symbol === this.activeSymbol;
      const sparkSvg = this.generateSparklineSvg(stock.sparkline, isPos);

      return `
        <div class="stock-item ${isActive ? 'active' : ''}" data-symbol="${stock.symbol}">
          <button class="star-btn ${isFav ? 'starred' : ''}" data-fav="${stock.symbol}" title="Toggle Watchlist">★</button>
          <div class="stock-info">
            <span class="symbol">${stock.symbol}</span>
            <span class="name">${stock.name}</span>
          </div>
          <div class="sparkline-wrapper">${sparkSvg}</div>
          <div class="stock-price-col">
            <span class="price" id="watch-price-${stock.symbol}">$${stock.currentPrice.toFixed(2)}</span>
            <span class="chg ${isPos ? 'green' : 'red'}" id="watch-chg-${stock.symbol}">
              ${isPos ? '+' : ''}${chg.percent}%
            </span>
          </div>
        </div>
      `;
    }).join('');

    this.elStockList.querySelectorAll('.stock-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.star-btn')) return;
        this.selectStock(el.dataset.symbol);
      });
    });

    this.elStockList.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = btn.dataset.fav;
        const nowIn = this.user.toggleWatchlist(sym);
        btn.classList.toggle('starred', nowIn);
        this.saveState();
        this.showToast(`${sym} ${nowIn ? 'added to' : 'removed from'} favorites`, 'info');
      });
    });
  }

  updateWatchlistPrices() {
    for (const stock of this.market.getAllStocks()) {
      const priceEl = document.getElementById(`watch-price-${stock.symbol}`);
      const chgEl = document.getElementById(`watch-chg-${stock.symbol}`);
      if (priceEl && chgEl) {
        priceEl.textContent = `$${stock.currentPrice.toFixed(2)}`;
        const chg = stock.getDailyChange();
        chgEl.className = `chg ${chg.isPositive ? 'green' : 'red'}`;
        chgEl.textContent = `${chg.isPositive ? '+' : ''}${chg.percent}%`;
      }
    }
  }

  highlightActiveWatchlistItem() {
    this.elStockList?.querySelectorAll('.stock-item').forEach(el => {
      el.classList.toggle('active', el.dataset.symbol === this.activeSymbol);
    });
  }

  generateSparklineSvg(points, isPositive) {
    if (!points || points.length < 2) return '';
    const w = 60;
    const h = 24;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = (max - min) || 1;

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const stroke = isPositive ? '#00e676' : '#ff3b57';
    return `<svg width="${w}" height="${h}" class="sparkline"><polyline fill="none" stroke="${stroke}" stroke-width="1.6" points="${coords}" /></svg>`;
  }

  renderOrderBook() {
    const book = this.market.getOrderBook(this.activeSymbol);
    if (this.elOrderBookSpread) {
      this.elOrderBookSpread.textContent = `Spread: $${book.spread.toFixed(2)}`;
    }

    if (this.elOrderBookBids) {
      this.elOrderBookBids.innerHTML = book.bids.map(b => `
        <div class="book-row bid">
          <span class="price">$${b.price.toFixed(2)}</span>
          <span class="size">${b.size}</span>
          <span class="total">${b.total}</span>
        </div>
      `).join('');
    }

    if (this.elOrderBookAsks) {
      this.elOrderBookAsks.innerHTML = book.asks.map(a => `
        <div class="book-row ask">
          <span class="price">$${a.price.toFixed(2)}</span>
          <span class="size">${a.size}</span>
          <span class="total">${a.total}</span>
        </div>
      `).join('');
    }
  }

  renderHoldingsTable() {
    if (!this.elHoldingsTable) return;
    const positions = Array.from(this.user.portfolio.positions.values()).filter(p => p.shares > 0);
    const stockMap = this.market.stocks;
    const totalPortfolioVal = this.user.portfolio.getTotalPortfolioValue(stockMap);

    if (positions.length === 0) {
      this.elHoldingsTable.innerHTML = `
        <tr>
          <td colspan="9" class="empty-table-msg">
            No open stock positions. Select an asset on the left and execute your first trade!
          </td>
        </tr>
      `;
      return;
    }

    this.elHoldingsTable.innerHTML = positions.map(pos => {
      const stock = stockMap.get(pos.symbol);
      const curPrice = stock ? stock.currentPrice : pos.averagePrice;
      const marketVal = pos.getMarketValue(curPrice);
      const unPnL = pos.getUnrealizedPnL(curPrice);
      const unPnLPct = pos.getUnrealizedPnLPercent(curPrice);
      const allocPct = totalPortfolioVal > 0 ? ((marketVal / totalPortfolioVal) * 100).toFixed(1) : 0;
      const isPos = unPnL >= 0;

      return `
        <tr class="clickable-row" data-symbol="${pos.symbol}">
          <td>
            <div class="td-symbol">
              <span class="sym-badge">${pos.symbol}</span>
              <span class="sym-name">${stock ? stock.name : ''}</span>
            </div>
          </td>
          <td>${pos.shares.toLocaleString()}</td>
          <td>$${pos.averagePrice.toFixed(2)}</td>
          <td>$${curPrice.toFixed(2)}</td>
          <td><strong>$${marketVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
          <td class="${isPos ? 'green' : 'red'}">
            ${isPos ? '+' : ''}$${unPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td class="${isPos ? 'green' : 'red'}">
            ${isPos ? '+' : ''}${unPnLPct}%
          </td>
          <td>
            <div class="alloc-bar-wrapper">
              <div class="alloc-bar-fill" style="width: ${Math.min(100, allocPct)}%"></div>
              <span>${allocPct}%</span>
            </div>
          </td>
          <td>
            <button class="btn-quick-sell" data-symbol="${pos.symbol}" data-shares="${pos.shares}">
              Sell
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.elHoldingsTable.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-quick-sell')) return;
        this.selectStock(row.dataset.symbol);
      });
    });

    this.elHoldingsTable.querySelectorAll('.btn-quick-sell').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = btn.dataset.symbol;
        const shares = parseInt(btn.dataset.shares, 10);
        this.selectStock(sym);
        this.setTradeTab('SELL');
        this.elSharesInput.value = shares;
        this.updateOrderSummary();
        this.showToast(`Prepared to sell ${shares} shares of ${sym}`, 'info');
      });
    });

    this.renderPendingOrders();
  }

  renderPendingOrders() {
    if (!this.elLimitOrdersContainer) return;
    const orders = this.user.portfolio.pendingOrders;

    if (orders.length === 0) {
      this.elLimitOrdersContainer.innerHTML = '<div class="empty-orders-note">No active pending limit orders.</div>';
      return;
    }

    this.elLimitOrdersContainer.innerHTML = orders.map(ord => `
      <div class="order-chip">
        <span class="chip-type ${ord.type.toLowerCase()}">${ord.orderType} ${ord.type}</span>
        <span class="chip-sym">${ord.symbol}</span>
        <span class="chip-qty">${ord.shares} shs @ $${ord.targetPrice.toFixed(2)}</span>
        <button class="chip-cancel-btn" data-order-id="${ord.id}" title="Cancel Order">✕</button>
      </div>
    `).join('');

    this.elLimitOrdersContainer.querySelectorAll('.chip-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.orderId;
        if (this.user.portfolio.cancelOrder(id)) {
          this.saveState();
          this.renderPendingOrders();
          this.renderHeaderStats();
          this.updateOrderSummary();
          this.showToast('Order cancelled. Reserved funds refunded.', 'info');
        }
      });
    });
  }

  renderHistoryTable() {
    if (!this.elHistoryTable) return;
    const transactions = this.user.portfolio.transactions;

    if (transactions.length === 0) {
      this.elHistoryTable.innerHTML = `
        <tr>
          <td colspan="8" class="empty-table-msg">No trades executed yet. Place an order above to build your ledger.</td>
        </tr>
      `;
      return;
    }

    this.elHistoryTable.innerHTML = transactions.map(tx => {
      const isBuy = tx.type === 'BUY';
      const pnlDisplay = tx.type === 'SELL' 
        ? `<span class="${tx.realizedPnL >= 0 ? 'green' : 'red'}">${tx.realizedPnL >= 0 ? '+' : ''}$${tx.realizedPnL.toFixed(2)}</span>`
        : '<span class="text-muted">—</span>';

      return `
        <tr>
          <td><span class="tx-id">${tx.id}</span></td>
          <td>${tx.getFormattedDate()}</td>
          <td><strong>${tx.symbol}</strong></td>
          <td><span class="badge-tx ${isBuy ? 'buy' : 'sell'}">${tx.type}</span></td>
          <td>${tx.shares.toLocaleString()}</td>
          <td>$${tx.price.toFixed(2)}</td>
          <td>$${tx.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td>${pnlDisplay}</td>
        </tr>
      `;
    }).join('');
  }

  renderNewsFeed() {
    if (!this.elNewsContainer) return;
    const news = this.market.newsHistory;

    this.elNewsContainer.innerHTML = news.map(item => {
      const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const badgeCls = item.sentiment === 'bullish' ? 'bullish' : (item.sentiment === 'bearish' ? 'bearish' : 'neutral');

      return `
        <div class="news-card">
          <div class="news-meta">
            <span class="news-badge ${badgeCls}">${item.sentiment.toUpperCase()}</span>
            ${item.impactSymbol ? `<span class="news-tag">${item.impactSymbol}</span>` : '<span class="news-tag">MACRO</span>'}
            <span class="news-time">${dateStr}</span>
          </div>
          <p class="news-headline">${item.headline}</p>
        </div>
      `;
    }).join('');
  }

  initPerformanceChart() {
    if (!this.elPerfChartCanvas) return;
    this.perfCtx = this.elPerfChartCanvas.getContext('2d');
    this.resizePerfCanvas();
    window.addEventListener('resize', () => {
      this.resizePerfCanvas();
      this.renderPerformanceChart();
    });
  }

  resizePerfCanvas() {
    if (!this.elPerfChartCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.elPerfChartCanvas.getBoundingClientRect();
    this.elPerfChartCanvas.width = Math.max(300, rect.width * dpr);
    this.elPerfChartCanvas.height = Math.max(160, rect.height * dpr);
    this.perfCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.perfChartWidth = rect.width;
    this.perfChartHeight = rect.height;
  }

  renderPerformanceChart() {
    if (!this.perfCtx || !this.perfChartWidth) return;
    const ctx = this.perfCtx;
    const w = this.perfChartWidth;
    const h = this.perfChartHeight;
    ctx.clearRect(0, 0, w, h);

    const snapshots = this.user.portfolio.performanceSnapshots;
    if (!snapshots || snapshots.length < 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Accumulating performance time-series data...', w / 2, h / 2);
      return;
    }

    const padding = { top: 20, right: 60, bottom: 30, left: 20 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const values = snapshots.map(s => s.totalValue);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    const buffer = (maxVal - minVal) * 0.1 || 100;
    minVal -= buffer;
    maxVal += buffer;

    const getX = (i) => padding.left + (i / (snapshots.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

    const baselineY = getY(this.user.portfolio.initialCapital);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, baselineY);
    ctx.lineTo(w - padding.right, baselineY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`Base: $${this.user.portfolio.initialCapital.toLocaleString()}`, w - padding.right + 6, baselineY + 3);
    ctx.restore();

    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    const isProfitable = snapshots[snapshots.length - 1].totalValue >= this.user.portfolio.initialCapital;
    const themeColor = isProfitable ? '#00e676' : '#ff3b57';
    grad.addColorStop(0, isProfitable ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 59, 87, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(snapshots[0].totalValue));
    for (let i = 1; i < snapshots.length; i++) ctx.lineTo(getX(i), getY(snapshots[i].totalValue));
    ctx.lineTo(getX(snapshots.length - 1), padding.top + chartH);
    ctx.lineTo(getX(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(snapshots[0].totalValue));
    for (let i = 1; i < snapshots.length; i++) ctx.lineTo(getX(i), getY(snapshots[i].totalValue));
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 6;
    ctx.stroke();

    this.renderAnalyticsMetrics();
  }

  renderAnalyticsMetrics() {
    const txs = this.user.portfolio.transactions;
    const sellTxs = txs.filter(t => t.type === 'SELL');
    const winningTrades = sellTxs.filter(t => t.realizedPnL > 0);
    const winRate = sellTxs.length > 0 ? ((winningTrades.length / sellTxs.length) * 100).toFixed(1) : 0;

    let totalRealized = 0;
    for (const st of sellTxs) totalRealized += st.realizedPnL;

    const stockMap = this.market.stocks;
    let totalUnrealized = 0;
    for (const pos of this.user.portfolio.positions.values()) {
      const stock = stockMap.get(pos.symbol);
      const curPrice = stock ? stock.currentPrice : pos.averagePrice;
      totalUnrealized += pos.getUnrealizedPnL(curPrice);
    }

    if (this.elMetricWinRate) this.elMetricWinRate.textContent = `${winRate}% (${winningTrades.length}/${sellTxs.length})`;
    if (this.elMetricRealized) {
      this.elMetricRealized.className = `metric-val ${totalRealized >= 0 ? 'green' : 'red'}`;
      this.elMetricRealized.textContent = `${totalRealized >= 0 ? '+' : ''}$${totalRealized.toFixed(2)}`;
    }
    if (this.elMetricUnrealized) {
      this.elMetricUnrealized.className = `metric-val ${totalUnrealized >= 0 ? 'green' : 'red'}`;
      this.elMetricUnrealized.textContent = `${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`;
    }
    if (this.elMetricTotalTrades) this.elMetricTotalTrades.textContent = `${txs.length} trades`;

    if (this.elAllocContainer) {
      const positions = Array.from(this.user.portfolio.positions.values()).filter(p => p.shares > 0);
      const totalPortfolioVal = this.user.portfolio.getTotalPortfolioValue(stockMap);
      const cashPct = totalPortfolioVal > 0 ? ((this.user.portfolio.cashBalance / totalPortfolioVal) * 100).toFixed(1) : 100;

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
      let barsHtml = `
        <div class="alloc-item">
          <span class="alloc-label">Cash ($${this.user.portfolio.cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
          <div class="alloc-bar-bg"><div class="alloc-bar-fill" style="width: ${cashPct}%; background: #64748b;"></div></div>
          <span class="alloc-pct">${cashPct}%</span>
        </div>
      `;

      positions.forEach((pos, idx) => {
        const stock = stockMap.get(pos.symbol);
        const curPrice = stock ? stock.currentPrice : pos.averagePrice;
        const val = pos.getMarketValue(curPrice);
        const pct = totalPortfolioVal > 0 ? ((val / totalPortfolioVal) * 100).toFixed(1) : 0;
        const color = colors[idx % colors.length];

        barsHtml += `
          <div class="alloc-item">
            <span class="alloc-label">${pos.symbol} ($${val.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
            <div class="alloc-bar-bg"><div class="alloc-bar-fill" style="width: ${pct}%; background: ${color};"></div></div>
            <span class="alloc-pct">${pct}%</span>
          </div>
        `;
      });

      this.elAllocContainer.innerHTML = barsHtml;
    }
  }

  showToast(message, type = 'info') {
    if (!this.elToastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-text">${message}</span>`;
    this.elToastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  saveState() {
    PersistenceManager.saveToStorage(this.user);
  }

  updateAll() {
    this.renderHeaderStats();
    this.renderTickerTape();
    this.renderWatchlist();
    this.renderHoldingsTable();
    this.renderHistoryTable();
    this.renderNewsFeed();
    this.selectStock(this.activeSymbol);
  }
}

// ==========================================
// 12. App Bootstrap
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const market = new MarketEngine();

  let user = PersistenceManager.loadFromStorage();
  if (!user) {
    user = new User({
      name: 'Alex Hunter',
      settings: {
        soundEnabled: true,
        simSpeed: 1,
        isPaused: false
      }
    });

    const initialAapl = market.getStock('AAPL');
    const initialNvda = market.getStock('NVDA');
    if (initialAapl) {
      user.portfolio.buy('AAPL', 15, +(initialAapl.currentPrice * 0.98).toFixed(2));
    }
    if (initialNvda) {
      user.portfolio.buy('NVDA', 25, +(initialNvda.currentPrice * 0.97).toFixed(2));
    }
    user.portfolio.recordSnapshot(market.stocks);
    PersistenceManager.saveToStorage(user);
  }

  const audio = new AudioService();
  audio.setEnabled(user.settings.soundEnabled);

  const canvas = document.getElementById('main-stock-canvas');
  const chartEngine = new ChartEngine(canvas);

  const ui = new UIController({
    user,
    market,
    audio,
    chartEngine
  });

  market.start();

  window.addEventListener('beforeunload', () => {
    PersistenceManager.saveToStorage(user);
  });

  console.log('🚀 ApexTrader Pro successfully initialized with OOP architecture.');
});
