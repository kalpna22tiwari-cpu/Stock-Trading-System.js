import { Order } from '../models/Order.js';
import { PersistenceManager } from '../services/PersistenceManager.js';

/**
 * UIController
 * Central reactive controller coordinating UI updates, user interactions,
 * real-time ticker renders, order submissions, and portfolio analytics charts.
 */
export class UIController {
  /**
   * @param {Object} options
   * @param {import('../models/User.js').User} options.user
   * @param {import('../services/MarketEngine.js').MarketEngine} options.market
   * @param {import('../services/AudioService.js').AudioService} options.audio
   * @param {import('./ChartEngine.js').ChartEngine} options.chartEngine
   */
  constructor({ user, market, audio, chartEngine }) {
    this.user = user;
    this.market = market;
    this.audio = audio;
    this.chartEngine = chartEngine;

    // Active stock selected for viewing and trading
    this.activeSymbol = 'AAPL';
    this.activeTradeTab = 'BUY'; // 'BUY' | 'SELL'
    this.selectedSector = 'ALL';
    this.searchQuery = '';
    this.activeDashboardTab = 'holdings'; // 'holdings' | 'analytics' | 'history' | 'news' | 'settings'

    this.initDOMReferences();
    this.bindEvents();
    this.initPerformanceChart();
    this.selectStock('AAPL');
    this.updateAll();
  }

  initDOMReferences() {
    // Header summary elements
    this.elNetWorth = document.getElementById('hdr-net-worth');
    this.elCash = document.getElementById('hdr-cash');
    this.elDayPnL = document.getElementById('hdr-day-pnl');
    this.elTotalPnL = document.getElementById('hdr-total-pnl');
    this.elMarketStatus = document.getElementById('market-status-badge');
    this.elAudioBtn = document.getElementById('btn-toggle-sound');
    this.elSpeedBtns = document.querySelectorAll('.speed-btn');

    // Ticker Tape
    this.elTickerTrack = document.getElementById('ticker-track');

    // Watchlist & Screener
    this.elStockList = document.getElementById('stock-list-container');
    this.elSearchInput = document.getElementById('stock-search-input');
    this.elSectorFilter = document.getElementById('sector-filter');

    // Active Stock Details
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

    // Order Book
    this.elOrderBookBids = document.getElementById('order-book-bids');
    this.elOrderBookAsks = document.getElementById('order-book-asks');
    this.elOrderBookSpread = document.getElementById('order-book-spread');

    // Trading Terminal
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

    // Dashboard Tabs
    this.elDashTabs = document.querySelectorAll('.dash-nav-tab');
    this.elHoldingsTable = document.getElementById('holdings-tbody');
    this.elHistoryTable = document.getElementById('history-tbody');
    this.elNewsContainer = document.getElementById('news-feed-list');

    // Analytics elements
    this.elPerfChartCanvas = document.getElementById('portfolio-perf-canvas');
    this.elAllocContainer = document.getElementById('asset-alloc-bars');
    this.elMetricWinRate = document.getElementById('metric-win-rate');
    this.elMetricRealized = document.getElementById('metric-realized-pnl');
    this.elMetricUnrealized = document.getElementById('metric-unrealized-pnl');
    this.elMetricTotalTrades = document.getElementById('metric-total-trades');

    // Data Management
    this.elExportBtn = document.getElementById('btn-export-json');
    this.elExportCsvBtn = document.getElementById('btn-export-csv');
    this.elImportInput = document.getElementById('file-import-input');
    this.elResetBtn = document.getElementById('btn-reset-portfolio');
    this.elPresetCaps = document.querySelectorAll('.preset-cap-btn');

    // Toast Container
    this.elToastContainer = document.getElementById('toast-container');
  }

  bindEvents() {
    // Search & Filter
    this.elSearchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderWatchlist();
    });

    this.elSectorFilter?.addEventListener('change', (e) => {
      this.selectedSector = e.target.value;
      this.renderWatchlist();
    });

    // Sound toggle
    this.elAudioBtn?.addEventListener('click', () => {
      const isEnabled = !this.user.settings.soundEnabled;
      this.user.settings.soundEnabled = isEnabled;
      this.audio.setEnabled(isEnabled);
      this.elAudioBtn.classList.toggle('active', isEnabled);
      this.elAudioBtn.innerHTML = isEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      this.saveState();
      this.showToast(isEnabled ? 'Audio feedback enabled' : 'Audio muted', 'info');
    });

    // Simulation Speed controls
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

    // Chart timeframe controls
    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.chartEngine.setTimeframe(btn.dataset.tf);
      });
    });

    // Chart mode controls (Candle vs Line)
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.chartEngine.setMode(btn.dataset.mode);
      });
    });

    // Indicator toggles
    document.getElementById('toggle-sma')?.addEventListener('change', (e) => {
      this.chartEngine.toggleSMA(e.target.checked);
    });
    document.getElementById('toggle-ema')?.addEventListener('change', (e) => {
      this.chartEngine.toggleEMA(e.target.checked);
    });

    // Trade Tab (Buy vs Sell)
    this.elTabBuy?.addEventListener('click', () => this.setTradeTab('BUY'));
    this.elTabSell?.addEventListener('click', () => this.setTradeTab('SELL'));

    // Order Type dropdown
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

    // Shares & Limit price input
    this.elSharesInput?.addEventListener('input', () => this.updateOrderSummary());
    this.elLimitPriceInput?.addEventListener('input', () => this.updateOrderSummary());

    // Quick percentages
    this.elQuickPercents.forEach(btn => {
      btn.addEventListener('click', () => {
        const pct = parseFloat(btn.dataset.pct);
        this.applyQuickPercent(pct);
      });
    });

    // Submit Order button
    this.elSubmitTradeBtn?.addEventListener('click', () => this.handleOrderSubmit());

    // Dashboard tabs
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

    // Export / Import File I/O
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
      e.target.value = ''; // Reset input
    });

    // Preset Reset Capital buttons
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

    // Subscribe to Market ticks
    this.market.subscribe((tickBatch, stockMap) => {
      this.onMarketTick(tickBatch, stockMap);
    });

    // Subscribe to Breaking News
    this.market.subscribeNews((newsItem) => {
      this.onNewsReceived(newsItem);
    });
  }

  /**
   * Switches active stock for detailed view, chart, and trading terminal
   * @param {string} symbol
   */
  selectStock(symbol) {
    this.activeSymbol = symbol.toUpperCase();
    const stock = this.market.getStock(this.activeSymbol);
    if (!stock) return;

    // Update active details header
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

    // Populate chart
    this.chartEngine.setData(stock.history);

    // Update terminal order summary
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

    // Update buying power & owned share counters
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

    const orderType = this.elOrderType.value; // 'MARKET' | 'LIMIT' | 'STOP_LOSS'
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
        // Place Limit or Stop-Loss Order
        if (!limitPrice || limitPrice <= 0) {
          throw new Error('Please enter a valid target trigger price.');
        }

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

      // Reset share inputs
      this.elSharesInput.value = '';
      this.saveState();
      this.updateAll();
    } catch (err) {
      this.audio.playError();
      this.showToast(err.message, 'error');
    }
  }

  /**
   * Tick handler executed on every market cycle
   */
  onMarketTick(tickBatch, stockMap) {
    // 1. Process pending limit/stop orders
    const executedFills = this.user.portfolio.processPendingOrders(stockMap);
    if (executedFills.length > 0) {
      for (const fill of executedFills) {
        this.audio.playBuy();
        this.showToast(`Limit order filled: ${fill.order.type} ${fill.order.shares} ${fill.order.symbol} @ $${fill.transaction.price.toFixed(2)}!`, 'success');
      }
      this.saveState();
    }

    // 2. Record portfolio snapshot periodically
    this.user.portfolio.recordSnapshot(stockMap);

    // 3. Update active stock if it ticked
    const activeTick = tickBatch.find(t => t.symbol === this.activeSymbol);
    if (activeTick) {
      const stock = this.market.getStock(this.activeSymbol);
      if (stock) {
        this.elActivePrice.textContent = `$${stock.currentPrice.toFixed(2)}`;
        
        // Flash animation
        const flashClass = activeTick.diff >= 0 ? 'flash-up' : 'flash-down';
        this.elActivePrice.classList.remove('flash-up', 'flash-down');
        void this.elActivePrice.offsetWidth; // trigger reflow
        this.elActivePrice.classList.add(flashClass);

        const change = stock.getDailyChange();
        this.elActiveChange.className = `stat-badge ${change.isPositive ? 'positive' : 'negative'}`;
        this.elActiveChange.textContent = `${change.isPositive ? '+' : ''}$${change.diff.toFixed(2)} (${change.isPositive ? '+' : ''}${change.percent}%)`;
        
        this.elStatHigh.textContent = `$${stock.highPrice.toFixed(2)}`;
        this.elStatLow.textContent = `$${stock.lowPrice.toFixed(2)}`;
        this.elStatVol.textContent = stock.volume.toLocaleString();

        // Update real-time chart data
        this.chartEngine.setData(stock.history);
        this.renderOrderBook();
      }
    }

    // 4. Update Header Financial Metrics
    this.renderHeaderStats();

    // 5. Update Watchlist and Holdings rows live
    this.updateWatchlistPrices();
    this.renderHoldingsTable();
    this.updateOrderSummary();

    // 6. If on analytics tab, refresh live curve
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
    // Duplicate array to enable seamless CSS marquee infinite scroll
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

    // Filter by sector
    if (this.selectedSector !== 'ALL') {
      stocks = stocks.filter(s => s.sector.toLowerCase().includes(this.selectedSector.toLowerCase()));
    }

    // Filter by search query
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

      // Draw mini sparkline SVG
      const sparkSvg = this.generateSparklineSvg(stock.sparkline, isPos);

      return `
        <div class="stock-item ${isActive ? 'active' : ''}" data-symbol="${stock.symbol}">
          <button class="star-btn ${isFav ? 'starred' : ''}" data-fav="${stock.symbol}" title="Toggle Watchlist">
            ★
          </button>
          <div class="stock-info">
            <span class="symbol">${stock.symbol}</span>
            <span class="name">${stock.name}</span>
          </div>
          <div class="sparkline-wrapper">
            ${sparkSvg}
          </div>
          <div class="stock-price-col">
            <span class="price" id="watch-price-${stock.symbol}">$${stock.currentPrice.toFixed(2)}</span>
            <span class="chg ${isPos ? 'green' : 'red'}" id="watch-chg-${stock.symbol}">
              ${isPos ? '+' : ''}${chg.percent}%
            </span>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to rows & star buttons
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

    // Row selection & quick sell buttons
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
          <td colspan="7" class="empty-table-msg">No trades executed yet. Place an order above to build your ledger.</td>
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

    // Draw baseline initial capital dashed line
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

    // Area fill
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    const isProfitable = snapshots[snapshots.length - 1].totalValue >= this.user.portfolio.initialCapital;
    const themeColor = isProfitable ? '#00e676' : '#ff3b57';
    grad.addColorStop(0, isProfitable ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 59, 87, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(snapshots[0].totalValue));
    for (let i = 1; i < snapshots.length; i++) {
      ctx.lineTo(getX(i), getY(snapshots[i].totalValue));
    }
    ctx.lineTo(getX(snapshots.length - 1), padding.top + chartH);
    ctx.lineTo(getX(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line curve
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(snapshots[0].totalValue));
    for (let i = 1; i < snapshots.length; i++) {
      ctx.lineTo(getX(i), getY(snapshots[i].totalValue));
    }
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 6;
    ctx.stroke();

    // Update Analytics KPI metrics
    this.renderAnalyticsMetrics();
  }

  renderAnalyticsMetrics() {
    const txs = this.user.portfolio.transactions;
    const sellTxs = txs.filter(t => t.type === 'SELL');
    const winningTrades = sellTxs.filter(t => t.realizedPnL > 0);
    const winRate = sellTxs.length > 0 ? ((winningTrades.length / sellTxs.length) * 100).toFixed(1) : 0;

    let totalRealized = 0;
    for (const st of sellTxs) {
      totalRealized += st.realizedPnL;
    }

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

    // Asset allocation bars
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
