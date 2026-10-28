/**
 * Stock Trading System (Node.js CLI & OOP Architecture)
 * 
 * Demonstrates:
 * 1. Object-Oriented Programming (OOP) hierarchy:
 *    - Stock (Attributes: symbol, name, price, history; Methods: tick, getChange)
 *    - Position (Attributes: symbol, shares, costBasis, avgPrice; Methods: addShares, removeShares, getPnL)
 *    - Transaction (Attributes: id, timestamp, type, shares, price, realizedPnL)
 *    - Portfolio (Attributes: cash, positions, transactions; Methods: buy, sell, getPerformance)
 *    - User (Attributes: id, name, portfolio)
 * 2. Market Data Display (real-time tick simulation, quotes, stats)
 * 3. Buy and Sell Operations (with fund validation, average price calculations, realized/unrealized PnL)
 * 4. Portfolio Performance Tracking over time
 * 5. File I/O Persistence (saving and loading state to portfolio_data.json via 'fs')
 */

const fs = require('fs');
const path = require('path');

// ==========================================
// 1. Stock Model (OOP)
// ==========================================
class Stock {
  constructor(symbol, name, sector, basePrice, volatility = 0.02) {
    this.symbol = symbol.toUpperCase();
    this.name = name;
    this.sector = sector;
    this.basePrice = Number(basePrice);
    this.currentPrice = Number(basePrice);
    this.highPrice = Number(basePrice);
    this.lowPrice = Number(basePrice);
    this.prevClose = Number(basePrice);
    this.volatility = volatility;
    this.history = [Number(basePrice)];
  }

  tick(marketSentiment = 0) {
    const shock = (Math.random() - 0.49) * this.volatility;
    const factor = 1 + marketSentiment + shock;
    const newPrice = Math.max(1.0, +(this.currentPrice * factor).toFixed(2));
    
    this.currentPrice = newPrice;
    if (newPrice > this.highPrice) this.highPrice = newPrice;
    if (newPrice < this.lowPrice) this.lowPrice = newPrice;
    this.history.push(newPrice);
    if (this.history.length > 50) this.history.shift();

    return newPrice;
  }

  getDailyChange() {
    const diff = +(this.currentPrice - this.prevClose).toFixed(2);
    const percent = +((diff / this.prevClose) * 100).toFixed(2);
    return { diff, percent, isPositive: diff >= 0 };
  }
}

// ==========================================
// 2. Position Model (OOP)
// ==========================================
class Position {
  constructor(symbol, shares = 0, price = 0) {
    this.symbol = symbol.toUpperCase();
    this.shares = Number(shares);
    this.totalCost = +(shares * price).toFixed(2);
    this.averagePrice = shares > 0 ? Number(price.toFixed(2)) : 0;
  }

  addShares(qty, price) {
    if (qty <= 0) throw new Error("Quantity must be positive.");
    const cost = +(qty * price).toFixed(2);
    this.shares += qty;
    this.totalCost = +(this.totalCost + cost).toFixed(2);
    this.averagePrice = +(this.totalCost / this.shares).toFixed(2);
  }

  removeShares(qty, price) {
    if (qty <= 0 || qty > this.shares) {
      throw new Error(`Invalid share quantity. You hold ${this.shares} shares.`);
    }
    const proceeds = +(qty * price).toFixed(2);
    const costBasisPart = +(qty * this.averagePrice).toFixed(2);
    const realizedPnL = +(proceeds - costBasisPart).toFixed(2);

    this.shares -= qty;
    this.totalCost = +(this.shares * this.averagePrice).toFixed(2);
    if (this.shares === 0) {
      this.totalCost = 0;
      this.averagePrice = 0;
    }
    return { realizedPnL, proceeds };
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
}

// ==========================================
// 3. Transaction Model (OOP)
// ==========================================
class Transaction {
  constructor({ id, timestamp, symbol, type, shares, price, totalAmount, realizedPnL = 0 }) {
    this.id = id || 'TX-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    this.timestamp = timestamp || Date.now();
    this.symbol = symbol.toUpperCase();
    this.type = type.toUpperCase(); // 'BUY' | 'SELL'
    this.shares = Number(shares);
    this.price = Number(price);
    this.totalAmount = totalAmount ? Number(totalAmount) : +(this.shares * this.price).toFixed(2);
    this.realizedPnL = Number(realizedPnL);
  }

  toString() {
    const time = new Date(this.timestamp).toLocaleTimeString();
    const pnl = this.type === 'SELL' ? ` | PnL: ${this.realizedPnL >= 0 ? '+' : ''}$${this.realizedPnL.toFixed(2)}` : '';
    return `[${time}] ${this.type.padEnd(4)} ${this.shares.toString().padStart(4)} ${this.symbol.padEnd(5)} @ $${this.price.toFixed(2).padStart(7)} (Total: $${this.totalAmount.toFixed(2)})${pnl}`;
  }
}

// ==========================================
// 4. Portfolio Model (OOP)
// ==========================================
class Portfolio {
  constructor(initialCapital = 100000) {
    this.initialCapital = Number(initialCapital);
    this.cashBalance = Number(initialCapital);
    this.positions = new Map(); // symbol -> Position
    this.transactions = [];
    this.snapshots = [{
      timestamp: Date.now(),
      totalValue: this.initialCapital,
      cash: this.initialCapital,
      invested: 0
    }];
  }

  buy(symbol, shares, price) {
    shares = Math.floor(Number(shares));
    price = Number(price);
    const cost = +(shares * price).toFixed(2);

    if (this.cashBalance < cost) {
      throw new Error(`Insufficient funds: Need $${cost.toFixed(2)}, Available: $${this.cashBalance.toFixed(2)}`);
    }

    this.cashBalance = +(this.cashBalance - cost).toFixed(2);
    let pos = this.positions.get(symbol.toUpperCase());
    if (!pos) {
      pos = new Position(symbol, shares, price);
      this.positions.set(symbol.toUpperCase(), pos);
    } else {
      pos.addShares(shares, price);
    }

    const tx = new Transaction({ symbol, type: 'BUY', shares, price, totalAmount: cost });
    this.transactions.push(tx);
    return tx;
  }

  sell(symbol, shares, price) {
    shares = Math.floor(Number(shares));
    price = Number(price);
    const pos = this.positions.get(symbol.toUpperCase());

    if (!pos || pos.shares < shares) {
      throw new Error(`Cannot sell ${shares} shares. You own ${pos ? pos.shares : 0}.`);
    }

    const { realizedPnL, proceeds } = pos.removeShares(shares, price);
    this.cashBalance = +(this.cashBalance + proceeds).toFixed(2);

    if (pos.shares === 0) {
      this.positions.delete(symbol.toUpperCase());
    }

    const tx = new Transaction({ symbol, type: 'SELL', shares, price, totalAmount: proceeds, realizedPnL });
    this.transactions.push(tx);
    return tx;
  }

  getTotalInvested(marketMap) {
    let sum = 0;
    for (const [sym, pos] of this.positions.entries()) {
      const stock = marketMap.get(sym);
      const price = stock ? stock.currentPrice : pos.averagePrice;
      sum += pos.getMarketValue(price);
    }
    return +sum.toFixed(2);
  }

  getTotalValue(marketMap) {
    return +(this.cashBalance + this.getTotalInvested(marketMap)).toFixed(2);
  }

  recordSnapshot(marketMap) {
    this.snapshots.push({
      timestamp: Date.now(),
      totalValue: this.getTotalValue(marketMap),
      cash: this.cashBalance,
      invested: this.getTotalInvested(marketMap)
    });
  }

  toJSON() {
    const posObj = {};
    for (const [k, v] of this.positions.entries()) posObj[k] = v;
    return {
      initialCapital: this.initialCapital,
      cashBalance: this.cashBalance,
      positions: posObj,
      transactions: this.transactions,
      snapshots: this.snapshots
    };
  }

  static fromJSON(data) {
    const port = new Portfolio(data.initialCapital);
    port.cashBalance = data.cashBalance;
    port.positions = new Map();
    if (data.positions) {
      for (const [sym, val] of Object.entries(data.positions)) {
        const pos = new Position(val.symbol, val.shares, val.averagePrice);
        pos.totalCost = val.totalCost;
        port.positions.set(sym, pos);
      }
    }
    port.transactions = (data.transactions || []).map(t => new Transaction(t));
    port.snapshots = data.snapshots || [];
    return port;
  }
}

// ==========================================
// 5. User Model (OOP)
// ==========================================
class User {
  constructor(name = 'Alex Hunter', portfolio = null) {
    this.name = name;
    this.portfolio = portfolio || new Portfolio(100000);
  }

  toJSON() {
    return {
      name: this.name,
      portfolio: this.portfolio.toJSON()
    };
  }

  static fromJSON(data) {
    const user = new User(data.name);
    if (data.portfolio) {
      user.portfolio = Portfolio.fromJSON(data.portfolio);
    }
    return user;
  }
}

// ==========================================
// 6. File I/O Persistence Manager
// ==========================================
class FilePersistence {
  static FILE_PATH = path.join(__dirname, 'portfolio_data.json');

  static save(user) {
    try {
      const data = JSON.stringify(user.toJSON(), null, 2);
      fs.writeFileSync(this.FILE_PATH, data, 'utf-8');
      return true;
    } catch (err) {
      console.error('Failed to write to file:', err.message);
      return false;
    }
  }

  static load() {
    try {
      if (!fs.existsSync(this.FILE_PATH)) return null;
      const content = fs.readFileSync(this.FILE_PATH, 'utf-8');
      return User.fromJSON(JSON.parse(content));
    } catch (err) {
      console.error('Failed to read from file:', err.message);
      return null;
    }
  }
}

// ==========================================
// 7. Simulation Demonstration & Market Display
// ==========================================
function runSimulationDemo() {
  console.log('\n================================================================');
  console.log('   APEXTRADER — OBJECT-ORIENTED STOCK TRADING SYSTEM SIMULATION');
  console.log('================================================================\n');

  // Initialize Market Stock Universe
  const market = new Map([
    ['AAPL', new Stock('AAPL', 'Apple Inc.', 'Tech', 229.40, 0.018)],
    ['NVDA', new Stock('NVDA', 'NVIDIA Corp.', 'AI/Semis', 141.25, 0.038)],
    ['MSFT', new Stock('MSFT', 'Microsoft Corp.', 'Software', 428.15, 0.016)],
    ['TSLA', new Stock('TSLA', 'Tesla Inc.', 'Auto/EV', 221.75, 0.042)],
    ['AMZN', new Stock('AMZN', 'Amazon.com', 'Consumer', 188.50, 0.024)]
  ]);

  // Load existing or initialize fresh user
  let user = FilePersistence.load();
  if (!user) {
    console.log('[System] Initializing fresh user Alex Hunter with $100,000 cash.');
    user = new User('Alex Hunter');
  } else {
    console.log(`[File I/O] Loaded persisted profile for "${user.name}" from portfolio_data.json`);
  }

  // 1. Display Current Market Quotes
  console.log('\n--- 1. MARKET DATA DISPLAY ---');
  console.log('Ticker | Company Name       | Sector   | Price   | High    | Low     | Day Chg');
  console.log('-------+--------------------+----------+---------+---------+---------+--------');
  for (const stock of market.values()) {
    const chg = stock.getDailyChange();
    const chgStr = `${chg.isPositive ? '+' : ''}${chg.percent}%`;
    console.log(
      `${stock.symbol.padEnd(6)} | ${stock.name.padEnd(18)} | ${stock.sector.padEnd(8)} | $${stock.currentPrice.toFixed(2).padStart(6)} | $${stock.highPrice.toFixed(2).padStart(6)} | $${stock.lowPrice.toFixed(2).padStart(6)} | ${chgStr.padStart(7)}`
    );
  }

  // 2. Execute Sample Buy Operations
  console.log('\n--- 2. EXECUTING BUY TRADES ---');
  try {
    const tx1 = user.portfolio.buy('AAPL', 20, market.get('AAPL').currentPrice);
    console.log('✔ BUY EXECUTED:', tx1.toString());

    const tx2 = user.portfolio.buy('NVDA', 50, market.get('NVDA').currentPrice);
    console.log('✔ BUY EXECUTED:', tx2.toString());

    const tx3 = user.portfolio.buy('TSLA', 30, market.get('TSLA').currentPrice);
    console.log('✔ BUY EXECUTED:', tx3.toString());
  } catch (err) {
    console.log('Trade Error:', err.message);
  }

  // 3. Simulate Market Price Movements (Geometric Brownian Motion ticks)
  console.log('\n--- 3. SIMULATING MARKET TICKS & PRICE FLUCTUATION ---');
  for (let tick = 1; tick <= 5; tick++) {
    for (const stock of market.values()) {
      stock.tick(0.002); // slight bullish drift
    }
  }
  console.log('Market advanced by 5 ticks.');
  for (const stock of market.values()) {
    console.log(`  ${stock.symbol}: Now $${stock.currentPrice.toFixed(2)} (High: $${stock.highPrice.toFixed(2)}, Low: $${stock.lowPrice.toFixed(2)})`);
  }

  // 4. Execute a Sell Trade to Realize Profit/Loss
  console.log('\n--- 4. EXECUTING SELL TRADE ---');
  try {
    const txSell = user.portfolio.sell('AAPL', 10, market.get('AAPL').currentPrice);
    console.log('✔ SELL EXECUTED:', txSell.toString());
  } catch (err) {
    console.log('Sell Error:', err.message);
  }

  // 5. Portfolio Performance Tracking Display
  user.portfolio.recordSnapshot(market);
  const totalVal = user.portfolio.getTotalValue(market);
  const totalInvested = user.portfolio.getTotalInvested(market);
  const totalPnL = +(totalVal - user.portfolio.initialCapital).toFixed(2);
  const totalPnLPct = +((totalPnL / user.portfolio.initialCapital) * 100).toFixed(2);

  console.log('\n--- 5. PORTFOLIO PERFORMANCE SUMMARY ---');
  console.log(`Cash Balance:       $${user.portfolio.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  console.log(`Invested Value:     $${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  console.log(`Total Net Worth:    $${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  console.log(`Total P&L:          ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString()} (${totalPnL >= 0 ? '+' : ''}${totalPnLPct}%)`);

  console.log('\n--- 6. CURRENT OPEN HOLDINGS ---');
  console.log('Symbol | Shares | Avg Cost | Current Price | Market Value | Unrealized P&L');
  console.log('-------+--------+----------+---------------+--------------+---------------');
  for (const pos of user.portfolio.positions.values()) {
    const curP = market.get(pos.symbol).currentPrice;
    const mVal = pos.getMarketValue(curP);
    const unPnL = pos.getUnrealizedPnL(curP);
    const unPnLPct = pos.getUnrealizedPnLPercent(curP);
    console.log(
      `${pos.symbol.padEnd(6)} | ${pos.shares.toString().padStart(6)} | $${pos.averagePrice.toFixed(2).padStart(7)} | $${curP.toFixed(2).padStart(12)} | $${mVal.toFixed(2).padStart(11)} | ${unPnL >= 0 ? '+' : ''}$${unPnL.toFixed(2)} (${unPnLPct}%)`
    );
  }

  // 7. Persist Portfolio to File (File I/O)
  console.log('\n--- 7. FILE I/O PERSISTENCE ---');
  const saved = FilePersistence.save(user);
  if (saved) {
    console.log(`✔ Portfolio and trade history persisted to: ${FilePersistence.FILE_PATH}`);
  }

  console.log('\n================================================================');
  console.log('Simulation complete. You can also open index.html in any browser!');
  console.log('================================================================\n');
}

// Export classes and run if executed directly
module.exports = {
  Stock,
  Position,
  Transaction,
  Portfolio,
  User,
  FilePersistence,
  runSimulationDemo
};

if (require.main === module) {
  runSimulationDemo();
}
