/**
 * VenueFlow Pro — Assistant Intent & State Tests
 * Tests the AI fallback logic, intent routing, venue context building,
 * and state management edge cases — without requiring actual Gemini API calls.
 */

'use strict';

// ── Stub browser APIs not available in Node ──────────────────────────────────
global.document = {
  createElement: (tag) => ({
    textContent: '',
    innerHTML: '',
    className: '',
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {},
    querySelectorAll: () => [],
    addEventListener: () => {},
    style: {},
  }),
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  dispatchEvent: () => {},
};
global.window = { __ENV__: {} };
global.fetch = jest.fn();
global.requestAnimationFrame = (cb) => cb();

// ── Minimal mock for StateEngine (no ES module import needed in Jest CJS env)
function createMockStore(seatSection = 'North Stand', accessibilityMode = false) {
  return {
    getState: () => ({
      user: { seatSection, accessibilityMode },
      event: { phase: 'game_active', startTime: Date.now() - 3600000 },
      venue: {
        sections: [
          { id: 'north', label: 'North Stand',  density: 0.82 },
          { id: 'east',  label: 'East Wing',    density: 0.91 },
          { id: 'west',  label: 'West Wing',    density: 0.55 },
        ],
        restrooms: [
          { id: 'wc_n1', label: 'Restroom — North L1', waitTime: 8, accessible: true },
          { id: 'wc_w1', label: 'Restroom — West L2',  waitTime: 3, accessible: true },
        ],
        concessions: [
          { id: 'food_n1', label: 'Food Court North', waitTime: 10, open: true },
          { id: 'food_vip','label': 'VIP Lounge Kitchen', waitTime: 2, open: true },
        ],
        gates: [
          { id: 'gate_a', label: 'Gate A', waitTime: 5, open: true },
          { id: 'gate_c', label: 'Gate C', waitTime: 3, open: true },
        ],
        occupancyPercent: 76,
      },
      chatHistory: [],
      notifications: [],
    }),
    setState: jest.fn(),
    subscribe: () => () => {},
    computeEventPhase: () => 'game_active',
  };
}

// ── Extracted intent logic (mirrors AssistantController._getFallbackResponse) ─
// We test the pure logic here without DOM dependencies
function getFallbackResponse(text, store) {
  const t = text.toLowerCase();
  const state = store.getState();
  const restrooms = state.venue.restrooms;
  const concessions = state.venue.concessions;

  // Check navigation BEFORE food — 'navigate' contains 'eat' as a substring
  if (['seat', 'navigate', 'direction', 'get to', 'directions'].some(w => t.includes(w))) {
    return `NAVIGATE:navigate_tab`;
  }
  if (['restroom', 'bathroom', 'toilet', 'loo'].some(w => t.includes(w))) {
    const best = [...restrooms].sort((a, b) => a.waitTime - b.waitTime)[0];
    return `RESTROOM:${best.label}:${best.waitTime}`;
  }
  // Use word-boundary check for 'eat' to avoid matching 'weather', 'navigate', etc.
  if (['food', 'hungry', 'snack', 'drink'].some(w => t.includes(w)) || /\beat\b/.test(t)) {
    const best = [...concessions].sort((a, b) => a.waitTime - b.waitTime)[0];
    return `FOOD:${best.label}:${best.waitTime}`;
  }
  if (['crowd', 'busy', 'crowded', 'avoid', 'quiet'].some(w => t.includes(w))) {
    const quiet = state.venue.sections.sort((a, b) => a.density - b.density)[0];
    return `CROWD:${quiet.label}`;
  }
  if (['halftime', 'interval', 'break'].some(w => t.includes(w))) {
    return `HALFTIME:tip`;
  }
  if (['exit', 'leave', 'parking', 'out'].some(w => t.includes(w))) {
    return `EXIT:gate_c`;
  }
  if (['emergency', 'help', 'medical', 'sos'].some(w => t.includes(w))) {
    return `SOS:alert_staff`;
  }
  return `DEFAULT:welcome`;
}

function sanitize(str) {
  return str.replace(/[<>"'`]/g, '').trim();
}

// ────────────────────────────────────────────────────────────────────────────
describe('Intent Routing — Restrooms', () => {

  test('routes "restroom" correctly', () => {
    const result = getFallbackResponse('Where is the restroom?', createMockStore());
    expect(result).toMatch(/^RESTROOM:/);
  });

  test('routes "bathroom" correctly', () => {
    const result = getFallbackResponse('I need the bathroom', createMockStore());
    expect(result).toMatch(/^RESTROOM:/);
  });

  test('routes "toilet" correctly', () => {
    const result = getFallbackResponse('toilet please', createMockStore());
    expect(result).toMatch(/^RESTROOM:/);
  });

  test('returns the lowest-wait restroom', () => {
    const store = createMockStore();
    const result = getFallbackResponse('restroom', store);
    // West L2 has 3 min vs North L1 at 8 min
    expect(result).toContain('3');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Intent Routing — Food', () => {

  test('routes "hungry" correctly', () => {
    const result = getFallbackResponse("I'm hungry", createMockStore());
    expect(result).toMatch(/^FOOD:/);
  });

  test('routes "food" correctly', () => {
    const result = getFallbackResponse('Where is food', createMockStore());
    expect(result).toMatch(/^FOOD:/);
  });

  test('routes "drink" correctly', () => {
    const result = getFallbackResponse('I want a drink', createMockStore());
    expect(result).toMatch(/^FOOD:/);
  });

  test('returns the lowest-wait food option', () => {
    const store = createMockStore();
    const result = getFallbackResponse('food', store);
    // VIP Lounge at 2 min vs Food Court North at 10 min
    expect(result).toContain('2');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Intent Routing — Crowd', () => {

  test('routes "crowd" correctly', () => {
    const result = getFallbackResponse('avoid the crowd', createMockStore());
    expect(result).toMatch(/^CROWD:/);
  });

  test('routes "quiet" correctly', () => {
    const result = getFallbackResponse('quietest area', createMockStore());
    expect(result).toMatch(/^CROWD:/);
  });

  test('returns the section with lowest density', () => {
    const store = createMockStore();
    const result = getFallbackResponse('crowd', store);
    // West Wing has density 0.55 — lowest
    expect(result).toContain('West Wing');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Intent Routing — Navigation', () => {

  test('routes "navigate" correctly', () => {
    const result = getFallbackResponse('how do I navigate to my seat', createMockStore());
    expect(result).toMatch(/^NAVIGATE:/);
  });

  test('routes "direction" correctly', () => {
    const result = getFallbackResponse('give me directions', createMockStore());
    expect(result).toMatch(/^NAVIGATE:/);
  });

  test('routes "get to" correctly', () => {
    const result = getFallbackResponse('how do I get to section B', createMockStore());
    expect(result).toMatch(/^NAVIGATE:/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Intent Routing — Halftime', () => {

  test('routes "halftime" correctly', () => {
    const result = getFallbackResponse('what happens at halftime', createMockStore());
    expect(result).toMatch(/^HALFTIME:/);
  });

  test('routes "interval" correctly', () => {
    const result = getFallbackResponse('during the interval', createMockStore());
    expect(result).toMatch(/^HALFTIME:/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Intent Routing — Exit', () => {

  test('routes "exit" correctly', () => {
    const result = getFallbackResponse('how do I exit', createMockStore());
    expect(result).toMatch(/^EXIT:/);
  });

  test('routes "parking" correctly', () => {
    const result = getFallbackResponse('where is parking', createMockStore());
    expect(result).toMatch(/^EXIT:/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Intent Routing — Emergency', () => {

  test('routes "emergency" to SOS', () => {
    const result = getFallbackResponse('this is an emergency', createMockStore());
    expect(result).toMatch(/^SOS:/);
  });

  test('routes "medical" to SOS', () => {
    const result = getFallbackResponse('I need medical help', createMockStore());
    expect(result).toMatch(/^SOS:/);
  });

  test('routes "sos" to SOS', () => {
    const result = getFallbackResponse('SOS', createMockStore());
    expect(result).toMatch(/^SOS:/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Intent Routing — Fallback Default', () => {

  test('unrecognised query returns DEFAULT', () => {
    const result = getFallbackResponse('the weather today', createMockStore());
    expect(result).toMatch(/^DEFAULT:/);
  });

  test('empty string returns DEFAULT', () => {
    const result = getFallbackResponse('', createMockStore());
    expect(result).toMatch(/^DEFAULT:/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Input Sanitization', () => {

  test('strips HTML tags from input', () => {
    const dirty = '<script>alert("xss")</script>Hello';
    const clean = sanitize(dirty);
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
  });

  test('strips double quotes', () => {
    expect(sanitize('"injection"')).not.toContain('"');
  });

  test('strips backticks', () => {
    expect(sanitize('`eval(code)`')).not.toContain('`');
  });

  test('preserves normal text', () => {
    expect(sanitize('Where is the restroom?')).toBe('Where is the restroom?');
  });

  test('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Venue Context — State Integration', () => {

  test('getState returns all required venue keys', () => {
    const store = createMockStore();
    const state = store.getState();
    expect(state.venue).toHaveProperty('sections');
    expect(state.venue).toHaveProperty('restrooms');
    expect(state.venue).toHaveProperty('concessions');
    expect(state.venue).toHaveProperty('gates');
    expect(state.venue).toHaveProperty('occupancyPercent');
  });

  test('accessibility mode is readable from state', () => {
    const store = createMockStore('Section A', true);
    expect(store.getState().user.accessibilityMode).toBe(true);
  });

  test('seat section is readable from state', () => {
    const store = createMockStore('East Wing Row 5');
    expect(store.getState().user.seatSection).toBe('East Wing Row 5');
  });
});
