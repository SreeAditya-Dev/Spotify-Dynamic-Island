import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MediaState, MediaCommand } from '../types/media';
import {
  CAPSULE,
  CAPSULE_TOP,
  COMPACT_MAX_WIDTH,
  COMPACT_MIN_WIDTH,
  CapsuleMode,
  HotRect,
  capsuleRect
} from '../types/island';
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
    };
  }
}

/** How long the island stays open after the cursor leaves. */
const COLLAPSE_DELAY_MS = 180;
/** Matches the capsule morph duration in globals.css. */
const MORPH_DURATION_MS = 520;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
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
  const isExpanded = isHovered || isPinned;
  const mode: CapsuleMode = isExpanded ? 'expanded' : hasTrack ? 'compact' : 'idle';

  // The collapsed pill hugs its content. An offscreen copy is measured at its
  // natural width, then clamped - measuring the visible layer directly would
  // feed its own (already constrained) width back into itself.
  const measureRef = useRef<HTMLDivElement>(null);
  const [compactWidth, setCompactWidth] = useState<number>(CAPSULE.compact.width);

  useEffect(() => {
    const node = measureRef.current;
    if (!node) return;

    const update = () => {
      const natural = node.getBoundingClientRect().width;
      if (natural > 0) {
        setCompactWidth(Math.round(clamp(natural, COMPACT_MIN_WIDTH, COMPACT_MAX_WIDTH)));
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [media.title, media.artworkUrl, media.isPlaying, hasTrack]);

  const collapsedWidth = hasTrack ? compactWidth : CAPSULE.idle.width;
  const size = {
    width: isExpanded ? CAPSULE.expanded.width : collapsedWidth,
    height: CAPSULE[mode].height,
    radius: CAPSULE[mode].radius
  };

  // Tell the main process where the capsule is, so cursor hit-testing tracks it.
  useEffect(() => {
    window.dynamicIsland?.setHotRect(
      capsuleRect(mode, mode === 'expanded' ? undefined : collapsedWidth)
    );
  }, [mode, collapsedWidth]);

  // Keep the expanded layer mounted through the collapse animation so it can
  // fade out instead of vanishing mid-morph.
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

  // A drag on the seek/volume slider can leave the capsule bounds; hold the
  // island open and interactive until the button comes back up.
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

  return (
    <main className="island-stage">
      {/* Offscreen measurement copy - never visible, never interactive */}
      <div className="island-measure" aria-hidden="true">
        <div ref={measureRef} style={{ height: `${CAPSULE.compact.height}px` }}>
          <CompactCapsule media={media} hasTrack={hasTrack} />
        </div>
      </div>

      {/* Ambient reactive backdrop glow */}
      {hasTrack && (
        <div
          className="ambient-glow"
          style={{
            width: `${size.width * 0.8}px`,
            height: `${size.height * 0.8}px`,
            top: `${CAPSULE_TOP + 10}px`,
            backgroundColor: media.isPlaying ? '#1DB954' : '#ffffff',
            opacity: isExpanded ? 0.32 : 0.18
          }}
        />
      )}

      {/* Main Dynamic Island Capsule - only this morphs, the window never does */}
      <section
        aria-label="Spotify Dynamic Island"
        data-mode={mode}
        onPointerDown={() => window.dynamicIsland?.setPointerLock(true)}
        style={{
          top: `${CAPSULE_TOP}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          borderRadius: `${size.radius}px`
        }}
        className="island-capsule island-surface"
      >
        {/* Compact layer: fixed size so it never reflows while the capsule morphs */}
        <div
          className="island-layer"
          data-visible={!isExpanded}
          style={{
            width: `${collapsedWidth}px`,
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
              isPinned={isPinned}
              onTogglePin={togglePin}
            />
          </div>
        )}
      </section>
    </main>
  );
};
