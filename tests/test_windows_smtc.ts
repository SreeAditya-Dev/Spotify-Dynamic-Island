import { spawn } from 'child_process';
import path from 'path';

async function testWindowsSmtc() {
  if (process.platform !== 'win32') {
    console.log('Skipping Windows SMTC test on non-Windows platform.');
    return;
  }

  console.log('--- TEST 4: Windows GSMTC Persistent Daemon ---');

  const scriptPath = path.join(process.cwd(), 'src', 'main', 'services', 'windows-smtc-daemon.ps1');
  console.log(`Spawning daemon: ${scriptPath}`);

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
