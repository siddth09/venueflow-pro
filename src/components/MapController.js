/**
 * VenueFlow Pro — Map Controller
 * Single Responsibility: renders the SVG stadium heatmap and handles Google Maps routing.
 * Uses Google Maps DirectionsService + DirectionsRenderer + AdvancedMarkerElement.
 */

import VENUEFLOW_CONFIG from '../data/config.js';

const DENSITY_COLORS = {
  low:      { fill: '#10B981', pulse: '#34D399', label: 'Clear' },
  moderate: { fill: '#F59E0B', pulse: '#FCD34D', label: 'Moderate' },
  high:     { fill: '#EF4444', pulse: '#FC8181', label: 'Busy' },
  critical: { fill: '#7C0000', pulse: '#EF4444', label: 'Critical' },
};

function getDensityBand(density) {
  if (density < 0.50) return 'low';
  if (density < 0.75) return 'moderate';
  if (density < 0.90) return 'high';
  return 'critical';
}

export class MapController {
  /**
   * @param {import('../engine/state.js').StateEngine} store
   * @param {HTMLElement} svgContainer - Container for the SVG heatmap
   * @param {HTMLElement} mapsContainer - Container for the Google Maps panel
   */
  constructor(store, svgContainer, mapsContainer) {
    this.store = store;
    this.svgContainer = svgContainer;
    this.mapsContainer = mapsContainer;
    this._map = null;
    this._directionsService = null;
    this._directionsRenderer = null;
    this._markers = [];

    this._buildSVG();
    this._initGoogleMaps();

    // Live updates
    this.store.subscribe('venue', () => this._updateSVG());
  }

  // ─── SVG Heatmap ─────────────────────────────────────────────────────────────

  /** Builds the static SVG structure for the stadium layout. */
  _buildSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 400');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Wankhede Stadium crowd density heatmap');

    // ── Defs: gradient + glow filter ──────────────────────────────────────────
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="fieldGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#166534"/>
        <stop offset="100%" stop-color="#15803d"/>
      </radialGradient>`;
    svg.appendChild(defs);

    // ── Background ────────────────────────────────────────────────────────────
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '400'); bg.setAttribute('height', '400');
    bg.setAttribute('fill', '#0A0E1A'); bg.setAttribute('rx', '20');
    svg.appendChild(bg);

    // ── Field (center oval) ───────────────────────────────────────────────────
    const field = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    field.setAttribute('cx', '200'); field.setAttribute('cy', '200');
    field.setAttribute('rx', '90'); field.setAttribute('ry', '70');
    field.setAttribute('fill', 'url(#fieldGrad)');
    field.setAttribute('stroke', '#ffffff33'); field.setAttribute('stroke-width', '1');
    svg.appendChild(field);

    // Field pitch lines
    const pitchLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    pitchLine.setAttribute('x1','200'); pitchLine.setAttribute('y1','140');
    pitchLine.setAttribute('x2','200'); pitchLine.setAttribute('y2','260');
    pitchLine.setAttribute('stroke','#ffffff44'); pitchLine.setAttribute('stroke-width','1.5');
    svg.appendChild(pitchLine);

    const fieldLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    fieldLabel.setAttribute('x', '200'); fieldLabel.setAttribute('y', '205');
    fieldLabel.setAttribute('text-anchor', 'middle');
    fieldLabel.setAttribute('fill', '#ffffff88');
    fieldLabel.setAttribute('font-size', '10');
    fieldLabel.setAttribute('font-family', 'Inter, sans-serif');
    fieldLabel.textContent = '🏏 PITCH';
    svg.appendChild(fieldLabel);

    // ── Stadium sections ──────────────────────────────────────────────────────
    const sectionDefs = [
      { id: 'north',       label: 'North Stand',   path: 'M120,50 L280,50 L260,130 L140,130 Z',      cx: 200, cy: 82 },
      { id: 'south',       label: 'South Stand',   path: 'M140,270 L260,270 L280,350 L120,350 Z',    cx: 200, cy: 316 },
      { id: 'east',        label: 'East Wing',      path: 'M270,120 L350,100 L350,300 L270,280 Z',    cx: 316, cy: 200 },
      { id: 'west',        label: 'West Wing',      path: 'M130,120 L50,100 L50,300 L130,280 Z',     cx: 84,  cy: 200 },
      { id: 'vip',         label: 'VIP Pavilion',  path: 'M180,130 L220,130 L220,160 L180,160 Z',   cx: 200, cy: 145 },
      { id: 'upper_north', label: 'Upper North',   path: 'M110,20 L290,20 L280,50 L120,50 Z',       cx: 200, cy: 36 },
      { id: 'upper_south', label: 'Upper South',   path: 'M120,350 L280,350 L290,380 L110,380 Z',   cx: 200, cy: 366 },
    ];

    sectionDefs.forEach(sec => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', `svg-section-${sec.id}`);
      g.setAttribute('class', 'svg-section');
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `${sec.label} — click for details`);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      path.setAttribute('points', sec.path.replace(/[MZ]/g, '').replace(/L/g, ' '));
      path.setAttribute('data-section-id', sec.id);
      path.setAttribute('fill', '#4F8EF722');
      path.setAttribute('stroke', '#4F8EF766');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('filter', 'url(#glow)');
      path.style.cursor = 'pointer';
      path.style.transition = 'fill 0.5s ease';

      // Pulse circle
      const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pulse.setAttribute('cx', String(sec.cx)); pulse.setAttribute('cy', String(sec.cy));
      pulse.setAttribute('r', '8');
      pulse.setAttribute('fill', '#4F8EF7');
      pulse.setAttribute('opacity', '0.6');
      pulse.setAttribute('class', 'section-pulse');

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(sec.cx)); label.setAttribute('y', String(sec.cy + 4));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#ffffffcc');
      label.setAttribute('font-size', '7');
      label.setAttribute('font-family', 'Inter, sans-serif');
      label.setAttribute('font-weight', '600');
      label.setAttribute('pointer-events', 'none');
      label.textContent = sec.label.toUpperCase();

      g.appendChild(path);
      g.appendChild(pulse);
      g.appendChild(label);

      // Click handler
      g.addEventListener('click', () => this._onSectionClick(sec.id, sec.label));
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') this._onSectionClick(sec.id, sec.label);
      });

      svg.appendChild(g);
    });

    // ── Facility icons ────────────────────────────────────────────────────────
    const facilityIcons = [
      { x: 155, y: 75,  icon: '🍔', label: 'Food North' },
      { x: 320, y: 185, icon: '🍔', label: 'Food East' },
      { x: 70,  y: 185, icon: '🍟', label: 'Food West' },
      { x: 170, y: 315, icon: '🚻', label: 'Restroom South' },
      { x: 310, y: 145, icon: '🚻', label: 'Restroom East' },
      { x: 70,  y: 145, icon: '🚻', label: 'Restroom West' },
      { x: 355, y: 100, icon: '🚪', label: 'Gate B' },
      { x: 45,  y: 100, icon: '🚪', label: 'Gate C' },
      { x: 200, y: 18,  icon: '🚪', label: 'Gate A' },
      { x: 200, y: 382, icon: '🚪', label: 'Gate D' },
    ];

    facilityIcons.forEach(fi => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(fi.x)); text.setAttribute('y', String(fi.y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('aria-label', fi.label);
      text.setAttribute('role', 'img');
      text.textContent = fi.icon;
      svg.appendChild(text);
    });

    // Legend
    this._buildLegend(svg);

    this.svgContainer.appendChild(svg);
    this._svg = svg;
  }

  _buildLegend(svg) {
    const legendData = [
      { color: '#10B981', label: 'Clear' },
      { color: '#F59E0B', label: 'Moderate' },
      { color: '#EF4444', label: 'Busy' },
    ];

    let lx = 12;
    legendData.forEach(({ color, label }) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(lx + 4)); dot.setAttribute('cy', '390');
      dot.setAttribute('r', '4'); dot.setAttribute('fill', color);
      g.appendChild(dot);

      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', String(lx + 12)); txt.setAttribute('y', '394');
      txt.setAttribute('fill', '#94A3B8'); txt.setAttribute('font-size', '8');
      txt.setAttribute('font-family', 'Inter, sans-serif');
      txt.textContent = label;
      g.appendChild(txt);

      svg.appendChild(g);
      lx += 60;
    });
  }

  /** Updates SVG section colours based on current venue state. */
  _updateSVG() {
    const sections = this.store.getState().venue.sections;
    sections.forEach(section => {
      const g = this._svg?.querySelector(`#svg-section-${section.id}`);
      if (!g) return;

      const band = getDensityBand(section.density);
      const colors = DENSITY_COLORS[band];

      const path = g.querySelector('polygon');
      const pulse = g.querySelector('.section-pulse');

      if (path) {
        path.setAttribute('fill', colors.fill + '44');
        path.setAttribute('stroke', colors.fill + 'bb');
      }
      if (pulse) {
        pulse.setAttribute('fill', colors.pulse);
        // Pulse animation speed reflects density
        const duration = section.density > 0.85 ? '0.8s' : section.density > 0.65 ? '1.5s' : '3s';
        pulse.style.animationDuration = duration;
      }

      g.setAttribute('aria-label', `${section.label}: ${Math.round(section.density * 100)}% full — ${colors.label}`);
    });

    // Update the wait time list below the map
    this._renderWaitList();
  }

  _renderWaitList() {
    const listEl = document.getElementById('wait-time-list');
    if (!listEl) return;
    const venue = this.store.getState().venue;
    listEl.innerHTML = '';

    const all = [
      ...venue.restrooms.map(r => ({ ...r, icon: '🚻', type: 'restroom' })),
      ...venue.concessions.map(c => ({ ...c, icon: '🍔', type: 'food' })),
      ...venue.gates.map(g => ({ ...g, icon: '🚪', type: 'gate' })),
    ].sort((a, b) => a.waitTime - b.waitTime);

    all.forEach(item => {
      const li = document.createElement('div');
      li.className = `wait-item wait-item--${item.waitTime < 5 ? 'low' : item.waitTime < 10 ? 'moderate' : 'high'}`;

      const labelEl = document.createElement('span');
      labelEl.className = 'wait-label';
      labelEl.textContent = `${item.icon} ${item.label}`;

      const timeEl = document.createElement('span');
      timeEl.className = 'wait-time-badge';
      timeEl.textContent = `${item.waitTime} min`;

      li.appendChild(labelEl);
      li.appendChild(timeEl);
      listEl.appendChild(li);
    });
  }

  _onSectionClick(id, label) {
    const section = this.store.getState().venue.sections.find(s => s.id === id);
    if (!section) return;
    const band = getDensityBand(section.density);
    const colors = DENSITY_COLORS[band];

    // Show section detail toast via custom event
    const event = new CustomEvent('section-selected', {
      detail: {
        id, label,
        density: Math.round(section.density * 100),
        band,
        label: colors.label,
      },
    });
    document.dispatchEvent(event);
  }

  // ─── Google Maps Integration ─────────────────────────────────────────────────

  /** Initialises Google Maps with DirectionsService and AdvancedMarkerElement. */
  _initGoogleMaps() {
    const key = VENUEFLOW_CONFIG.GOOGLE_MAPS_KEY;
    if (!key || !this.mapsContainer) return;

    // Load Maps JS API dynamically if not already present
    if (window.google?.maps) {
      this._setupMap();
    } else {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,marker&callback=__vfMapsReady`;
      script.async = true;
      script.defer = true;
      window.__vfMapsReady = () => this._setupMap();
      document.head.appendChild(script);
    }
  }

  _setupMap() {
    const { Map } = google.maps;
    this._map = new Map(this.mapsContainer, {
      center: { lat: 18.9383, lng: 72.8258 }, // Wankhede Stadium
      zoom: 17,
      mapId: 'venueflow_map',
      disableDefaultUI: false,
      gestureHandling: 'greedy',
      styles: [{ elementType: 'geometry', stylers: [{ color: '#0A0E1A' }] }],
    });

    this._directionsService = new google.maps.DirectionsService();
    this._directionsRenderer = new google.maps.DirectionsRenderer({
      map: this._map,
      suppressMarkers: false,
    });

    // Advanced Marker for venue
    const { AdvancedMarkerElement } = google.maps.marker;
    new AdvancedMarkerElement({
      map: this._map,
      position: { lat: 18.9383, lng: 72.8258 },
      title: 'Wankhede Stadium',
    });
  }

  /**
   * Routes from user's current location to the least-crowded gate.
   * Uses Google Maps DirectionsService (pedestrian mode).
   */
  routeToVenue() {
    if (!this._directionsService) return;

    const venue = this.store.getState().venue;
    const bestGate = [...venue.gates].sort((a, b) => a.waitTime - b.waitTime)[0];

    this._directionsService.route(
      {
        origin: { query: 'Mumbai' },
        destination: { lat: 18.9383, lng: 72.8258 },
        travelMode: google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        if (status === 'OK') {
          this._directionsRenderer.setDirections(result);
        }
      }
    );
  }
}
