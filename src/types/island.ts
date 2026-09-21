/**
 * Single source of truth for the island geometry.
 *
 * The Electron window is a FIXED, fully click-through "stage" that never
 * resizes. Only the capsule inside it morphs, which is what makes the hover
 * expansion buttery smooth (a resizing OS window can never be animated).
 */

/** The transparent canvas the capsule lives on. Never changes size. */
export const STAGE_WIDTH = 640;
export const STAGE_HEIGHT = 360;

/** Distance from the top of the screen to the top of the stage. */
export const STAGE_TOP = 0;

/** Vertical offset of the capsule inside the stage. */
export const CAPSULE_TOP = 6;

/**
 * Capsule sizes for each visual state.
 *
 * The collapsed radii are exactly half the height rather than `9999px`: a huge
 * radius reads as a pill but cannot be interpolated, so the morph would hold
 * its pill shape and then snap square. Real values tween cleanly.
 */
export const CAPSULE = {
  idle: { width: 120, height: 34, radius: 17 },
  // Fixed width: the pill stays the same size whatever the track is called,
  // and long titles truncate rather than resizing the capsule.
  compact: { width: 200, height: 34, radius: 17 },
  expanded: { width: 460, height: 210, radius: 30 }
} as const;

export type CapsuleMode = keyof typeof CAPSULE;

/** Extra pixels around the capsule that still count as "hovering" it. */
export const HOVER_PADDING = 6;

/** A rectangle in stage (CSS) coordinates. */
export interface HotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

import { IslandPosition } from './settings';

export * from './settings';

export const STAGE_INNER_PADDING = 20;

/** Where the capsule sits inside the stage for a given mode and screen placement. */
export function capsuleRect(
  mode: CapsuleMode,
  position: IslandPosition = 'center',
  _centerOffset: number = 100,
  topOffset: number = CAPSULE_TOP
): HotRect {
  const { width, height } = CAPSULE[mode];
  let x: number;
  if (position === 'left') {
    // In left parallel side: inner edge is close to center, expands to the left
    x = STAGE_WIDTH - width - STAGE_INNER_PADDING;
  } else if (position === 'right') {
    // In right parallel side: inner edge is close to center, expands to the right
    x = STAGE_INNER_PADDING;
  } else {
    x = Math.round((STAGE_WIDTH - width) / 2);
  }

  return {
    x,
    y: topOffset,
    width,
    height
  };
}
