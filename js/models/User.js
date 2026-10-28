import { Portfolio } from './Portfolio.js';

/**
 * User Model
 * Represents the trader's account, personal profile, portfolio container,
 * watchlist, and trading preferences.
 */
export class User {
  /**
   * @param {Object} params
   * @param {string} [params.id]
   * @param {string} [params.name]
   * @param {Portfolio} [params.portfolio]
   * @param {string[]} [params.watchlist]
   * @param {Object} [params.settings]
   */
  constructor({
    id = null,
    name = 'Alex Hunter',
    portfolio = null,
    watchlist = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN'],
    settings = {}
  } = {}) {
    this.id = id || 'USR-' + Math.floor(100000 + Math.random() * 900000);
    this.name = name;
    this.portfolio = portfolio || new Portfolio(100000);
    this.watchlist = new Set(watchlist);
    this.settings = Object.assign({
      soundEnabled: true,
      simSpeed: 1, // 1x, 2x, 5x
      isPaused: false,
      theme: 'dark'
    }, settings);
    this.joinDate = Date.now();
  }

  /**
   * Toggles a symbol in/out of the user's favorite watchlist
   * @param {string} symbol
   * @returns {boolean} Is now in watchlist
   */
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

  /**
   * Checks if symbol is in watchlist
   * @param {string} symbol
   */
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
