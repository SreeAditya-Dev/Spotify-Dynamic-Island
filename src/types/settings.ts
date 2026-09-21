export type IslandPosition = 'left' | 'center' | 'right';

export interface IslandSettings {
  position: IslandPosition; // 'left': left parallel side, 'center': top center, 'right': right parallel side
  hoverEnabled: boolean;
  centerOffset: number; // Pixels from screen center to the parallel side (default 100)
  edgeMargin: number; // Optional fallback / margin
  topOffset: number; // Pixels from top screen border (default 6)
  glowEnabled: boolean;
  clickToExpand: boolean;
  launchOnStartup: boolean;
}

export const DEFAULT_SETTINGS: IslandSettings = {
  position: 'center',
  hoverEnabled: true,
  centerOffset: 100, // Distance from center to the parallel side (not extreme left/right)
  edgeMargin: 0,
  topOffset: 6,
  glowEnabled: true,
  clickToExpand: true,
  launchOnStartup: false
};
