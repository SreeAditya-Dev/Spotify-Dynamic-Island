import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MediaState, MediaCommand } from '../types/media';
import { CAPSULE, CapsuleMode, HotRect, capsuleRect, STAGE_INNER_PADDING } from '../types/island';
import { IslandSettings, DEFAULT_SETTINGS } from '../types/settings';
import { CompactCapsule } from './components/CompactCapsule';
import { ExpandedCapsule } from './components/ExpandedCapsule';

// Declaring global window bridge type
declare global {
  interface Window {
    dynamicIsland: {
      onMediaState: (callback: (state: MediaState) => void) => () => void;
      onHoverChange: (callback: (hovering: boolean) => void) => () => void;
      onTogglePinned: (callback: (pinned: boolean) => void) => () => void;
      sendCommand: (cmd: MediaCommand) => Promise<boolean>;
      getInitialState: () => Promise<MediaState>;
      setHotRect: (rect: HotRect) => void;
      setPointerLock: (locked: boolean) => void;
      setPinned: (pinned: boolean) => void;
      openSpotifyWeb: () => void;
      minimizeApp: () => void;
      closeApp: () => void;
      getSettings?: () => Promise<IslandSettings>;
      onSettingsChange?: (callback: (settings: IslandSettings) => void) => () => void;
      openSettingsWindow?: () => void;
    };
  }
}

/** How long the island stays open after the cursor leaves. */
const COLLAPSE_DELAY_MS = 180;
/** Matches the capsule morph duration in globals.css. */
const MORPH_DURATION_MS = 520;

export const App: React.FC = () => {
  const [media, setMedia] = useState<MediaState>({
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
  });

  const [settings, setSettings] = useState<IslandSettings>(DEFAULT_SETTINGS);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);

  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to media updates from the main process
  useEffect(() => {
    if (!window.dynamicIsland) return;

    window.dynamicIsland.getInitialState().then((init) => {
      if (init) setMedia(init);
    });

    return window.dynamicIsland.onMediaState(setMedia);
  }, []);

  // Subscribe to settings updates from companion app / tray
  useEffect(() => {
    if (!window.dynamicIsland?.getSettings) return;

    window.dynamicIsland.getSettings().then((s) => {
      if (s) setSettings(s);
    });

    return window.dynamicIsland.onSettingsChange?.((newSettings) => {
      setSettings(newSettings);
      if (newSettings.hoverEnabled) {
        setIsManuallyExpanded(false);
      }
    });
  }, []);

  // Hover state is owned by the main process: it hit-tests the OS cursor
  // against the capsule, so the expansion never fights a resizing window.
  useEffect(() => {
    if (!window.dynamicIsland) return;

    return window.dynamicIsland.onHoverChange((hovering) => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }

      if (hovering) {
        setIsHovered(true);
      } else {
        collapseTimerRef.current = setTimeout(() => setIsHovered(false), COLLAPSE_DELAY_MS);
      }
    });
  }, []);

  const handleCommand = useCallback((cmd: MediaCommand) => {
    window.dynamicIsland?.sendCommand(cmd);
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      window.dynamicIsland?.setPinned(next);
      return next;
    });
  }, []);

  // Tray menu pin toggle
  useEffect(() => {
    if (!window.dynamicIsland) return;
    return window.dynamicIsland.onTogglePinned(setIsPinned);
  }, []);

  const hasTrack = Boolean(media.title || media.artist);
  const isExpanded = (isHovered && settings.hoverEnabled) || isPinned || isManuallyExpanded;
  const mode: CapsuleMode = isExpanded ? 'expanded' : hasTrack ? 'compact' : 'idle';

  const size = CAPSULE[mode];

  // Tell the main process where the capsule is based on current mode and topOffset.
  useEffect(() => {
    window.dynamicIsland?.setHotRect(
      capsuleRect(mode, 'center', 0, settings.topOffset)
    );
  }, [mode, settings.topOffset]);

  // Keep the expanded layer mounted through the collapse animation so it can fade out.
  const [renderExpanded, setRenderExpanded] = useState(false);
  useEffect(() => {
    if (unmountTimerRef.current) {
      clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }

    if (isExpanded) {
      setRenderExpanded(true);
    } else {
      unmountTimerRef.current = setTimeout(() => setRenderExpanded(false), MORPH_DURATION_MS);
    }

    return () => {
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, [isExpanded]);

  useEffect(() => () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
  }, []);

  // Hold pointer lock during slider drags.
  useEffect(() => {
    const release = () => window.dynamicIsland?.setPointerLock(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, []);

  // Handle manual click to expand when hover feature is disabled
  const handleCapsuleClick = (e: React.MouseEvent) => {
    if (!settings.hoverEnabled && settings.clickToExpand && !isExpanded) {
      setIsManuallyExpanded(true);
    }
  };

  const capsuleStyle: React.CSSProperties = {
    top: `${settings.topOffset}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    borderRadius: `${size.radius}px`,
    left: '50%',
    right: 'auto',
    transform: 'translateX(-50%) translateZ(0)'
  };

  const glowStyle: React.CSSProperties = {
    width: `${size.width * 0.8}px`,
    height: `${size.height * 0.8}px`,
    top: `${settings.topOffset + 10}px`,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: media.isPlaying ? '#1DB954' : '#ffffff',
    opacity: isExpanded ? 0.32 : 0.18
  };

  return (
    <main className="island-stage">
      {/* Ambient reactive backdrop glow */}
      {hasTrack && settings.glowEnabled && (
        <div className="ambient-glow" style={glowStyle} />
      )}

      {/* Main Dynamic Island Capsule */}
      <section
        aria-label="Nilo"
        data-mode={mode}
        data-position="center"
        onClick={handleCapsuleClick}
        onPointerDown={() => window.dynamicIsland?.setPointerLock(true)}
        style={capsuleStyle}
        className="island-capsule island-surface"
      >
        {/* Compact layer: fixed size so it never reflows while the capsule morphs */}
        <div
          className="island-layer"
          data-visible={!isExpanded}
          style={{
            width: `${CAPSULE[hasTrack ? 'compact' : 'idle'].width}px`,
            height: `${CAPSULE[hasTrack ? 'compact' : 'idle'].height}px`
          }}
        >
          <CompactCapsule media={media} hasTrack={hasTrack} />
        </div>

        {/* Expanded layer */}
        {renderExpanded && (
          <div
            className="island-layer"
            data-visible={isExpanded}
            style={{
              width: `${CAPSULE.expanded.width}px`,
              height: `${CAPSULE.expanded.height}px`
            }}
          >
            <ExpandedCapsule
              media={media}
              onCommand={handleCommand}
              isPinned={isPinned || isManuallyExpanded}
              onTogglePin={() => {
                if (isManuallyExpanded && !isPinned) {
                  setIsManuallyExpanded(false);
                } else {
                  togglePin();
                }
              }}
            />
          </div>
        )}
      </section>
    </main>
  );
};
