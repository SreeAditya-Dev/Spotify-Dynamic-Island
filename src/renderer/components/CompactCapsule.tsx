import React from 'react';
import { MediaState } from '../../types/media';
import { AudioVisualizer } from './AudioVisualizer';
import { Music } from 'lucide-react';

interface CompactCapsuleProps {
  media: MediaState;
  hasTrack: boolean;
}

export const CompactCapsule: React.FC<CompactCapsuleProps> = ({ media, hasTrack }) => {
  if (!hasTrack) {
    return (
      <div className="flex items-center justify-between w-full h-full px-3.5 text-neutral-400">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-spotify-dark flex items-center justify-center border border-white/10">
            <Music className="w-3 h-3 text-spotify-green" />
          </div>
          <span className="text-[11.5px] font-medium tracking-tight text-neutral-300">Spotify Island</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full h-full px-2.5 gap-2.5">
      {/* Left: Album Artwork thumbnail */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/15 shadow-sm bg-neutral-900 flex-shrink-0">
          {media.artworkUrl ? (
            <img
              src={media.artworkUrl}
              alt="Art"
              className={`w-full h-full object-cover transition-transform duration-700 ${
                media.isPlaying ? 'scale-105' : 'scale-100 opacity-90'
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-800">
              <Music className="w-3 h-3 text-spotify-green" />
            </div>
          )}
        </div>
      </div>

      {/* Center: Track title only - the artist belongs to the expanded card */}
      <div className="flex-1 min-w-0 flex items-center overflow-hidden">
        <span className="w-full text-[12px] font-semibold text-white truncate tracking-tight">
          {media.title || 'Playing Music'}
        </span>
      </div>

      {/* Right: Audio Visualizer */}
      <div className="flex items-center flex-shrink-0 pr-1">
        <AudioVisualizer isPlaying={media.isPlaying} barColor="#1DB954" size="sm" />
      </div>
    </div>
  );
};
