/**
 * VenueFlow Pro — Simulator Tests
 * Tests crowd simulation: phase multipliers, density bounds, wait time logic,
 * LocalStorage persistence, and start/stop lifecycle.
 */

'use strict';

const { CrowdSimulator } = require('../src/engine/simulator.cjs');

// ── Mock localStorage ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {};
  return {
    getItem:  (key) => store[key] || null,
    setItem:  (key, val) => { store[key] = String(val); },
    removeItem:(key) => { delete store[key]; },
    clear:    () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// ── Mock StateEngine ─────────────────────────────────────────────────────────
function createMockStore(overrides = {}) {
  let state = {
    event: { phase: 'game_active', startTime: Date.now() - 1800000 },
    venue: {
      sections: [
        { id: 'north', label: 'North Stand', density: 0.75 },
        { id: 'east',  label: 'East Wing',   density: 0.88 },
        { id: 'west',  label: 'West Wing',   density: 0.55 },
      ],
      restrooms: [{ id: 'wc_n1', label: 'Restroom North', waitTime: 8, accessible: true }],
      concessions: [{ id: 'food_n1', label: 'Food North', waitTime: 10, open: true }],
      gates: [{ id: 'gate_a', label: 'Gate A', waitTime: 5, open: true }],
      occupancyPercent: 72,
    },
    notifications: [],
    ...overrides,
  };

  return {
    getState: () => JSON.parse(JSON.stringify(state)),
    setState: (updates) => { state = { ...state, ...updates }; },
    computeEventPhase: () => 'game_active',
    subscribe: () => () => {},
  };
}

// ────────────────────────────────────────────────────────────────────────────
describe('CrowdSimulator — Lifecycle', () => {

  test('starts in a stopped state', () => {
    const sim = new CrowdSimulator(createMockStore());
    expect(sim.isRunning()).toBe(false);
    expect(sim.getTickCount()).toBe(0);
  });

  test('isRunning() returns true after start()', () => {
    const sim = new CrowdSimulator(createMockStore());
    sim.start();
    expect(sim.isRunning()).toBe(true);
    sim.stop();
  });

  test('isRunning() returns false after stop()', () => {
    const sim = new CrowdSimulator(createMockStore());
    sim.start();
    sim.stop();
    expect(sim.isRunning()).toBe(false);
  });

  test('calling start() twice does not create duplicate intervals', () => {
    const sim = new CrowdSimulator(createMockStore());
    sim.start();
    const firstIntervalId = sim._intervalId;
    sim.start();
    expect(sim._intervalId).toBe(firstIntervalId);
    sim.stop();
  });

  test('tick count increments after manual _tick() call', () => {
    const sim = new CrowdSimulator(createMockStore());
    sim._tick();
    expect(sim.getTickCount()).toBe(1);
    sim._tick();
    expect(sim.getTickCount()).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('CrowdSimulator — Density Bounds', () => {

  test('section density stays within [0.10, 0.99] after 50 ticks', () => {
    const store = createMockStore();
    const sim = new CrowdSimulator(store);
    for (let i = 0; i < 50; i++) sim._tick();

    const sections = store.getState().venue.sections;
    sections.forEach(sec => {
      expect(sec.density).toBeGreaterThanOrEqual(0.10);
      expect(sec.density).toBeLessThanOrEqual(0.99);
    });
  });

  test('density is rounded to 2 decimal places', () => {
    const store = createMockStore();
    const sim = new CrowdSimulator(store);
    sim._tick();

    const sections = store.getState().venue.sections;
    sections.forEach(sec => {
      expect(Number.isFinite(sec.density)).toBe(true);
      expect(sec.density.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('CrowdSimulator — Wait Times', () => {

  test('restroom wait times remain >= 1 after tick', () => {
    const store = createMockStore();
    const sim = new CrowdSimulator(store);
    for (let i = 0; i < 10; i++) sim._tick();

    store.getState().venue.restrooms.forEach(r => {
      expect(r.waitTime).toBeGreaterThanOrEqual(1);
    });
  });

  test('concession wait times remain >= 1 after tick', () => {
    const store = createMockStore();
    const sim = new CrowdSimulator(store);
    for (let i = 0; i < 10; i++) sim._tick();

    store.getState().venue.concessions.forEach(c => {
      expect(c.waitTime).toBeGreaterThanOrEqual(1);
    });
  });

  test('gate wait times remain >= 1 after tick', () => {
    const store = createMockStore();
    const sim = new CrowdSimulator(store);
    for (let i = 0; i < 10; i++) sim._tick();

    store.getState().venue.gates.forEach(g => {
      expect(g.waitTime).toBeGreaterThanOrEqual(1);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('CrowdSimulator — occupancyPercent', () => {

  test('occupancyPercent is a whole number within [1, 100]', () => {
    const store = createMockStore();
    const sim = new CrowdSimulator(store);
    sim._tick();

    const occ = store.getState().venue.occupancyPercent;
    expect(Number.isInteger(occ)).toBe(true);
    expect(occ).toBeGreaterThanOrEqual(1);
    expect(occ).toBeLessThanOrEqual(100);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('CrowdSimulator — LocalStorage Persistence', () => {

  beforeEach(() => localStorageMock.clear());

  test('writes snapshot to localStorage after tick', () => {
    const sim = new CrowdSimulator(createMockStore());
    sim._tick();
    const stored = localStorageMock.getItem('vf_crowd_snapshot');
    expect(stored).not.toBeNull();
  });

  test('stored snapshot contains expected keys', () => {
    const sim = new CrowdSimulator(createMockStore());
    sim._tick();
    const snapshot = JSON.parse(localStorageMock.getItem('vf_crowd_snapshot'));
    expect(snapshot).toHaveProperty('phase');
    expect(snapshot).toHaveProperty('occupancyPercent');
    expect(snapshot).toHaveProperty('ts');
  });

  test('snapshot ts is a recent Unix timestamp', () => {
    const before = Date.now();
    const sim = new CrowdSimulator(createMockStore());
    sim._tick();
    const { ts } = JSON.parse(localStorageMock.getItem('vf_crowd_snapshot'));
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now());
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('CrowdSimulator — Notification Deduplication', () => {

  test('does not add duplicate notifications within 30s', () => {
    const store = createMockStore();
    const sim = new CrowdSimulator(store);

    const notif = { type: 'warning', title: 'Test Alert', message: 'Crowd surge' };
    sim._addNotification(notif);
    sim._addNotification(notif); // Duplicate

    const count = store.getState().notifications.filter(n => n.title === 'Test Alert').length;
    expect(count).toBe(1);
  });

  test('notification queue does not exceed 20 items', () => {
    const store = createMockStore();
    const sim = new CrowdSimulator(store);

    for (let i = 0; i < 25; i++) {
      sim._addNotification({ type: 'info', title: `Alert ${i}`, message: 'msg' });
    }

    const total = store.getState().notifications.length;
    expect(total).toBeLessThanOrEqual(20);
  });
});
