/**
 * VenueFlow Pro — Central State Engine
 * Single Responsibility: owns all application state, provides reactive subscriptions.
 * Pattern: Observable Store (similar to Redux/Zustand without framework dependency)
 */

import mockData from '../data/mockData.json' assert { type: 'json' };

class StateEngine {
  constructor() {
    this._listeners = {};
    this._state = {
      // User profile
      user: {
        seatSection: null,
        hasCheckedIn: false,
        accessibilityMode: false,
        highContrastMode: false,
        notificationsEnabled: true,
        cart: [],
        orders: [],
      },
      // Live event info
      event: {
        ...mockData.event,
        startTime: Date.now() + mockData.event.kickoffOffset,
        phase: 'pre_game', // pre_game | game_active | halftime | post_game
      },
      // Venue real-time status
      venue: {
        sections: mockData.stadium.sections.map(s => ({ ...s })),
        restrooms: mockData.stadium.facilities.restrooms.map(r => ({ ...r })),
        concessions: mockData.stadium.facilities.concessions.map(c => ({ ...c })),
        gates: mockData.stadium.facilities.gates.map(g => ({ ...g })),
        occupancyPercent: 74,
      },
      // Staff
      staff: mockData.staff.map(s => ({ ...s })),
      // Notifications queue
      notifications: [],
      // Chat history
      chatHistory: [],
      // Active UI tab
      activeTab: 'home',
    };
  }

  /**
   * Returns a deep-frozen snapshot of the current state.
   * @returns {Object}
   */
  getState() {
    return JSON.parse(JSON.stringify(this._state));
  }

  /**
   * Merges partial updates into state and notifies subscribers.
   * @param {Object} updates - Partial state updates (supports nested dot-path or top-level keys)
   */
  setState(updates) {
    this._state = this._deepMerge(this._state, updates);
    this._notify(updates);
  }

  /**
   * Subscribe to state changes on a specific key.
   * @param {string} key - Top-level state key to watch
   * @param {Function} fn - Callback receiving new sub-state value
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(fn);
    // Immediately call with current value
    fn(this._state[key]);
    return () => {
      this._listeners[key] = this._listeners[key].filter(f => f !== fn);
    };
  }

  /**
   * Returns the current event phase based on elapsed time.
   * @returns {string}
   */
  computeEventPhase() {
    const now = Date.now();
    const start = this._state.event.startTime;
    const elapsed = now - start;
    const half = 3600000; // 60 min
    const end = 7200000;  // 120 min

    if (now < start - 300000) return 'pre_game';          // >5 min to start
    if (now < start) return 'pre_game';
    if (elapsed < half - 300000) return 'game_active';
    if (elapsed < half) return 'halftime_approaching';
    if (elapsed < half + 900000) return 'halftime';       // 15 min halftime
    if (elapsed < end - 300000) return 'game_active';
    if (elapsed < end) return 'game_ending';
    return 'post_game';
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  _notify(updates) {
    const keys = Object.keys(updates);
    keys.forEach(key => {
      if (this._listeners[key]) {
        this._listeners[key].forEach(fn => fn(this._state[key]));
      }
    });
    // Always notify wildcard listeners
    if (this._listeners['*']) {
      this._listeners['*'].forEach(fn => fn(this._state));
    }
  }

  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

// Singleton export
const store = new StateEngine();
export default store;

// Export class for testing
export { StateEngine };
