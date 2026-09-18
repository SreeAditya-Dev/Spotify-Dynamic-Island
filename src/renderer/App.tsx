import React, { useState, useEffect, useRef } from 'react';
import { MediaState, MediaCommand } from '../types/media';
import { CompactCapsule } from './components/CompactCapsule';
import { ExpandedCapsule } from './components/ExpandedCapsule';

// Declaring global window bridge type
declare global {
  interface Window {
    dynamicIsland: {
      onMediaState: (callback: (state: MediaState) => void) => () => void;
      sendCommand: (cmd: MediaCommand) => Promise<boolean>;
      getInitialState: () => Promise<MediaState>;
      setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => void;
      setPinned: (pinned: boolean) => void;
      setDemoMode: (enabled: boolean) => void;
      expandIsland: () => void;
      collapseIsland: () => void;
      openSpotifyWeb: () => void;
      minimizeApp: () => void;
      closeApp: () => void;
    };
  }
}

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
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to Media Updates from Main process
  useEffect(() => {
    if (window.dynamicIsland) {
      window.dynamicIsland.getInitialState().then((init) => {
        if (init) setMedia(init);
      });

      const cleanup = window.dynamicIsland.onMediaState((newState) => {
        setMedia(newState);
      });

      return cleanup;
    }
  }, []);

  const handleCommand = (cmd: MediaCommand) => {
    if (window.dynamicIsland) {
      window.dynamicIsland.sendCommand(cmd);
    }
  };

  const handleMouseEnter = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsHovered(true);
    window.dynamicIsland?.expandIsland();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!isPinned) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = setTimeout(() => {
        window.dynamicIsland?.collapseIsland();
      }, 350);
    }
  };

  const togglePin = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    window.dynamicIsland?.setPinned(nextPinned);
    if (nextPinned) {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
      window.dynamicIsland?.expandIsland();
    } else if (!isHovered) {
      window.dynamicIsland?.collapseIsland();
    }
  };

  const toggleDemo = () => {
    if (!isDemoActive) {
      setIsDemoActive(true);
      const track = DEMO_PLAYLIST[0];
      if (window.dynamicIsland) {
        window.dynamicIsland.setDemoMode(true);
      }
      setMedia(prev => ({
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
    } else {
      const nextIdx = (demoIndex + 1) % DEMO_PLAYLIST.length;
      if (nextIdx === 0) {
        // Turn off demo
        setIsDemoActive(false);
        if (window.dynamicIsland) {
          window.dynamicIsland.setDemoMode(false);
        }
      } else {
        setDemoIndex(nextIdx);
        const track = DEMO_PLAYLIST[nextIdx];
        setMedia(prev => ({
          ...prev,
          title: track.title!,
          artist: track.artist!,
          album: track.album!,
          artworkUrl: track.artworkUrl!,
          position: 0,
          duration: track.duration!,
          timestamp: Date.now()
        }));
      }
    }
  };

  const isExpanded = isHovered || isPinned;
  const hasTrack = Boolean(media.title || media.artist);

  // Calculate dynamic dimensions
  let islandWidth = 240;
  let islandHeight = 38;
  let borderRadius = 9999;

  if (isExpanded) {
    islandWidth = 450;
    islandHeight = 195;
    borderRadius = 28;
  } else if (!hasTrack) {
    islandWidth = 155;
    islandHeight = 34;
    borderRadius = 9999;
  }

  return (
    <main className="relative flex flex-col items-center justify-start w-screen h-screen pt-2 overflow-hidden select-none bg-transparent">
      {/* Ambient reactive backdrop glow */}
      {hasTrack && (
        <div
          className="ambient-glow"
          style={{
            width: `${islandWidth * 0.85}px`,
            height: `${islandHeight * 0.85}px`,
            top: '12px',
            backgroundColor: media.isPlaying ? '#1DB954' : '#ffffff',
            opacity: isExpanded ? 0.35 : 0.2
          }}
        />
      )}

      {/* Main Dynamic Island Capsule */}
      <section
        aria-label="Spotify Dynamic Island"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: `${islandWidth}px`,
          height: `${islandHeight}px`,
          borderRadius: `${borderRadius}px`,
        }}
        className="island-container island-surface relative flex items-center justify-center overflow-hidden cursor-default transition-all shadow-2xl"
      >
        {isExpanded ? (
          <div className="w-full h-full animate-island-spring">
            <ExpandedCapsule
              media={media}
              onCommand={handleCommand}
              isPinned={isPinned}
              onTogglePin={togglePin}
              onToggleDemo={toggleDemo}
              isDemoActive={isDemoActive}
            />
          </div>
        ) : (
          <div className="w-full h-full transition-opacity duration-200">
            <CompactCapsule media={media} hasTrack={hasTrack} />
          </div>
        )}
      </section>
    </main>
  );
};
