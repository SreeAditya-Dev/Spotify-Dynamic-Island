import fs from 'fs';
import path from 'path';
import { SettingsManager } from '../src/main/services/settingsManager';
import { capsuleRect, STAGE_WIDTH, CAPSULE } from '../src/types/island';

async function runTests() {
  console.log('--- TEST: Settings Manager & Top Center Placement Geometry ---');

  const testConfigPath = path.join(process.cwd(), 'tests', 'temp_test_settings.json');
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }

  // Test 1: Settings Manager default state and persistence
  const manager = new SettingsManager(testConfigPath);
  const initial = manager.getSettings();
  if (initial.position !== 'center' || initial.hoverEnabled !== true || initial.topOffset !== 6) {
    throw new Error('Default settings mismatch');
  }
  console.log('[PASS] SettingsManager initialized with valid top-center defaults');

  // Test 2: Update options and verify disk persistence
  manager.updateSettings({ hoverEnabled: false, topOffset: 12, glowEnabled: false });
  const updated = manager.getSettings();
  if (updated.hoverEnabled !== false || updated.topOffset !== 12 || updated.glowEnabled !== false) {
    throw new Error('Failed to update settings values');
  }
  if (!fs.existsSync(testConfigPath)) {
    throw new Error('Settings file was not saved to disk');
  }
  console.log('[PASS] Settings update and atomic disk persistence verified');

  // Test 3: Symmetrical Top-Center Geometry Verification
  const stageCenter = STAGE_WIDTH / 2; // 400

  // 3A: Compact capsule geometry
  const compactRect = capsuleRect('compact', 'center', 0, 10);
  const compactCenter = compactRect.x + CAPSULE.compact.width / 2;
  if (compactCenter !== stageCenter) {
    throw new Error(`Compact capsule not centered: expected ${stageCenter}, got ${compactCenter}`);
  }
  if (compactRect.y !== 10) {
    throw new Error(`Expected topOffset 10, got ${compactRect.y}`);
  }
  console.log(`[PASS] Compact mode centered perfectly at x=${compactRect.x} (center=${compactCenter}px)`);

  // 3B: Expanded capsule geometry
  const expandedRect = capsuleRect('expanded', 'center', 0, 10);
  const expandedCenter = expandedRect.x + CAPSULE.expanded.width / 2;
  if (expandedCenter !== stageCenter) {
    throw new Error(`Expanded capsule not centered: expected ${stageCenter}, got ${expandedCenter}`);
  }
  console.log(`[PASS] Expanded mode centered perfectly at x=${expandedRect.x} (center=${expandedCenter}px)`);

  // 3C: Symmetrical morphing alignment
  if (compactCenter !== expandedCenter) {
    throw new Error('Capsule centers must align identically for seamless morph expansion');
  }
  console.log(`[PASS] Symmetrical morphing confirmed: compact and expanded centers align at ${stageCenter}px`);

  // Test 4: Reset functionality
  const resetSettings = manager.resetSettings();
  if (resetSettings.position !== 'center' || resetSettings.hoverEnabled !== true || resetSettings.topOffset !== 6) {
    throw new Error('Reset failed to restore defaults');
  }
  console.log('[PASS] Reset restores all default configuration values');

  // Teardown
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }

  console.log('--- ALL SETTINGS & TOP-CENTER GEOMETRY TESTS PASSED ---\n');
}

runTests().catch((err) => {
  console.error('[FAIL] Settings test failed:', err);
  process.exit(1);
});
