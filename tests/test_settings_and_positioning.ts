import fs from 'fs';
import path from 'path';
import { SettingsManager } from '../src/main/services/settingsManager';
import { capsuleRect, STAGE_WIDTH, STAGE_INNER_PADDING, CAPSULE } from '../src/types/island';

async function runTests() {
  console.log('--- TEST: Settings Manager & Parallel Side Placement Geometry ---');

  const testConfigPath = path.join(process.cwd(), 'tests', 'temp_test_settings.json');
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }

  // Test 1: Settings Manager default state and persistence
  const manager = new SettingsManager(testConfigPath);
  const initial = manager.getSettings();
  if (initial.position !== 'center' || initial.hoverEnabled !== true || initial.centerOffset !== 100) {
    throw new Error('Default settings mismatch');
  }
  console.log('[PASS] SettingsManager initialized with valid parallel defaults');

  // Test 2: Update position to 'left' (Left Parallel Side)
  manager.updateSettings({ position: 'left', centerOffset: 120 });
  const leftSettings = manager.getSettings();
  if (leftSettings.position !== 'left' || leftSettings.centerOffset !== 120) {
    throw new Error('Failed to update position to left');
  }
  if (!fs.existsSync(testConfigPath)) {
    throw new Error('Settings file was not saved to disk');
  }
  console.log('[PASS] Position updated to left parallel side and persisted to disk');

  // Test 3: Update position to 'right' and toggle hover off
  manager.updateSettings({ position: 'right', hoverEnabled: false });
  const rightSettings = manager.getSettings();
  if (rightSettings.position !== 'right' || rightSettings.hoverEnabled !== false) {
    throw new Error('Failed to update position to right or toggle hover');
  }
  console.log('[PASS] Position updated to right parallel side and hover disabled');

  // Test 4: Verify Geometry Math for Next Parallel Sides
  const screenWidth = 1920;
  const screenX = 0;
  const screenCenterX = screenX + Math.round(screenWidth / 2); // 960
  const centerOffset = 100;
  const compactWidth = CAPSULE.compact.width; // 200
  const expandedWidth = CAPSULE.expanded.width; // 460

  // Case 4A: Left Parallel Side (not extreme left)
  const leftHotRect = capsuleRect('compact', 'left', centerOffset);
  const stageLeftX = (screenCenterX - centerOffset) - (STAGE_WIDTH - STAGE_INNER_PADDING);
  const capsuleScreenRightEdge = stageLeftX + leftHotRect.x + compactWidth;
  const capsuleScreenLeftEdge = stageLeftX + leftHotRect.x;

  if (capsuleScreenRightEdge !== screenCenterX - centerOffset) {
    throw new Error(`Expected left parallel capsule right edge to be ${screenCenterX - centerOffset}, got ${capsuleScreenRightEdge}`);
  }
  if (capsuleScreenLeftEdge <= 0) {
    throw new Error(`Left capsule must NOT be on extreme left border (0): left is at ${capsuleScreenLeftEdge}`);
  }
  console.log(`[PASS] Left parallel placement: capsule occupies [${capsuleScreenLeftEdge}, ${capsuleScreenRightEdge}] (parallel to center, not extreme left 0)`);

  // Case 4B: Right Parallel Side (not extreme right)
  const rightHotRect = capsuleRect('compact', 'right', centerOffset);
  const stageRightX = (screenCenterX + centerOffset) - STAGE_INNER_PADDING;
  const rightCapsuleScreenLeftEdge = stageRightX + rightHotRect.x;
  const rightCapsuleScreenRightEdge = stageRightX + rightHotRect.x + compactWidth;

  if (rightCapsuleScreenLeftEdge !== screenCenterX + centerOffset) {
    throw new Error(`Expected right parallel capsule left edge to be ${screenCenterX + centerOffset}, got ${rightCapsuleScreenLeftEdge}`);
  }
  if (rightCapsuleScreenRightEdge >= screenWidth) {
    throw new Error(`Right capsule must NOT be on extreme right border (${screenWidth}): right is at ${rightCapsuleScreenRightEdge}`);
  }
  console.log(`[PASS] Right parallel placement: capsule occupies [${rightCapsuleScreenLeftEdge}, ${rightCapsuleScreenRightEdge}] (parallel to center, not extreme right ${screenWidth})`);

  // Case 4C: Morphing behavior on parallel sides
  // When left expands, its right edge (next to center camera) stays fixed while expanding outward to the left
  const leftExpandedHotRect = capsuleRect('expanded', 'left', centerOffset);
  const leftExpandedRightEdge = stageLeftX + leftExpandedHotRect.x + expandedWidth;
  if (leftExpandedRightEdge !== screenCenterX - centerOffset) {
    throw new Error(`Left expanded right edge moved! Expected ${screenCenterX - centerOffset}, got ${leftExpandedRightEdge}`);
  }
  console.log(`[PASS] Left expanded morph: right edge stays anchored at parallel boundary ${leftExpandedRightEdge}px`);

  // When right expands, its left edge (next to center camera) stays fixed while expanding outward to the right
  const rightExpandedHotRect = capsuleRect('expanded', 'right', centerOffset);
  const rightExpandedLeftEdge = stageRightX + rightExpandedHotRect.x;
  if (rightExpandedLeftEdge !== screenCenterX + centerOffset) {
    throw new Error(`Right expanded left edge moved! Expected ${screenCenterX + centerOffset}, got ${rightExpandedLeftEdge}`);
  }
  console.log(`[PASS] Right expanded morph: left edge stays anchored at parallel boundary ${rightExpandedLeftEdge}px`);

  // Test 5: Reset Settings
  manager.resetSettings();
  const reset = manager.getSettings();
  if (reset.position !== 'center' || reset.hoverEnabled !== true || reset.centerOffset !== 100) {
    throw new Error('Reset failed to restore default settings');
  }
  console.log('[PASS] Reset restores all default configuration values');

  // Cleanup test file
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }

  console.log('--- ALL PARALLEL SETTINGS & GEOMETRY TESTS PASSED ---\n');
}

runTests().catch((e) => {
  console.error('[FAIL] Test failed:', e);
  process.exit(1);
});
