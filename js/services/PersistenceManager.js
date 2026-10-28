import { User } from '../models/User.js';

/**
 * Persistence Manager Service
 * Manages dual persistence strategies:
 * 1. Automatic LocalStorage state caching
 * 2. File I/O: Exporting and importing JSON backups directly to/from local disk
 * 3. File I/O: Exporting full transaction audit ledger to CSV format
 */
export class PersistenceManager {
  static STORAGE_KEY = 'STOCKS_SIM_USER_DATA_V2';

  /**
   * Saves user and portfolio data to browser localStorage
   * @param {User} user
   */
  static saveToStorage(user) {
    try {
      const serialized = JSON.stringify(user.toJSON());
      localStorage.setItem(this.STORAGE_KEY, serialized);
      return true;
    } catch (err) {
      console.warn('LocalStorage save failed:', err);
      return false;
    }
  }

  /**
   * Loads saved user and portfolio state from browser localStorage
   * @returns {User|null}
   */
  static loadFromStorage() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return User.fromJSON(parsed);
    } catch (err) {
      console.error('Failed to load user state from localStorage:', err);
      return null;
    }
  }

  /**
   * Exports portfolio state to a downloadable JSON file on the user's computer (File I/O)
   * @param {User} user
   * @param {string} [filename]
   */
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

  /**
   * Imports portfolio state from a user-selected JSON file via FileReader (File I/O)
   * @param {File} file
   * @returns {Promise<User>}
   */
  static importFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new Error('No file selected.'));
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = JSON.parse(event.target.result);
          const userData = raw.user || raw;
          if (!userData.portfolio) {
            throw new Error('Invalid portfolio backup file format.');
          }
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

  /**
   * Exports trade transaction history as a downloadable CSV spreadsheet
   * @param {import('../models/Transaction.js').Transaction[]} transactions
   */
  static exportTransactionsCSV(transactions) {
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions recorded yet to export.');
    }

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

  /**
   * Clears saved state from localStorage
   */
  static clearStorage() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }
}
