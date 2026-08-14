// Inyecta las etiquetas PWA (manifest, íconos, service worker) en el
// index.html generado por `expo export --platform web`. Metro no genera
// esto solo, así que este script se corre después de cada export.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const BASE = '/653gim_app';

const headTags = `
  <link rel="manifest" href="${BASE}/manifest.webmanifest" />
  <meta name="theme-color" content="#0a0a0a" />
  <link rel="apple-touch-icon" href="${BASE}/logo653.png" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="653 Gym" />
`;

const swScript = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('${BASE}/sw.js').catch(function () {});
      });
    }
  </script>
`;

if (!html.includes('manifest.webmanifest')) {
  html = html.replace('</head>', `${headTags}</head>`);
}
if (!html.includes("register('/653gim_app/sw.js')")) {
  html = html.replace('</body>', `${swScript}</body>`);
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('PWA tags injected into dist/index.html');
