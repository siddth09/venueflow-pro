/**
 * VenueFlow Pro — API Configuration
 * All keys are injected at runtime via server-side environment variables.
 * NEVER commit real API keys to source control.
 * See Dockerfile and Cloud Run env vars for production setup.
 */
const VENUEFLOW_CONFIG = {
  // Injected by Express server into the HTML template at runtime
  GEMINI_API_KEY:    window.__ENV__?.GEMINI_API_KEY    || '',
  GOOGLE_MAPS_KEY:   window.__ENV__?.GOOGLE_MAPS_KEY   || '',
  FIREBASE_PROJECT:  window.__ENV__?.FIREBASE_PROJECT  || 'venueflow-pro-demo',
};

// Freeze to prevent accidental mutation
Object.freeze(VENUEFLOW_CONFIG);

export default VENUEFLOW_CONFIG;
