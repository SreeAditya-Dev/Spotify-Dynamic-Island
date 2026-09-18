import { MediaManager } from '../src/main/services/mediaManager';
import { MediaState } from '../src/types/media';

async function testMediaManager() {
  console.log('--- TEST 3: MediaManager State Machine & Command Router ---');

  // Use another port for testing isolated manager so it doesn't conflict with running app
  const manager = new MediaManager();

  // Test initial state
  const initial = manager.getState();
  if (initial.isPlaying !== false) {
    throw new Error('Expected initial state isPlaying to be false');
  }
  if (initial.title !== '' || initial.artist !== '') {
    throw new Error(`Expected empty initial track, got "${initial.title}" / "${initial.artist}"`);
  }
  console.log('[PASS] Initial idle state verified');

  // Test Demo mode activation
  let receivedState: MediaState | null = null;
  manager.on('state-changed', (state) => {
    receivedState = state;
  });

  // --- Idle handling: nothing playing, no Spotify, no browser ---
  // The renderer keys its "No Music Playing" card off an empty title, so the
  // manager must collapse to a genuinely empty state rather than hold on to a
  // stale track once every source goes quiet.
  const idlePayload: MediaState = {
    id: 'idle',
    title: '',
    artist: '',
    album: '',
    artworkUrl: '',
    isPlaying: false,
    position: 0,
    duration: 0,
    source: 'system',
    timestamp: Date.now()
  };

  // A source that reports a real track, then goes away entirely.
  (manager as any).lastOsState = {
    ...idlePayload,
    id: 'x',
    title: 'Some Track',
    artist: 'Some Artist',
    isPlaying: true
  };
  (manager as any).evaluateState();
  if (!receivedState || (receivedState as MediaState).title !== 'Some Track') {
    throw new Error('Expected the playing OS track to be shown');
  }

  (manager as any).lastOsState = idlePayload;
  (manager as any).evaluateState();
  if (!receivedState || (receivedState as MediaState).title !== '') {
    throw new Error(
      `Stale track survived after the source went idle: "${(receivedState as MediaState).title}"`
    );
  }
  if ((receivedState as MediaState).isPlaying !== false) {
    throw new Error('Idle state must not report isPlaying');
  }
  console.log('[PASS] Falls back to idle when every media source goes quiet');

  // Nothing at all connected (no Spotify, no browser, no OS session).
  (manager as any).lastOsState = null;
  (manager as any).lastBrowserState = null;
  (manager as any).evaluateState();
  if (!receivedState || (receivedState as MediaState).title !== '') {
    throw new Error('Expected idle state when no source is connected');
  }
  console.log('[PASS] Idle state verified with no sources connected');

  // A paused track is still worth showing - idle means "no track at all".
  (manager as any).lastOsState = {
    ...idlePayload,
    id: 'p',
    title: 'Paused Track',
    artist: 'Paused Artist',
    isPlaying: false
  };
  (manager as any).evaluateState();
  if (!receivedState || (receivedState as MediaState).title !== 'Paused Track') {
    throw new Error('A paused track should still be displayed, not treated as idle');
  }
  console.log('[PASS] Paused track is shown rather than treated as idle');

  (manager as any).lastOsState = null;
  (manager as any).evaluateState();

  console.log('Activating Demo Mode...');
  manager.setDemoMode(true, {
    title: 'Starboy',
    artist: 'The Weeknd',
    album: 'Starboy',
    duration: 230,
    position: 45
  });

  if (!receivedState || receivedState.title !== 'Starboy' || !receivedState.isPlaying) {
    throw new Error(`Demo mode activation failed: ${JSON.stringify(receivedState)}`);
  }
  console.log('[PASS] Demo mode activation verified');

  // Test Toggle Play/Pause command
  console.log('Sending Toggle command...');
  manager.sendCommand('toggle');
  if (receivedState.isPlaying !== false) {
    throw new Error('Expected toggle to pause track');
  }
  console.log('[PASS] Pause toggle verified');

  manager.sendCommand('toggle');
  if (receivedState.isPlaying !== true) {
    throw new Error('Expected toggle to resume track');
  }
  console.log('[PASS] Play toggle verified');

  // Test Next track command
  console.log('Sending Next track command...');
  manager.sendCommand('next');
  if (receivedState.title !== 'Blinding Lights') {
    throw new Error(`Expected next track to be "Blinding Lights", got "${receivedState.title}"`);
  }
  console.log('[PASS] Next track progression verified');

  // Test Seek command
  console.log('Sending Seek command to 120s...');
  manager.sendCommand({ type: 'seek', position: 120 });
  if (receivedState.position !== 120) {
    throw new Error(`Expected position to be 120, got ${receivedState.position}`);
  }
  console.log('[PASS] Timeline seeking verified');

  // Test Volume command
  console.log('Sending Volume command to 65%...');
  manager.sendCommand({ type: 'volume', volume: 65 });
  if (receivedState.volume !== 65) {
    throw new Error(`Expected volume 65, got ${receivedState.volume}`);
  }
  console.log('[PASS] Volume control verified');

  // Test Shuffle & Repeat commands
  console.log('Sending Shuffle and Repeat toggle commands...');
  const initialShuffle = receivedState.shuffle;
  manager.sendCommand('toggleShuffle');
  if (receivedState.shuffle === initialShuffle) {
    throw new Error('Expected shuffle to toggle');
  }
  console.log('[PASS] Shuffle toggle verified');

  const initialRepeat = receivedState.repeat;
  manager.sendCommand('toggleRepeat');
  if (receivedState.repeat === initialRepeat) {
    throw new Error('Expected repeat to toggle');
  }
  console.log('[PASS] Repeat toggle verified');

  // --- Command payloads must survive the trip to the OS layer ---
  // sendCommand used to collapse {type:'seek', position} down to the string
  // 'seek', so the position (and the volume level) never reached the daemon and
  // both controls silently did nothing.
  manager.setDemoMode(false);
  const sent: any[] = [];
  (manager as any).windowsSmtc = {
    sendCommand: (cmd: any) => {
      sent.push(cmd);
      return true;
    },
    stop: () => {}
  };
  (manager as any).currentState = { ...(manager as any).currentState, source: 'browser' };

  manager.sendCommand({ type: 'seek', position: 137.5 });
  const seekCmd = sent.at(-1);
  if (typeof seekCmd !== 'object' || seekCmd.type !== 'seek' || seekCmd.position !== 137.5) {
    throw new Error(`Seek payload was lost on the way to the OS layer: ${JSON.stringify(seekCmd)}`);
  }
  console.log('[PASS] Seek position reaches the OS media layer intact');

  manager.sendCommand({ type: 'volume', volume: 42 });
  const volCmd = sent.at(-1);
  if (typeof volCmd !== 'object' || volCmd.type !== 'volume' || volCmd.volume !== 42) {
    throw new Error(`Volume payload was lost: ${JSON.stringify(volCmd)}`);
  }
  console.log('[PASS] Volume level reaches the OS media layer intact');

  manager.sendCommand('next');
  if (sent.at(-1) !== 'next') {
    throw new Error(`Plain commands should pass through unchanged: ${JSON.stringify(sent.at(-1))}`);
  }
  console.log('[PASS] Plain transport commands pass through unchanged');

  // Teardown
  manager.setDemoMode(false);
  manager.stop();
  console.log('[PASS] MediaManager clean teardown verified');

  console.log('--- TEST 3 PASSED ---\n');
}

testMediaManager().catch((err) => {
  console.error('[FAIL] Test 3 failed:', err);
  process.exit(1);
});
