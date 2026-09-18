import { resolveArtwork } from '../src/main/services/artworkResolver';

async function testArtworkResolver() {
  console.log('--- TEST 1: Artwork Resolver ---');

  // Test 1: High-res online resolution
  console.log('Testing iTunes HD Cover lookup for "Blinding Lights - The Weeknd"...');
  const start = Date.now();
  const art = await resolveArtwork('Blinding Lights', 'The Weeknd');
  const duration = Date.now() - start;
  
  if (!art || !art.startsWith('http')) {
    throw new Error(`Failed to resolve artwork: received "${art}"`);
  }
  console.log(`[PASS] Resolved high-res artwork: ${art.substring(0, 75)}... (${duration}ms)`);

  // Test 2: Cache speed check
  const startCache = Date.now();
  const cachedArt = await resolveArtwork('Blinding Lights', 'The Weeknd');
  const cacheDuration = Date.now() - startCache;
  if (cachedArt !== art) {
    throw new Error(`Cached artwork mismatch: expected "${art}", got "${cachedArt}"`);
  }
  if (cacheDuration > 10) {
    throw new Error(`Cache lookup took too long: ${cacheDuration}ms (expected <10ms)`);
  }
  console.log(`[PASS] In-memory cache hit verified: ${cacheDuration}ms`);

  // Test 3: Fallback handling
  const fallbackBase64 = 'data:image/jpeg;base64,dGVzdHRodW1i';
  const fallbackResult = await resolveArtwork('', '', fallbackBase64);
  if (fallbackResult !== fallbackBase64) {
    throw new Error(`Fallback base64 thumb failed: got "${fallbackResult}"`);
  }
  console.log('[PASS] Base64 fallback handling verified');

  console.log('--- TEST 1 PASSED ---\n');
}

testArtworkResolver().catch((err) => {
  console.error('[FAIL] Test 1 failed:', err);
  process.exit(1);
});
