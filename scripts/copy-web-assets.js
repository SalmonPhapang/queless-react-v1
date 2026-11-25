// Expo's static export does not reliably copy a root `public/` folder for this
// bare App.tsx setup. Copy notification assets explicitly so the service worker
// and its icon are always present in the Vercel output directory.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public');
const destination = path.join(root, 'dist');

if (!fs.existsSync(source)) process.exit(0);

fs.mkdirSync(destination, { recursive: true });
for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  // Expo injects the bundle script into public/index.html during export.
  // Copying the raw template here would overwrite that generated output.
  if (entry.name === 'index.html') continue;
  fs.copyFileSync(path.join(source, entry.name), path.join(destination, entry.name));
}
console.log('Copied public assets into dist');
