/**
 * VenueFlow Pro — CrowdSimulator (CommonJS export for Jest compatibility)
 * The ES module version (simulator.js) is used by the browser.
 * This CJS version is auto-required by the Jest test suite.
 */

'use strict';

const PHASE_MULTIPLIERS = {
  pre_game:            { crowd: 1.0,  waitTime: 1.0  },
  game_active:         { crowd: 0.7,  waitTime: 0.7  },
  halftime_approaching:{ crowd: 1.3,  waitTime: 1.5  },
  halftime:            { crowd: 2.0,  waitTime: 2.2  },
  game_ending:         { crowd: 0.8,  waitTime: 0.8  },
  post_game:           { crowd: 1.8,  waitTime: 1.9  },
};

const SECTION_BASE_DENSITIES = {
  north: 0.75, south: 0.60, east: 0.88,
  west: 0.52, vip: 0.40,
  upper_north: 0.65, upper_south: 0.55,
};

const WAIT_BASE = {
  restrooms:   { wc_n1: 8, wc_s1: 4, wc_e1: 12, wc_w1: 3 },
  concessions: { food_n1: 10, food_e1: 6, food_vip: 2, food_w1: 4 },
  gates:       { gate_a: 5, gate_b: 12, gate_c: 3, gate_d: 7, gate_vip: 1 },
};

class CrowdSimulator {
  constructor(store) {
    this.store = store;
    this._intervalId = null;
    this._tickCount = 0;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._tick();
    this._intervalId = setInterval(() => this._tick(), 4000);
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._running = false;
  }

  _tick() {
    this._tickCount++;
    const phase = this.store.computeEventPhase();
    const multiplier = PHASE_MULTIPLIERS[phase] || PHASE_MULTIPLIERS['game_active'];

    const currentPhase = this.store.getState().event.phase;
    if (currentPhase !== phase) {
      this.store.setState({ event: { phase } });
    }

    const sections = this.store.getState().venue.sections.map(section => {
      const base = SECTION_BASE_DENSITIES[section.id] || 0.65;
      const noise = (Math.random() - 0.5) * 0.06;
      const density = Math.min(0.99, Math.max(0.1, base * multiplier.crowd + noise));
      return { ...section, density: parseFloat(density.toFixed(2)) };
    });

    const restrooms = this.store.getState().venue.restrooms.map(r => {
      const base = WAIT_BASE.restrooms[r.id] || 7;
      const noise = Math.floor((Math.random() - 0.4) * 3);
      const waitTime = Math.max(1, Math.round(base * multiplier.waitTime + noise));
      return { ...r, waitTime };
    });

    const concessions = this.store.getState().venue.concessions.map(c => {
      const base = WAIT_BASE.concessions[c.id] || 6;
      const noise = Math.floor((Math.random() - 0.4) * 3);
      const waitTime = Math.max(1, Math.round(base * multiplier.waitTime + noise));
      return { ...c, waitTime };
    });

    const gates = this.store.getState().venue.gates.map(g => {
      const base = WAIT_BASE.gates[g.id] || 5;
      const noise = Math.floor((Math.random() - 0.5) * 2);
      const waitTime = Math.max(1, Math.round(base * multiplier.waitTime + noise));
      return { ...g, waitTime };
    });

    const avgDensity = sections.reduce((sum, s) => sum + s.density, 0) / sections.length;
    const occupancyPercent = Math.round(avgDensity * 100);

    this.store.setState({
      venue: { sections, restrooms, concessions, gates, occupancyPercent },
    });

    if (phase === 'halftime_approaching' && this._tickCount % 3 === 0) {
      const highSections = sections.filter(s => s.density > 0.85).map(s => s.label);
      if (highSections.length) {
        this._addNotification({
          type: 'warning',
          title: '🚨 Crowd Surge Warning',
          message: `${highSections[0]} is getting very crowded.`,
        });
      }
    }

    try {
      global.localStorage && localStorage.setItem('vf_crowd_snapshot', JSON.stringify({
        phase,
        occupancyPercent,
        ts: Date.now(),
      }));
    } catch (_) {}
  }

  _addNotification(notification) {
    const state = this.store.getState();
    const recentTitles = state.notifications
      .filter(n => Date.now() - n.ts < 30000)
      .map(n => n.title);
    if (recentTitles.includes(notification.title)) return;

    const newNotif = { ...notification, id: `notif_${Date.now()}`, ts: Date.now(), read: false };
    this.store.setState({
      notifications: [...state.notifications.slice(-19), newNotif],
    });
  }

  getTickCount() { return this._tickCount; }
  isRunning()    { return this._running; }
}

module.exports = { CrowdSimulator };
