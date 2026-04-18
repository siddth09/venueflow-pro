/**
 * VenueFlow Pro — App Orchestrator (main.js)
 * Single Responsibility: boots the app, wires up all controllers, manages tab routing.
 * Entry point loaded as ES Module from index.html.
 */

import store from './engine/state.js';
import { CrowdSimulator } from './engine/simulator.js';
import { AssistantController } from './components/AssistantController.js';
import { MapController } from './components/MapController.js';
import { OrderController } from './components/OrderController.js';
import { NotificationController } from './components/NotificationController.js';

class VenueFlowApp {
  constructor() {
    this.store = store;
    this._controllers = {};
    this._simulator = null;
    this._initialized = false;
  }

  /** Boot sequence — called after DOM ready. */
  init() {
    this._setupEntryScreen();
    this._setupAccessibilityControls();
    this._setupSectionSelectedListener();
  }

  /** Shows the check-in entry screen; on submit, launches main app. */
  _setupEntryScreen() {
    const entryScreen = document.getElementById('entry-screen');
    const mainApp = document.getElementById('main-app');
    const seatForm = document.getElementById('seat-form');
    const seatInput = document.getElementById('seat-input');

    if (!seatForm || !seatInput) return;

    seatForm.addEventListener('submit', e => {
      e.preventDefault();
      const rawSeat = seatInput.value.trim();
      if (!rawSeat) return;

      // Sanitize seat input
      const seat = rawSeat.replace(/[<>"'`]/g, '').substring(0, 40);
      this.store.setState({ user: { seatSection: seat, hasCheckedIn: true } });

      // Update greeting
      const greetingEl = document.getElementById('user-seat-label');
      if (greetingEl) greetingEl.textContent = `Seat: ${seat}`;

      // Transition
      entryScreen.classList.add('fade-out');
      setTimeout(() => {
        entryScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('fade-in');
        this._launchApp();
      }, 400);
    });
  }

  /** Launches main app after check-in. */
  _launchApp() {
    if (this._initialized) return;
    this._initialized = true;

    // Start crowd simulation
    this._simulator = new CrowdSimulator(this.store);
    this._simulator.start();

    // Boot notification controller
    this._controllers.notifications = new NotificationController(this.store);

    // Setup tab navigation
    this._setupTabs();

    // Subscribe to phase changes for proactive notifications
    this.store.subscribe('event', event => this._onPhaseChange(event.phase));

    // Initial welcome toast
    setTimeout(() => {
      this._controllers.notifications.showToast({
        type: 'info',
        title: '🏏 Match Day!',
        message: 'MI vs CSK — Kickoff in 30 minutes. Check the Home tab for live recommendations.',
        duration: 6000,
      });
    }, 1500);
  }

  /** Initialises tab navigation and lazy-loads controllers on first visit. */
  _setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this._switchTab(targetTab, tabs, panels);
      });

      tab.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') this._focusNextTab(tab, tabs, 1);
        if (e.key === 'ArrowLeft')  this._focusNextTab(tab, tabs, -1);
      });
    });

    // Activate home tab by default
    this._switchTab('home', tabs, panels);
  }

  _switchTab(tabId, tabs, panels) {
    tabs.forEach(t => {
      const isActive = t.dataset.tab === tabId;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      t.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach(p => {
      const isActive = p.id === `tab-${tabId}`;
      p.classList.toggle('hidden', !isActive);
      p.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    this.store.setState({ activeTab: tabId });
    this._lazyInitController(tabId);
  }

  _focusNextTab(currentTab, tabs, direction) {
    const arr = Array.from(tabs);
    const idx = arr.indexOf(currentTab);
    const next = arr[(idx + direction + arr.length) % arr.length];
    next?.focus();
    next?.click();
  }

  /** Lazy-initialises heavy controllers only when their tab is first opened. */
  _lazyInitController(tabId) {
    if (this._controllers[tabId]) return;

    switch (tabId) {
      case 'chat':
        this._controllers.chat = new AssistantController(
          this.store,
          document.getElementById('chat-messages'),
          document.getElementById('chat-input'),
          document.getElementById('chat-send-btn')
        );
        break;

      case 'map':
        this._controllers.map = new MapController(
          this.store,
          document.getElementById('svg-heatmap-container'),
          document.getElementById('google-maps-container')
        );
        break;

      case 'food':
        this._controllers.food = new OrderController(this.store);
        break;

      case 'home':
        this._initHomeTab();
        break;

      case 'navigate':
        this._initNavigateTab();
        break;
    }
    this._controllers[tabId] = this._controllers[tabId] || true;
  }

  /** Home tab: live event banner, wait time cards, smart recommendations. */
  _initHomeTab() {
    this._renderEventPhase();
    this._renderWaitCards();
    this._renderSmartRecs();

    this.store.subscribe('event', () => this._renderEventPhase());
    this.store.subscribe('venue', () => {
      this._renderWaitCards();
      this._renderSmartRecs();
    });

    // Live countdown
    this._startCountdown();
  }

  _renderEventPhase() {
    const phase = this.store.computeEventPhase();
    const phaseEl = document.getElementById('event-phase-badge');
    if (!phaseEl) return;

    const labels = {
      pre_game: { label: 'Pre-Game', color: 'blue', icon: '⏰' },
      game_active: { label: 'Live', color: 'green', icon: '🟢' },
      halftime_approaching: { label: 'Halftime Soon!', color: 'amber', icon: '⚡' },
      halftime: { label: 'Halftime', color: 'amber', icon: '☕' },
      game_ending: { label: 'Final Over', color: 'purple', icon: '🏆' },
      post_game: { label: 'Post-Game', color: 'red', icon: '🎊' },
    };
    const info = labels[phase] || labels['game_active'];
    phaseEl.textContent = `${info.icon} ${info.label}`;
    phaseEl.className = `phase-badge phase-badge--${info.color}`;
    phaseEl.setAttribute('aria-label', `Event phase: ${info.label}`);
  }

  _startCountdown() {
    const el = document.getElementById('kickoff-countdown');
    if (!el) return;
    const update = () => {
      const diff = this.store.getState().event.startTime - Date.now();
      if (diff <= 0) { el.textContent = 'Match Live!'; return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `Kickoff in ${m}m ${s < 10 ? '0' + s : s}s`;
    };
    update();
    setInterval(update, 1000);
  }

  _renderWaitCards() {
    const container = document.getElementById('wait-cards-container');
    if (!container) return;
    const venue = this.store.getState().venue;

    const highlights = [
      ...venue.restrooms.slice(0, 2).map(r => ({ ...r, icon: '🚻', color: r.waitTime < 5 ? 'green' : r.waitTime < 10 ? 'amber' : 'red' })),
      ...venue.concessions.slice(0, 2).map(c => ({ ...c, icon: '🍔', color: c.waitTime < 5 ? 'green' : c.waitTime < 10 ? 'amber' : 'red' })),
      ...venue.gates.slice(0, 2).map(g => ({ ...g, icon: '🚪', color: g.waitTime < 5 ? 'green' : g.waitTime < 10 ? 'amber' : 'red' })),
    ];

    container.innerHTML = '';
    highlights.forEach(item => {
      const card = document.createElement('div');
      card.className = `wait-card wait-card--${item.color}`;
      card.setAttribute('role', 'status');
      card.setAttribute('aria-live', 'polite');
      card.setAttribute('aria-label', `${item.label}: ${item.waitTime} minute wait`);

      const iconEl = document.createElement('div');
      iconEl.className = 'wait-card-icon';
      iconEl.setAttribute('aria-hidden', 'true');
      iconEl.textContent = item.icon;

      const nameEl = document.createElement('div');
      nameEl.className = 'wait-card-name';
      nameEl.textContent = item.label.replace(/^(Restroom|Food Court|Gate) — /, '');

      const timeEl = document.createElement('div');
      timeEl.className = 'wait-card-time';
      timeEl.textContent = `${item.waitTime} min`;

      const trendEl = document.createElement('div');
      trendEl.className = 'wait-card-trend';
      trendEl.setAttribute('aria-hidden', 'true');
      trendEl.textContent = item.waitTime < 6 ? '↓ Low' : item.waitTime < 11 ? '→ Stable' : '↑ High';

      card.appendChild(iconEl);
      card.appendChild(nameEl);
      card.appendChild(timeEl);
      card.appendChild(trendEl);
      container.appendChild(card);
    });
  }

  _renderSmartRecs() {
    const container = document.getElementById('smart-recs-container');
    if (!container) return;
    const phase = this.store.computeEventPhase();
    const venue = this.store.getState().venue;

    const recs = [];
    const bestRestroom = [...venue.restrooms].sort((a, b) => a.waitTime - b.waitTime)[0];
    const bestFood = [...venue.concessions].sort((a, b) => a.waitTime - b.waitTime)[0];
    const quietSection = [...venue.sections].sort((a, b) => a.density - b.density)[0];

    if (phase === 'pre_game' || phase === 'halftime_approaching') {
      recs.push({ icon: '💡', priority: 'high', text: `Visit ${bestRestroom?.label} now — only ${bestRestroom?.waitTime} min wait before the rush.` });
      recs.push({ icon: '🍔', priority: 'medium', text: `${bestFood?.label} has the shortest food queue at ${bestFood?.waitTime} min.` });
    } else if (phase === 'halftime') {
      recs.push({ icon: '⚡', priority: 'high', text: `Halftime! Crowd surge expected. ${bestRestroom?.label} still has shortest wait (${bestRestroom?.waitTime} min).` });
    } else {
      recs.push({ icon: '🗺️', priority: 'low', text: `${quietSection?.label} is the least crowded zone (${Math.round((quietSection?.density ?? 0.5) * 100)}% capacity).` });
      recs.push({ icon: '🍔', priority: 'medium', text: `Best food option: ${bestFood?.label} — only ${bestFood?.waitTime} min wait.` });
    }

    container.innerHTML = '';
    recs.forEach(rec => {
      const item = document.createElement('div');
      item.className = `rec-item rec-item--${rec.priority}`;
      item.setAttribute('role', 'listitem');

      const iconEl = document.createElement('span');
      iconEl.className = 'rec-icon';
      iconEl.setAttribute('aria-hidden', 'true');
      iconEl.textContent = rec.icon;

      const textEl = document.createElement('p');
      textEl.className = 'rec-text';
      textEl.textContent = rec.text;

      item.appendChild(iconEl);
      item.appendChild(textEl);
      container.appendChild(item);
    });
  }

  _initNavigateTab() {
    const user = this.store.getState().user;
    const destSelect = document.getElementById('nav-destination');
    const goBtn = document.getElementById('nav-go-btn');
    const stepsEl = document.getElementById('nav-steps');
    const accToggle = document.getElementById('acc-route-toggle');

    if (!goBtn || !stepsEl) return;

    goBtn.addEventListener('click', () => {
      const dest = destSelect?.value || 'seating';
      const accessibilityMode = accToggle?.checked || user.accessibilityMode;
      const steps = this._computeSteps(dest, accessibilityMode);
      this._renderNavSteps(stepsEl, steps, dest);
    });
  }

  _computeSteps(dest, accessibilityMode) {
    const venue = this.store.getState().venue;
    const quietGate = [...venue.gates].sort((a, b) => a.waitTime - b.waitTime)[0];
    const useElevator = accessibilityMode;

    const routeMap = {
      seating:     [
        `Head to ${quietGate?.label} (${quietGate?.waitTime} min wait — least crowded)`,
        useElevator ? 'Take elevator on Level 1 (signposted ♿)' : 'Take stairs to your level',
        'Follow aisle signs to your section',
        `Arrive at ${this.store.getState().user.seatSection || 'your seat'}`,
      ],
      restroom:    [
        'Find nearest restroom via map tab — shortest wait highlighted',
        useElevator ? 'Use accessible corridor on Level 1' : 'Walk through main concourse',
        `Restroom ${venue.restrooms.sort((a,b)=>a.waitTime-b.waitTime)[0]?.label} — ${venue.restrooms[0]?.waitTime} min wait`,
      ],
      food:        [
        `Head to ${venue.concessions.sort((a,b)=>a.waitTime-b.waitTime)[0]?.label}`,
        'Lowest crowd — expected wait: ' + venue.concessions.sort((a,b)=>a.waitTime-b.waitTime)[0]?.waitTime + ' min',
        'Or order in-seat via Food tab — no queuing!',
      ],
      exit:        [
        `${venue.gates.sort((a,b)=>a.waitTime-b.waitTime)[0]?.label} has the shortest exit queue`,
        'Wait 8-10 minutes after final whistle for post-game rush to ease',
        'Uber & auto pickup zone: West entrance on SV Road',
      ],
    };
    return routeMap[dest] || routeMap.seating;
  }

  _renderNavSteps(stepsEl, steps, dest) {
    stepsEl.innerHTML = '';
    const destLabels = { seating: '🪑 To Seat', restroom: '🚻 To Restroom', food: '🍔 To Food', exit: '🚪 Exit Route' };

    const title = document.createElement('h3');
    title.className = 'nav-route-title';
    title.textContent = destLabels[dest] || 'Route';
    stepsEl.appendChild(title);

    const list = document.createElement('ol');
    list.className = 'nav-steps-list';
    list.setAttribute('aria-label', 'Navigation steps');
    steps.forEach((step, i) => {
      const li = document.createElement('li');
      li.className = 'nav-step';
      const num = document.createElement('span');
      num.className = 'step-num';
      num.textContent = String(i + 1);
      num.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'step-text';
      text.textContent = step;
      li.appendChild(num);
      li.appendChild(text);
      list.appendChild(li);
    });
    stepsEl.appendChild(list);
  }

  _setupAccessibilityControls() {
    const accToggle = document.getElementById('accessibility-toggle');
    const contrastToggle = document.getElementById('contrast-toggle');

    accToggle?.addEventListener('change', e => {
      const mode = e.target.checked;
      this.store.setState({ user: { accessibilityMode: mode } });
      document.body.classList.toggle('accessibility-mode', mode);
    });

    contrastToggle?.addEventListener('change', e => {
      const mode = e.target.checked;
      this.store.setState({ user: { highContrastMode: mode } });
      document.body.classList.toggle('high-contrast', mode);
    });
  }

  _setupSectionSelectedListener() {
    document.addEventListener('section-selected', e => {
      const { label, density, label: bandLabel } = e.detail;
      if (this._controllers.notifications) {
        this._controllers.notifications.showToast({
          type: density > 85 ? 'warning' : 'info',
          title: `📍 ${label}`,
          message: `${density}% full — ${bandLabel}. ${density > 75 ? 'Consider facilities in adjacent sections.' : 'Good time to visit nearby facilities!'}`,
          duration: 4000,
        });
      }
    });
  }

  _onPhaseChange(phase) {
    const notif = this._controllers.notifications;
    if (!notif) return;
    if (phase === 'halftime_approaching') {
      notif.showToast({ type: 'warning', title: '⚡ Halftime in ~5 minutes', message: 'Visit restrooms and grab food NOW — queues will triple at halftime.', duration: 8000 });
    }
    if (phase === 'post_game') {
      notif.showToast({ type: 'info', title: '🏆 Match Over!', message: 'Use Gate C for shortest exit (3 min wait). Wait 10 min for crowd to ease.', duration: 8000 });
    }
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const app = new VenueFlowApp();
  app.init();
  window.__vfApp = app; // Expose for debugging
});
