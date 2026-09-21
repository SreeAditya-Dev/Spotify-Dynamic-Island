export type IslandPosition = 'center';

export interface IslandSettings {
  position: IslandPosition; // Top center display alignment
  hoverEnabled: boolean; // Expand on mouse hover
  clickToExpand: boolean; // Click to expand capsule
  topOffset: number; // Pixels from top of screen (default: 6)
  glowEnabled: boolean; // Subtle reactive backdrop illumination
  launchOnStartup: boolean; // Run automatically on system login
}

export const DEFAULT_SETTINGS: IslandSettings = {
  position: 'center',
  hoverEnabled: true,
  clickToExpand: true,
  topOffset: 6,
  glowEnabled: true,
  launchOnStartup: false
};
