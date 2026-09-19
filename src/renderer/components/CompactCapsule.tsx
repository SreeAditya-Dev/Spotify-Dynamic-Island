import React from 'react';
import { MediaState } from '../../types/media';
import { AudioVisualizer } from './AudioVisualizer';
import { Music } from 'lucide-react';

interface CompactCapsuleProps {
  media: MediaState;
  hasTrack: boolean;
}

/**
 * The collapsed pill. Fixed width, so the title is the only element allowed to
 * shrink - it truncates instead of the capsule resizing per track.
 */
export const CompactCapsule: React.FC<CompactCapsuleProps> = ({ media, hasTrack }) => {
  if (!hasTrack) {
    return (
      <div className="flex items-center w-full h-full px-3.5 gap-2 text-neutral-400">
        <div className="w-5 h-5 rounded-full bg-spotify-dark flex items-center justify-center border border-white/10 flex-shrink-0">
          <Music className="w-3 h-3 text-spotify-green" />
        </div>
        <span className="text-[11.5px] font-medium tracking-tight text-neutral-300 whitespace-nowrap">
          Spotify Island
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse flex-shrink-0 ml-0.5" />
      </div>
    );
  }

  return (
    <div className="flex items-center w-full h-full px-2.5 gap-2.5">
      {/* Album artwork thumbnail */}
      <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/15 shadow-sm bg-neutral-900 flex-shrink-0">
        {media.artworkUrl ? (
          <img
            src={media.artworkUrl}
            alt="Art"
            // No scale transform here: at a 24px diameter a 1.05x "breathing"
            // scale shifts edges by a fraction of a pixel, which forces the
            // browser into sub-pixel antialiasing and reads as a blurry image.
            // The expanded artwork has never had this transform and stays sharp.
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              media.isPlaying ? 'opacity-100' : 'opacity-80'
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-800">
            <Music className="w-3 h-3 text-spotify-green" />
          </div>
        )}
      </div>

      {/* Track title - the only shrinkable element */}
      <span className="flex-1 min-w-0 text-[12px] font-semibold text-white truncate tracking-tight">
        {media.title || 'Playing Music'}
      </span>

      {/* Audio visualizer */}
      <div className="flex items-center flex-shrink-0">
        <AudioVisualizer isPlaying={media.isPlaying} barColor="#1DB954" size="sm" />
      </div>
    </div>
  );
};
