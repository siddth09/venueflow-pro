const fs = require('fs');
const path = require('path');

console.log('Building static output to /dist...');
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Helper to recursively copy directories
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest);
  let entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy static assets
fs.copyFileSync('style.css', path.join(distDir, 'style.css'));
fs.copyFileSync('admin.html', path.join(distDir, 'admin.html'));
if (fs.existsSync('src')) {
  copyDirSync(path.join(__dirname, 'src'), path.join(distDir, 'src'));
}

// Inject environment variables into index.html
try {
  let html = fs.readFileSync('index.html', 'utf8');
  const envVars = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GOOGLE_MAPS_KEY: process.env.GOOGLE_MAPS_KEY || '',
    FIREBASE_PROJECT: process.env.FIREBASE_PROJECT || ''
  };
  const envScript = `<script>window.__ENV__=${JSON.stringify(envVars)};</script>`;
  html = html.replace('</head>', `${envScript}\n</head>`);
  fs.writeFileSync(path.join(distDir, 'index.html'), html);
  console.log('Environment variables successfully injected into dist/index.html');
} catch (error) {
  console.error('Error injecting environment variables:', error);
  process.exit(1);
}
