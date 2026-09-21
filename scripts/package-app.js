import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Step 1: Building production bundle (TypeScript & Vite)...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

const releaseDir = path.join(rootDir, 'release', 'Nilo');
console.log(`📦 Step 2: Preparing standalone application directory at: ${releaseDir}`);

if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true });
}

// 1. Copy Electron distribution runtime
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');
if (!fs.existsSync(electronDist)) {
  console.error('❌ Electron distribution directory not found at', electronDist);
  process.exit(1);
}

console.log('📋 Copying Electron runtime...');
fs.cpSync(electronDist, releaseDir, { recursive: true });

// 2. Rename electron.exe -> Nilo.exe
const defaultExe = path.join(releaseDir, 'electron.exe');
const niloExe = path.join(releaseDir, 'Nilo.exe');
if (fs.existsSync(defaultExe)) {
  fs.renameSync(defaultExe, niloExe);
}

// 3. Populate resources/app
const appDir = path.join(releaseDir, 'resources', 'app');
fs.mkdirSync(appDir, { recursive: true });

console.log('📁 Copying app assets & production bundles...');
// Copy package.json with only runtime essentials
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const runtimePkg = {
  name: pkg.name,
  productName: pkg.productName || 'Nilo',
  version: pkg.version,
  main: pkg.main,
  type: pkg.type,
  dependencies: {
    ws: pkg.dependencies?.ws || '^8.0.0'
  }
};
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(runtimePkg, null, 2));

// Copy dist and dist-electron
fs.cpSync(path.join(rootDir, 'dist'), path.join(appDir, 'dist'), { recursive: true });
fs.cpSync(path.join(rootDir, 'dist-electron'), path.join(appDir, 'dist-electron'), { recursive: true });

// Copy runtime ws dependency
const wsSrc = path.join(rootDir, 'node_modules', 'ws');
const wsDest = path.join(appDir, 'node_modules', 'ws');
if (fs.existsSync(wsSrc)) {
  fs.mkdirSync(path.dirname(wsDest), { recursive: true });
  fs.cpSync(wsSrc, wsDest, { recursive: true });
}

console.log('✨ Standalone Nilo.exe created successfully!');
console.log(`📍 Executable path: ${niloExe}`);
