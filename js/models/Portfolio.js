import { Position } from './Position.js';
import { Transaction } from './Transaction.js';
import { Order } from './Order.js';

/**
 * Portfolio Model
 * Central financial ledger managing cash balances, stock holdings,
 * order execution, and performance snapshots over time.
 */
export class Portfolio {
  /**
   * @param {number} [initialCapital] - Starting cash balance (default $100,000)
   */
  constructor(initialCapital = 100000) {
    this.initialCapital = Number(initialCapital);
    this.cashBalance = Number(initialCapital);
    this.reservedCash = 0; // Cash held in escrow for pending limit buy orders
    
    /** @type {Map<string, Position>} */
    this.positions = new Map();
    
    /** @type {Transaction[]} */
    this.transactions = [];
    
    /** @type {Order[]} */
    this.pendingOrders = [];
    
    /** @type {Array<{timestamp: number, totalValue: number, cash: number, investedValue: number, totalReturn: number}>} */
    this.performanceSnapshots = [];

    // Record initial snapshot
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

  /**
   * Available cash for new orders (cash minus reserved cash for pending orders)
   */
  getAvailableCash() {
    return +(this.cashBalance - this.reservedCash).toFixed(2);
  }

  /**
   * Returns a position for a symbol if it exists and has shares > 0
   * @param {string} symbol
   * @returns {Position|null}
   */
  getPosition(symbol) {
    const sym = symbol.toUpperCase();
    const pos = this.positions.get(sym);
    return (pos && pos.shares > 0) ? pos : null;
  }

  /**
   * Checks if user has enough available cash to buy
   * @param {number} shares
   * @param {number} price
   */
  canAfford(shares, price) {
    const totalCost = shares * price;
    return this.getAvailableCash() >= totalCost;
  }

  /**
   * Executes an instant BUY market order
   * @param {string} symbol
   * @param {number} shares
   * @param {number} price
   * @returns {Transaction}
   */
  buy(symbol, shares, price) {
    const sym = symbol.toUpperCase();
    const qty = Math.floor(Number(shares));
    const unitPrice = Number(price);

    if (qty <= 0) {
      throw new Error("Number of shares must be at least 1.");
    }
    if (unitPrice <= 0) {
      throw new Error("Invalid execution price.");
    }

    const totalCost = +(qty * unitPrice).toFixed(2);
    if (this.cashBalance < totalCost) {
      throw new Error(`Insufficient funds. Cost is $${totalCost.toLocaleString()}, but available balance is $${this.cashBalance.toLocaleString()}.`);
    }

    // Deduct cash
    this.cashBalance = +(this.cashBalance - totalCost).toFixed(2);

    // Update position
    let position = this.positions.get(sym);
    if (!position) {
      position = new Position(sym, qty, unitPrice);
      this.positions.set(sym, position);
    } else {
      position.addShares(qty, unitPrice);
    }

    // Record transaction
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

  /**
   * Executes an instant SELL market order
   * @param {string} symbol
   * @param {number} shares
   * @param {number} price
   * @returns {Transaction}
   */
  sell(symbol, shares, price) {
    const sym = symbol.toUpperCase();
    const qty = Math.floor(Number(shares));
    const unitPrice = Number(price);

    if (qty <= 0) {
      throw new Error("Number of shares must be at least 1.");
    }

    const position = this.getPosition(sym);
    if (!position || position.shares < qty) {
      const owned = position ? position.shares : 0;
      throw new Error(`Cannot sell ${qty} shares of ${sym}. You only own ${owned} shares.`);
    }

    // Execute removal and get realized PnL
    const { realizedPnL, proceeds } = position.removeShares(qty, unitPrice);

    // Credit cash
    this.cashBalance = +(this.cashBalance + proceeds).toFixed(2);

    // If completely closed position, clean up Map
    if (position.shares === 0) {
      this.positions.delete(sym);
    }

    // Record transaction
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

  /**
   * Places a pending limit or stop-loss order
   * @param {Order} order
   */
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

  /**
   * Cancels a pending order and releases reserved escrow cash
   * @param {string} orderId
   */
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

  /**
   * Evaluates pending orders against current market prices and triggers fills
   * @param {Map<string, import('./Stock.js').Stock>} stockMap
   * @returns {Array<{order: Order, transaction: Transaction}>} Executed fills
   */
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
            // Release reserved escrow before executing standard buy
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
          console.warn(`Pending order execution failed for ${order.id}:`, err);
          remaining.push(order);
        }
      } else {
        remaining.push(order);
      }
    }

    this.pendingOrders = remaining;
    return executed;
  }

  /**
   * Total market value of all held stocks
   * @param {Map<string, import('./Stock.js').Stock>} stockMap
   */
  getTotalInvestedValue(stockMap) {
    let sum = 0;
    for (const [symbol, position] of this.positions.entries()) {
      const stock = stockMap.get(symbol);
      const price = stock ? stock.currentPrice : position.averagePrice;
      sum += position.getMarketValue(price);
    }
    return +sum.toFixed(2);
  }

  /**
   * Total net worth = cash balance + total invested value
   * @param {Map<string, import('./Stock.js').Stock>} stockMap
   */
  getTotalPortfolioValue(stockMap) {
    return +(this.cashBalance + this.getTotalInvestedValue(stockMap)).toFixed(2);
  }

  /**
   * Total all-time profit or loss ($)
   */
  getTotalPnL(stockMap) {
    return +(this.getTotalPortfolioValue(stockMap) - this.initialCapital).toFixed(2);
  }

  /**
   * Total all-time return percentage (%)
   */
  getTotalPnLPercent(stockMap) {
    if (this.initialCapital === 0) return 0;
    return +((this.getTotalPnL(stockMap) / this.initialCapital) * 100).toFixed(2);
  }

  /**
   * Calculates overall daily PnL based on today's stock price changes
   */
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

  /**
   * Captures time-series performance data point for charts
   * @param {Map<string, import('./Stock.js').Stock>} stockMap
   */
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

    // Avoid recording identical values within short bursts
    const last = this.performanceSnapshots[this.performanceSnapshots.length - 1];
    if (!last || (Date.now() - last.timestamp > 15000) || Math.abs(last.totalValue - totalVal) > 5) {
      this.performanceSnapshots.push(snapshot);
      if (this.performanceSnapshots.length > 250) {
        this.performanceSnapshots.shift();
      }
    }
  }

  /**
   * Resets portfolio to initial starting cash
   * @param {number} [newInitialCapital]
   */
  reset(newInitialCapital) {
    if (newInitialCapital) {
      this.initialCapital = Number(newInitialCapital);
    }
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
