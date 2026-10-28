/**
 * Order Model
 * Represents pending and filled market, limit, and stop-loss orders.
 */
export class Order {
  /**
   * @param {Object} params
   * @param {string} [params.id]
   * @param {number} [params.timestamp]
   * @param {string} params.symbol
   * @param {'BUY'|'SELL'} params.type
   * @param {'MARKET'|'LIMIT'|'STOP_LOSS'} params.orderType
   * @param {number} params.shares
   * @param {number} [params.targetPrice] - Trigger price for limit/stop orders
   * @param {'PENDING'|'FILLED'|'CANCELLED'} [params.status]
   */
  constructor({
    id = null,
    timestamp = null,
    symbol,
    type,
    orderType = 'MARKET',
    shares,
    targetPrice = 0,
    status = 'PENDING'
  }) {
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

  /**
   * Evaluates if this order should trigger at the given current market price
   * @param {number} currentPrice
   * @returns {boolean}
   */
  shouldTrigger(currentPrice) {
    if (this.status !== 'PENDING') return false;

    if (this.orderType === 'MARKET') {
      return true;
    }

    if (this.orderType === 'LIMIT') {
      // Limit BUY triggers if price drops to or below target
      if (this.type === 'BUY' && currentPrice <= this.targetPrice) {
        return true;
      }
      // Limit SELL triggers if price rises to or above target
      if (this.type === 'SELL' && currentPrice >= this.targetPrice) {
        return true;
      }
    }

    if (this.orderType === 'STOP_LOSS') {
      // Stop Loss SELL triggers if price falls to or below target
      if (this.type === 'SELL' && currentPrice <= this.targetPrice) {
        return true;
      }
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
