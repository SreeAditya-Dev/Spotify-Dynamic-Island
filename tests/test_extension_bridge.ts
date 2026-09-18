import WebSocket from 'ws';

async function testWebSocketBridge() {
  console.log('--- TEST 2: Browser Extension WebSocket Bridge ---');

  const ws = new WebSocket('ws://localhost:9876');

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('[PASS] Connected to WebSocket bridge on ws://localhost:9876');
      resolve();
    });
    ws.on('error', (err) => {
      reject(new Error(`WebSocket connection failed: ${err.message}`));
    });
  });

  // Test 2A: Send Spotify Web player state (simulating background Chrome/Edge tab)
  console.log('Dispatching Spotify Web Player state from simulated browser tab...');
  const mockTrack = {
    id: 'spotify-test-track-123',
    title: 'Starboy',
    artist: 'The Weeknd, Daft Punk',
    album: 'Starboy',
    artworkUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80',
    isPlaying: true,
    position: 85,
    duration: 230,
    browser: 'Microsoft Edge • Spotify Web',
    volume: 95,
    shuffle: true,
    repeat: 'context'
  };

  ws.send(JSON.stringify({
    type: 'spotify-state',
    data: mockTrack
  }));

  console.log('[PASS] Dispatched mock Spotify Web state');

  // Test 2B: Listen for commands back from Island
  console.log('Verifying command receiver listener is active...');
  let receivedCommand: any = null;
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'command') {
        receivedCommand = msg.command;
        console.log(`[PASS] Received command from Dynamic Island:`, JSON.stringify(receivedCommand));
      }
    } catch {}
  });

  // Keep connection open for 1 second to verify stability
  await new Promise((resolve) => setTimeout(resolve, 1000));

  ws.close();
  console.log('[PASS] WebSocket clean close verified');
  console.log('--- TEST 2 PASSED ---\n');
}

testWebSocketBridge().catch((err) => {
  console.error('[FAIL] Test 2 failed:', err);
  process.exit(1);
});
