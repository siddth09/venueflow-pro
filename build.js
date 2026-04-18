const fs = require('fs');

console.log('Injecting environment variables into index.html...');

try {
  let html = fs.readFileSync('index.html', 'utf8');
  
  const envVars = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GOOGLE_MAPS_KEY: process.env.GOOGLE_MAPS_KEY || '',
    FIREBASE_PROJECT: process.env.FIREBASE_PROJECT || ''
  };
  
  const envScript = `<script>window.__ENV__=${JSON.stringify(envVars)};</script>`;
  
  // Replace the closing head tag with our injected script just before it
  html = html.replace('</head>', `${envScript}\n</head>`);
  
  fs.writeFileSync('index.html', html);
  console.log('Environment variables successfully injected.');
} catch (error) {
  console.error('Error injecting environment variables:', error);
  process.exit(1);
}
