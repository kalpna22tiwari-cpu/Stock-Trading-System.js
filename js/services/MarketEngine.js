import { Stock } from '../models/Stock.js';

/**
 * Market Engine Service
 * Manages the financial exchange simulation, stock asset universe,
 * real-time tick cycles, macroeconomic market sentiment, breaking news catalysts,
 * and order book depth.
 */
export class MarketEngine {
  constructor() {
    /** @type {Map<string, Stock>} */
    this.stocks = new Map();
    this.subscribers = new Set();
    this.newsSubscribers = new Set();
    
    // Macro sentiment between -0.01 (bearish) and +0.01 (bullish)
    this.marketSentiment = 0.001;
    this.simSpeed = 1; // 1x, 2x, 5x, 10x
    this.isPaused = false;
    this.intervalId = null;
    this.tickCount = 0;

    // Simulated breaking news history
    this.newsHistory = [];

    // Initialize stock asset universe
    this.initDefaultUniverse();
    this.generateInitialNews();
  }

  /**
   * Initializes diverse stock universe across major sectors
   */
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

  /**
   * Starts the simulation clock loop
   */
  start() {
    if (this.intervalId) return;
    this.isPaused = false;
    this.scheduleNextTick();
  }

  /**
   * Pauses the simulation clock
   */
  pause() {
    this.isPaused = true;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Adjusts simulation speed (1x, 2x, 5x, 10x)
   * @param {number} speed
   */
  setSpeed(speed) {
    this.simSpeed = Math.max(0.5, Math.min(10, speed));
    if (!this.isPaused) {
      if (this.intervalId) clearTimeout(this.intervalId);
      this.scheduleNextTick();
    }
  }

  scheduleNextTick() {
    const baseInterval = 1200; // ms per tick at 1x
    const delay = Math.max(120, Math.floor(baseInterval / this.simSpeed));

    this.intervalId = setTimeout(() => {
      this.runTick();
      if (!this.isPaused) {
        this.scheduleNextTick();
      }
    }, delay);
  }

  /**
   * Executes a single market simulation tick
   */
  runTick() {
    this.tickCount++;

    // Slowly drift market sentiment
    this.marketSentiment += (Math.random() - 0.495) * 0.001;
    this.marketSentiment = Math.max(-0.015, Math.min(0.015, this.marketSentiment));

    // Periodically trigger a breaking news catalyst (approx every 35 ticks)
    let activeNews = null;
    if (this.tickCount % 35 === 0) {
      activeNews = this.triggerRandomNews();
    }

    const updatedTickBatch = [];

    // Tick each stock
    for (const [symbol, stock] of this.stocks.entries()) {
      let newsImpact = 0;
      if (activeNews) {
        if (activeNews.impactSymbol === symbol) {
          newsImpact = activeNews.impactMagnitude;
        } else if (!activeNews.impactSymbol) {
          // Market-wide news
          newsImpact = activeNews.impactMagnitude * 0.4;
        }
      }

      const tickResult = stock.tick(this.marketSentiment, newsImpact);
      updatedTickBatch.push(tickResult);
    }

    // Broadcast tick batch to all subscribers (UI controller, portfolio evaluator)
    this.notifySubscribers(updatedTickBatch);
  }

  /**
   * Generates dynamic financial breaking news
   */
  triggerRandomNews() {
    const stockList = Array.from(this.stocks.values());
    const targetStock = stockList[Math.floor(Math.random() * stockList.length)];
    
    const catalysts = [
      {
        headline: `${targetStock.name} (${targetStock.symbol}) announces blowout quarterly earnings, topping Wall St. consensus by 18%.`,
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
        headline: `${targetStock.symbol} secures groundbreaking multi-year strategic enterprise enterprise partnership.`,
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
        magnitude: -(0.018 + Math.random() * 0.015
        )
      },
      {
        headline: `Global central banks report cooling inflation metrics; equity indices push higher across sectors.`,
        sentiment: 'bullish',
        symbol: null,
        magnitude: 0.012 + Math.random() * 0.01
      },
      {
        headline: `Bond yields climb to multi-month highs, exerting modest downward pressure on tech multiples.`,
        sentiment: 'bearish',
        symbol: null,
        magnitude: -(0.012 + Math.random() * 0.008)
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
    if (this.newsHistory.length > 20) {
      this.newsHistory.pop();
    }

    this.notifyNewsSubscribers(newsItem);
    return newsItem;
  }

  /**
   * Generates realistic simulated Level 2 Order Book Depth for active stock
   * @param {string} symbol
   */
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
        console.error('Error in market tick subscriber:', err);
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
