# 📈 ApexTrader Pro — Stock Trading System & Simulation Engine

A modern, high-performance Stock Trading Simulation and Portfolio Management platform built using clean **Object-Oriented Programming (OOP)** principles in JavaScript.

Featuring real-time market data ticks, an interactive Candlestick & Area charting terminal, buy/sell trade execution with order book depth, portfolio performance analytics, and dual **File I/O** persistence strategies (local JSON files and CSV export).

---

## 🌟 Key Features

1. **Object-Oriented Programming (OOP) Architecture**:
   - `Stock`: Manages ticker attributes, stochastic price movement (Geometric Brownian Motion), day high/low/volume, and OHLCV history bars.
   - `Position`: Tracks share count, average cost basis, total invested equity, and real-time unrealized gains/losses.
   - `Transaction`: Immutable trade ledger recording timestamp, type (`BUY`/`SELL`), shares, price, total value, and realized profit/loss.
   - `Order`: Supports **Market Orders**, **Limit Orders**, and **Stop-Loss Orders** with automated condition triggering.
   - `Portfolio`: Controls cash balance, position management, order processing, and time-series performance snapshots.
   - `User`: Manages the trader profile, watchlist, and simulation preferences.
   - `MarketEngine`: Simulates market-wide sentiment drift, price ticks across sectors, and breaking news catalysts that impact valuations.

2. **Market Data Display & Interactive Charting**:
   - **Retina Canvas Chart Engine**: Supports both **Candlestick** and glowing **Line/Area** chart modes.
   - **Technical Indicators**: 20-period Simple Moving Average (**SMA 20**) and 50-period Exponential Moving Average (**EMA 50**).
   - **Interactive Crosshair & Tooltip**: Hover over any historical candle to inspect Date, Open, High, Low, Close, and Volume.
   - **Scrolling Ticker Marquee**: Live ticker bar with green/red flash animations on price ticks.
   - **Market Screener**: Filterable by sectors (Technology, Semiconductors, Automotive, Healthcare, Energy, Index ETFs).
   - **Level 2 Order Book**: Live simulated Bid/Ask depth and spread.

3. **Trading & Order Execution**:
   - **Instant Market Orders**: One-click buy and sell at current bid/ask prices with zero commission.
   - **Limit & Stop-Loss Orders**: Set target entry or exit prices; orders automatically fill when market ticks match criteria.
   - **Quick Allocation Buttons**: Instant `25%`, `50%`, `75%`, and `MAX` cash/share calculation.
   - **Real-Time Validation**: Cash balance verification, short selling guardrails, and dynamic cost previews.

4. **Portfolio Performance Tracking Over Time**:
   - **Equity Growth Curve**: Interactive time-series canvas chart showing total portfolio net worth over time compared to initial capital.
   - **Real-Time Key Performance Indicators (KPIs)**:
     - Win Rate (% of winning sell trades)
     - Total Realized Gains / Losses
     - Total Unrealized Gains / Losses
     - Total Executed Trades
   - **Asset Allocation Visualizer**: Dynamic distribution of Cash vs. held stock positions.

5. **File I/O & Persistence**:
   - **Automatic LocalStorage**: Seamlessly auto-saves state so you can refresh without losing your balance or positions.
   - **Export to JSON File**: Downloads `stock_portfolio_YYYY-MM-DD.json` directly to your local computer.
   - **Import from JSON File**: Select and upload a previously exported portfolio file using the Web File API.
   - **Export Ledger to CSV**: Download a complete audit spreadsheet of all trade transactions.
   - **Node.js File I/O**: The companion `stock_trading_cli.js` reads and writes directly to `portfolio_data.json` via Node's `fs` module.

6. **Synthetic Audio Feedback**:
   - Synthesizes custom trading chimes (harmonic major triad on buy, celebratory chime on sell, warning tone on error) using the native browser **Web Audio API** without external audio file dependencies.

---

## 📁 Project Structure

```text
Stock Trading System.js/
├── index.html                   # Semantic HTML5 trading terminal layout
├── styles.css                   # Modern dark-mode fintech stylesheet with glassmorphism
├── stock_trading_cli.js         # Standalone Node.js CLI simulation script with File I/O
├── portfolio_data.json          # Node.js persisted portfolio data file
├── README.md                    # Documentation & OOP architecture overview
└── js/
    ├── app.js                   # Application bootstrap
    ├── models/
    │   ├── Stock.js             # Stock class & price generation mechanics
    │   ├── Position.js          # Position class & cost basis calculations
    │   ├── Transaction.js       # Transaction class (immutable trade record)
    │   ├── Order.js             # Order class (Market, Limit, Stop-Loss)
    │   ├── Portfolio.js         # Portfolio class & equity snapshots
    │   └── User.js              # User account & watchlist manager
    ├── services/
    │   ├── MarketEngine.js      # Exchange engine, ticks, news catalysts
    │   ├── PersistenceManager.js # LocalStorage, JSON file I/O, CSV export
    │   └── AudioService.js      # Web Audio API synthesizer
    └── ui/
        ├── ChartEngine.js       # HiDPI Canvas chart (Candlesticks, SMA, EMA)
        └── UIController.js      # Reactive DOM controller & event dispatcher
```

---

## 🚀 How to Run

### Method 1: Interactive Web Terminal (Browser)
Simply double-click or open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).
No installation, npm build step, or server configuration is required!

### Method 2: Node.js Command-Line Interface
If you prefer running in a terminal:
```bash
node stock_trading_cli.js
```
This executes the CLI simulation, performs automated trades, ticks the market, displays ASCII tables, and persists state to `portfolio_data.json`.

---

## 📐 OOP Design Highlights

- **Encapsulation**: State such as `totalCost`, `averagePrice`, and `shares` in `Position` are encapsulated with dedicated methods (`addShares`, `removeShares`) that enforce mathematical integrity.
- **Single Responsibility**: `ChartEngine` only handles canvas drawing, `MarketEngine` only manages price ticks and news, and `Portfolio` handles ledger balancing.
- **Polymorphism & Factory Methods**: Standardized `toJSON()` and static `fromJSON()` methods across all models ensure seamless serialization between memory and disk files.
