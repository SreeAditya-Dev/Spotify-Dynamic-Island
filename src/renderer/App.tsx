import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MediaState, MediaCommand } from '../types/media';
import { CAPSULE, CAPSULE_TOP, CapsuleMode, HotRect, capsuleRect } from '../types/island';
import { CompactCapsule } from './components/CompactCapsule';
import { ExpandedCapsule } from './components/ExpandedCapsule';

// Declaring global window bridge type
declare global {
  interface Window {
    dynamicIsland: {
      onMediaState: (callback: (state: MediaState) => void) => () => void;
      onHoverChange: (callback: (hovering: boolean) => void) => () => void;
      onTogglePinned: (callback: (pinned: boolean) => void) => () => void;
      onToggleDemo: (callback: () => void) => () => void;
      sendCommand: (cmd: MediaCommand) => Promise<boolean>;
      getInitialState: () => Promise<MediaState>;
      setHotRect: (rect: HotRect) => void;
      setPointerLock: (locked: boolean) => void;
      setPinned: (pinned: boolean) => void;
      setDemoMode: (enabled: boolean) => void;
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

const DEMO_PLAYLIST: Partial<MediaState>[] = [
  {
    title: 'Starboy',
    artist: 'The Weeknd, Daft Punk',
    album: 'Starboy',
    duration: 230,
    artworkUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80'
  },
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: 200,
    artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'
  },
  {
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    duration: 203,
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'
  },
  {
    title: 'Get Lucky',
    artist: 'Daft Punk, Pharrell Williams',
    album: 'Random Access Memories',
    duration: 248,
    artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80'
  }
];

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
  const [isDemoActive, setIsDemoActive] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
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

  const toggleDemo = useCallback(() => {
    setIsDemoActive((active) => {
      if (!active) {
        const track = DEMO_PLAYLIST[0];
        window.dynamicIsland?.setDemoMode(true);
        setDemoIndex(0);
        setMedia((prev) => ({
          ...prev,
          id: 'demo-track',
          title: track.title!,
          artist: track.artist!,
          album: track.album!,
          artworkUrl: track.artworkUrl!,
          isPlaying: true,
          position: 42,
          duration: track.duration!,
          source: 'demo',
          sourceApp: 'Spotify Demo',
          timestamp: Date.now()
        }));
        return true;
      }

      const nextIdx = (demoIndex + 1) % DEMO_PLAYLIST.length;
      if (nextIdx === 0) {
        window.dynamicIsland?.setDemoMode(false);
        return false;
      }

      setDemoIndex(nextIdx);
      const track = DEMO_PLAYLIST[nextIdx];
      setMedia((prev) => ({
        ...prev,
        title: track.title!,
        artist: track.artist!,
        album: track.album!,
        artworkUrl: track.artworkUrl!,
        position: 0,
        duration: track.duration!,
        timestamp: Date.now()
      }));
      return true;
    });
  }, [demoIndex]);

  // Tray menu actions
  useEffect(() => {
    if (!window.dynamicIsland) return;
    const offPin = window.dynamicIsland.onTogglePinned(setIsPinned);
    const offDemo = window.dynamicIsland.onToggleDemo(() => toggleDemo());
    return () => {
      offPin();
      offDemo();
    };
  }, [toggleDemo]);

  const hasTrack = Boolean(media.title || media.artist);
  const isExpanded = isHovered || isPinned;
  const mode: CapsuleMode = isExpanded ? 'expanded' : hasTrack ? 'compact' : 'idle';
  const size = CAPSULE[mode];

  // Tell the main process where the capsule is, so cursor hit-testing tracks it.
  useEffect(() => {
    window.dynamicIsland?.setHotRect(capsuleRect(mode));
  }, [mode]);

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
              isPinned={isPinned}
              onTogglePin={togglePin}
              onToggleDemo={toggleDemo}
              isDemoActive={isDemoActive}
            />
          </div>
        )}
      </section>
    </main>
  );
};
