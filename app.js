/**
 * VenueFlow Pro — Express Server
 * Serves the static frontend and injects API keys at runtime via __ENV__ window object.
 * Security: API keys sourced ONLY from process.env — never hardcoded.
 */

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// ── Security Headers ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  next();
});

// ── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api/', apiLimiter);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '64kb' }));

// ── Runtime API Key Injection ─────────────────────────────────────────────────
// Dynamically injects API keys into index.html as window.__ENV__ at request time.
// This avoids hardcoding keys in source files.
const injectEnvScript = (html) => {
  const envVars = {
    GEMINI_API_KEY:   process.env.GEMINI_API_KEY   || '',
    GOOGLE_MAPS_KEY:  process.env.GOOGLE_MAPS_KEY  || '',
    FIREBASE_PROJECT: process.env.FIREBASE_PROJECT || '',
  };
  const envScript = `<script>window.__ENV__=${JSON.stringify(envVars)};</script>`;
  return html.replace('</head>', `${envScript}\n</head>`);
};

// Serve index.html with key injection
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  try {
    const html = fs.readFileSync(indexPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(injectEnvScript(html));
  } catch {
    res.status(500).send('Server error loading app.');
  }
});

// Serve admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API: Venue Status ─────────────────────────────────────────────────────────
app.get('/api/venue', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/mockData.json'), 'utf8'));
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, error: 'Could not load venue data.' });
  }
});

// ── Static Assets ─────────────────────────────────────────────────────────────
app.use(express.static(__dirname, {
  index: false, // served above with injection
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js'))  res.setHeader('Content-Type', 'application/javascript');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    if (filePath.endsWith('.json'))res.setHeader('Content-Type', 'application/json');
  },
}));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`VenueFlow Pro server listening on port ${PORT}`);
});

module.exports = app; // For testing
