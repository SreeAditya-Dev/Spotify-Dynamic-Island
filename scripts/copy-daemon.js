import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const src = path.join(rootDir, 'src', 'main', 'services', 'windows-smtc-daemon.ps1');
const destDir = path.join(rootDir, 'dist-electron', 'main');
const dest = path.join(destDir, 'windows-smtc-daemon.ps1');

if (fs.existsSync(src)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}
