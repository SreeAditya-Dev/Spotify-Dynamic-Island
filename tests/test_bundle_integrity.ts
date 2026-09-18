import fs from 'fs';
import path from 'path';

async function testBundleIntegrity() {
  console.log('--- TEST 5: Application Bundle & Extension Integrity ---');

  // Check 1: dist/index.html
  const htmlPath = path.join(process.cwd(), 'dist', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('dist/index.html is missing. Run pnpm build first.');
  }
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  if (!htmlContent.includes('<div id="root">') || !htmlContent.includes('script')) {
    throw new Error('dist/index.html does not contain valid mounting structure');
  }
  console.log('[PASS] Production HTML index verified');

  // Check 2: Electron Main and Preload bundles
  const mainBundle = path.join(process.cwd(), 'dist-electron', 'main', 'index.js');
  const preloadBundle = path.join(process.cwd(), 'dist-electron', 'preload', 'preload.cjs');
  if (!fs.existsSync(mainBundle)) {
    throw new Error('dist-electron/main/index.js is missing');
  }
  if (!fs.existsSync(preloadBundle)) {
    throw new Error('dist-electron/preload/preload.cjs is missing');
  }
  console.log(`[PASS] Electron Main Bundle: ${(fs.statSync(mainBundle).size / 1024).toFixed(1)} KB`);
  console.log(`[PASS] Electron Preload Bundle: ${(fs.statSync(preloadBundle).size / 1024).toFixed(1)} KB`);

  // Check 2b: the preload MUST be CommonJS. Electron silently refuses to load
  // an ESM preload, which leaves window.dynamicIsland undefined and kills every
  // interaction (hover expansion, playback controls, media updates).
  const preloadSource = fs.readFileSync(preloadBundle, 'utf8');
  if (/^\s*import\s|^\s*export\s/m.test(preloadSource)) {
    throw new Error('Preload bundle contains ESM syntax - Electron will not load it');
  }
  if (!preloadSource.includes('require(')) {
    throw new Error('Preload bundle is not CommonJS (no require call found)');
  }
  const mainSource = fs.readFileSync(mainBundle, 'utf8');
  if (!mainSource.includes('preload.cjs')) {
    throw new Error('Main bundle does not point at preload.cjs');
  }
  console.log('[PASS] Preload bundle is CommonJS and wired into the main bundle');

  // Check 3: Browser Extension Manifest V3
  const manifestPath = path.join(process.cwd(), 'extension', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('extension/manifest.json is missing');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 3) {
    throw new Error(`Expected manifest_version 3, got ${manifest.manifest_version}`);
  }
  if (!manifest.content_scripts || manifest.content_scripts.length === 0) {
    throw new Error('extension/manifest.json is missing content_scripts');
  }
  console.log(`[PASS] Browser Extension Manifest V3 validated: "${manifest.name}" v${manifest.version}`);

  // Check 4: Extension content and background scripts
  const contentScript = path.join(process.cwd(), 'extension', 'content.js');
  const backgroundScript = path.join(process.cwd(), 'extension', 'background.js');
  if (!fs.existsSync(contentScript) || fs.statSync(contentScript).size < 100) {
    throw new Error('extension/content.js is invalid or too small');
  }
  if (!fs.existsSync(backgroundScript)) {
    throw new Error('extension/background.js is missing');
  }
  console.log(`[PASS] Extension Content Script validated: ${(fs.statSync(contentScript).size / 1024).toFixed(1)} KB`);

  console.log('--- TEST 5 PASSED ---\n');
}

testBundleIntegrity().catch((err) => {
  console.error('[FAIL] Test 5 failed:', err);
  process.exit(1);
});
