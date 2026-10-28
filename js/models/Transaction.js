/**
 * Transaction Model
 * Represents an immutable executed trade record within the trading system ledger.
 */
export class Transaction {
  /**
   * @param {Object} params
   * @param {string} [params.id]
   * @param {number} [params.timestamp]
   * @param {string} params.symbol
   * @param {'BUY'|'SELL'} params.type
   * @param {number} params.shares
   * @param {number} params.price
   * @param {number} [params.totalAmount]
   * @param {number} [params.fee]
   * @param {number} [params.realizedPnL]
   */
  constructor({
    id = null,
    timestamp = null,
    symbol,
    type,
    shares,
    price,
    totalAmount = null,
    fee = 0,
    realizedPnL = 0
  }) {
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

  /**
   * Returns human-readable formatted timestamp
   */
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
