import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function testWindowsSmtc() {
  if (process.platform !== 'win32') {
    console.log('Skipping Windows SMTC test on non-Windows platform.');
    return;
  }

  console.log('--- TEST 4: Windows GSMTC Persistent Daemon ---');

  const scriptPath = path.join(process.cwd(), 'src', 'main', 'services', 'windows-smtc-daemon.ps1');
  console.log(`Spawning daemon: ${scriptPath}`);

  // Guard the WinRT names that fail *silently*: a wrong type or property just
  // yields $null inside a try/catch, so the daemon keeps reporting state while
  // artwork and the source app name are quietly always empty.
  const source = fs.readFileSync(scriptPath, 'utf8');
  if (/\.SourceAppId\b/.test(source)) {
    throw new Error('Daemon uses SourceAppId; the real property is SourceAppUserModelId');
  }
  if (!source.includes('SourceAppUserModelId')) {
    throw new Error('Daemon never reads SourceAppUserModelId');
  }
  if (source.includes('System.IO.WindowsRuntimeSystemExtensions')) {
    throw new Error('Daemon uses System.IO.WindowsRuntimeSystemExtensions, which does not exist');
  }
  if (!source.includes('System.IO.WindowsRuntimeStreamExtensions')) {
    throw new Error('Daemon never resolves System.IO.WindowsRuntimeStreamExtensions for thumbnails');
  }
  console.log('[PASS] Daemon uses the correct WinRT type and property names');

  const ps = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });

  let isReady = false;
  let receivedState: any = null;
  let stderrText = '';
  ps.stderr.on('data', (chunk) => {
    stderrText += chunk.toString('utf8');
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ps.kill();
      reject(new Error('Timed out waiting for GSMTC daemon ready/state'));
    }, 10000);

    let buffer = '';
    ps.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line === 'DAEMON_READY') {
          isReady = true;
          console.log('[PASS] Received DAEMON_READY signal from PowerShell');
          // Request manual poll
          ps.stdin.write('POLL\n');
        } else if (line.startsWith('STATE:')) {
          const json = line.substring(6);
          try {
            receivedState = JSON.parse(json);
            console.log('[PASS] Successfully parsed GSMTC STATE payload:');
            console.log(`       Playing: ${receivedState.isPlaying}, Title: "${receivedState.title || '(none)'}", Artist: "${receivedState.artist || '(none)'}"`);
            clearTimeout(timeout);
            ps.stdin.write('EXIT\n');
            resolve();
          } catch (e: any) {
            console.error('Invalid JSON from daemon:', json);
          }
        }
      }
    });

    ps.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  if (!isReady) throw new Error('Daemon was not ready');
  if (!receivedState) throw new Error('Did not receive state from daemon');

  // Verify structure
  const requiredKeys = ['isPlaying', 'title', 'artist', 'album', 'position', 'duration', 'artworkUrl'];
  for (const k of requiredKeys) {
    if (!(k in receivedState)) {
      throw new Error(`Missing expected key in GSMTC state: "${k}"`);
    }
  }
  console.log('[PASS] Validated all required GSMTC schema fields');

  if (stderrText.trim()) {
    throw new Error(`Daemon wrote to stderr (silent breakage): ${stderrText.trim().split('\n')[0]}`);
  }
  console.log('[PASS] Daemon ran without PowerShell errors');

  // Test clean shutdown
  ps.stdin.write('EXIT\n');
  await new Promise<void>((resolve) => {
    ps.on('exit', (code) => {
      console.log(`[PASS] Daemon exited cleanly with code: ${code}`);
      resolve();
    });
  });

  console.log('--- TEST 4 PASSED ---\n');
}

testWindowsSmtc().catch((err) => {
  console.error('[FAIL] Test 4 failed:', err);
  process.exit(1);
});
