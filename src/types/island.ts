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
  idle: { width: 168, height: 34, radius: 17 },
  compact: { width: 220, height: 40, radius: 20 },
  expanded: { width: 460, height: 210, radius: 30 }
} as const;

/**
 * The compact pill hugs its content instead of sitting at a fixed width, so a
 * short title does not leave a dead gap before the visualizer. Measured at
 * runtime and clamped to this range.
 */
export const COMPACT_MIN_WIDTH = 132;
export const COMPACT_MAX_WIDTH = 300;

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

/** Where the capsule sits inside the stage for a given mode. */
export function capsuleRect(mode: CapsuleMode, widthOverride?: number): HotRect {
  const { height } = CAPSULE[mode];
  const width = widthOverride ?? CAPSULE[mode].width;
  return {
    x: Math.round((STAGE_WIDTH - width) / 2),
    y: CAPSULE_TOP,
    width,
    height
  };
}
