# VenueFlow Pro

VenueFlow Pro is an AI-powered stadium companion web application. Designed for optimum fan experience with real-time crowd navigation, dynamic wait times, and a built-in AI concierge.

## Features

*   **Real-time Heatmap & Density**: SVG-based stadium view that dynamically updates crowd density limits across sections.
*   **Intelligent Intents**: AI assistant context-aware to stadium dynamics, answering "where's the nearest restroom?", avoiding crowds, or mapping exit scenarios.
*   **In-Seat Food Delivery**: Mock flow to add menu items to a cart, order to a seat section, and track via progress indicators.
*   **Admin Command Center**: Secret dashboard (`/admin`) for venue staff to monitor KPIs, section densities, and receive crowd alerts.
*   **Accessibility & UX**: High contrast modes, keyboard navigable tabs, zero-stair route selections, and screen-reader compliant structures.
*   **Google Maps Integration**: Directions service mapping from external inputs directly to the venue limits.

## Project Structure

This project uses a zero-build vanilla JS setup designed for extreme lean processing:

*   `/index.html` — The main fan application DOM.
*   `/admin.html` — The admin dashboard for staff.
*   `/style.css` — Centralized design tokens (Glassmorphism, dark theme).
*   `/src/main.js` — App bootstrapper and orchestration.
*   `/src/engine/` — Base platform logic natively (`state.js`, `simulator.js`).
*   `/src/components/` — UI controllers orchestrating sections (`MapController.js`, `AssistantController.js` etc).
*   `/src/data/` — Configuration mapping and mocked layout JSONs.

## Deploying to Vercel

The application natively supports Vercel standard hosting.
**Required Environment Variables:**
You must configure the following within your Vercel project settings:
*   `GEMINI_API_KEY`: A valid Google AI studio key for semantic requests.
*   `GOOGLE_MAPS_KEY`: For directions routing (optional: fallback behavior handles gracefully).

The configuration uses `vercel.json` to handle proper static rewrites instead of executing the Express `app.js` server which was originally used for Node.js container environments as opposed to edge-deployed serverless.

## Testing

A comprehensive Jest suite covers simulation logic and natural language intent routing:

```bash
npm install
npm test
```
