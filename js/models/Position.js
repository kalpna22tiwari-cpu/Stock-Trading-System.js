/**
 * Position Model
 * Represents a user's holdings in a specific stock.
 * Tracks share count, cost basis, average purchase price, and calculates
 * unrealized gains/losses in real-time.
 */
export class Position {
  /**
   * @param {string} symbol - Ticker symbol
   * @param {number} shares - Initial share count
   * @param {number} price - Initial buy price per share
   */
  constructor(symbol, shares = 0, price = 0) {
    this.symbol = symbol;
    this.shares = Number(shares);
    this.totalCost = Number((shares * price).toFixed(2));
    this.averagePrice = shares > 0 ? Number(price.toFixed(2)) : 0;
  }

  /**
   * Increases position holding and recalculates dollar cost average
   * @param {number} qty - Quantity of shares purchased
   * @param {number} price - Purchase price per share
   */
  addShares(qty, price) {
    if (qty <= 0 || price <= 0) {
      throw new Error("Quantity and price must be greater than zero.");
    }
    const newCost = +(qty * price).toFixed(2);
    this.shares += qty;
    this.totalCost = +(this.totalCost + newCost).toFixed(2);
    this.averagePrice = +(this.totalCost / this.shares).toFixed(2);
  }

  /**
   * Decreases position holding and calculates realized profit/loss
   * @param {number} qty - Quantity of shares to sell
   * @param {number} price - Selling price per share
   * @returns {Object} { realizedPnL, remainingShares, proceeds }
   */
  removeShares(qty, price) {
    if (qty <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }
    if (qty > this.shares) {
      throw new Error(`Insufficient shares. You own ${this.shares} but attempted to sell ${qty}.`);
    }

    const proceeds = +(qty * price).toFixed(2);
    const costBasisPortion = +(qty * this.averagePrice).toFixed(2);
    const realizedPnL = +(proceeds - costBasisPortion).toFixed(2);

    this.shares -= qty;
    this.totalCost = +(this.shares * this.averagePrice).toFixed(2);

    if (this.shares === 0) {
      this.totalCost = 0;
      this.averagePrice = 0;
    }

    return {
      realizedPnL,
      remainingShares: this.shares,
      proceeds
    };
  }

  /**
   * Current market value of this position
   * @param {number} currentPrice
   */
  getMarketValue(currentPrice) {
    return +(this.shares * currentPrice).toFixed(2);
  }

  /**
   * Unrealized Dollar Profit or Loss
   * @param {number} currentPrice
   */
  getUnrealizedPnL(currentPrice) {
    return +(this.getMarketValue(currentPrice) - this.totalCost).toFixed(2);
  }

  /**
   * Unrealized Percentage Return
   * @param {number} currentPrice
   */
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
