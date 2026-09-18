import { execSync } from 'child_process';

interface TestResult {
  name: string;
  file: string;
  durationMs: number;
  status: 'PASSED' | 'FAILED';
  error?: string;
}

const tests = [
  { name: 'Artwork Resolver & Caching', file: 'tests/test_artwork_resolver.ts' },
  { name: 'Browser Extension WebSocket Bridge', file: 'tests/test_extension_bridge.ts' },
  { name: 'MediaManager State Machine & Command Router', file: 'tests/test_media_manager.ts' },
  { name: 'Windows GSMTC Persistent Daemon', file: 'tests/test_windows_smtc.ts' },
  { name: 'Production Bundle & Extension Integrity', file: 'tests/test_bundle_integrity.ts' }
];

async function runAll() {
  console.log('====================================================');
  console.log('  🏝️  SPOTIFY DYNAMIC ISLAND - FULL TEST SUITE');
  console.log('====================================================\n');

  const results: TestResult[] = [];
  const overallStart = Date.now();

  for (const t of tests) {
    console.log(`▶ Running: ${t.name} (${t.file})...`);
    const start = Date.now();
    try {
      execSync(`pnpm tsx ${t.file}`, { stdio: 'inherit' });
      const durationMs = Date.now() - start;
      results.push({
        name: t.name,
        file: t.file,
        durationMs,
        status: 'PASSED'
      });
    } catch (err: any) {
      const durationMs = Date.now() - start;
      results.push({
        name: t.name,
        file: t.file,
        durationMs,
        status: 'FAILED',
        error: err.message
      });
    }
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log('\n====================================================');
  console.log('                 TEST RESULTS SUMMARY               ');
  console.log('====================================================');
  
  let allPassed = true;
  for (const r of results) {
    const badge = r.status === 'PASSED' ? '✅ PASS' : '❌ FAIL';
    console.log(` ${badge} | ${r.name.padEnd(42)} | ${r.durationMs}ms`);
    if (r.status === 'FAILED') allPassed = false;
  }
  console.log('----------------------------------------------------');
  console.log(` Total Time: ${overallDuration}s | Status: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
  console.log('====================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runAll().catch(() => process.exit(1));
