import { MarketEngine } from './services/MarketEngine.js';
import { PersistenceManager } from './services/PersistenceManager.js';
import { AudioService } from './services/AudioService.js';
import { ChartEngine } from './ui/ChartEngine.js';
import { UIController } from './ui/UIController.js';
import { User } from './models/User.js';

/**
 * Main Application Bootstrap
 * Initializes OOP services, loads or provisions user state,
 * hooks up the charting canvas, and starts the real-time market engine.
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Market Exchange Engine
  const market = new MarketEngine();

  // 2. Load cached User state or initialize fresh account
  let user = PersistenceManager.loadFromStorage();
  if (!user) {
    user = new User({
      name: 'Alex Hunter',
      settings: {
        soundEnabled: true,
        simSpeed: 1,
        isPaused: false
      }
    });

    // Provide initial starter holdings so the dashboard feels dynamic from second 1
    const initialAapl = market.getStock('AAPL');
    const initialNvda = market.getStock('NVDA');
    if (initialAapl) {
      user.portfolio.buy('AAPL', 15, +(initialAapl.currentPrice * 0.98).toFixed(2));
    }
    if (initialNvda) {
      user.portfolio.buy('NVDA', 25, +(initialNvda.currentPrice * 0.97).toFixed(2));
    }
    user.portfolio.recordSnapshot(market.stocks);
    PersistenceManager.saveToStorage(user);
  }

  // 3. Initialize Synthetic Audio Service
  const audio = new AudioService();
  audio.setEnabled(user.settings.soundEnabled);

  // 4. Initialize Interactive HiDPI Canvas Chart Engine
  const canvas = document.getElementById('main-stock-canvas');
  const chartEngine = new ChartEngine(canvas);

  // 5. Initialize UI Controller
  const ui = new UIController({
    user,
    market,
    audio,
    chartEngine
  });

  // 6. Start Market Simulation Clock
  market.start();

  // 7. Auto-save on page exit
  window.addEventListener('beforeunload', () => {
    PersistenceManager.saveToStorage(user);
  });

  console.log('🚀 Stock Trading System initialized successfully with OOP architecture.');
});
