import React, { useState, useEffect, useRef } from 'react';
import { MediaState, MediaCommand } from '../../types/media';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2, 
  VolumeX, 
  Pin, 
  Music,
  ExternalLink
} from 'lucide-react';

interface ExpandedCapsuleProps {
  media: MediaState;
  onCommand: (cmd: MediaCommand) => void;
  isPinned: boolean;
  onTogglePin: () => void;
}

export const ExpandedCapsule: React.FC<ExpandedCapsuleProps> = ({
  media,
  onCommand,
  isPinned,
  onTogglePin
}) => {
  // Smooth local timeline estimation
  const [localPos, setLocalPos] = useState(media.position);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubVal, setScrubVal] = useState(media.position);
  const [showVolume, setShowVolume] = useState(false);
  const [localVolume, setLocalVolume] = useState(media.volume ?? 80);
  const volumeSettleUntil = useRef(0);

  // Track the system volume when it changes elsewhere, but never fight the
  // user's own drag.
  useEffect(() => {
    if (typeof media.volume !== 'number') return;
    if (performance.now() < volumeSettleUntil.current) return;
    setLocalVolume(media.isMuted ? 0 : media.volume);
  }, [media.volume, media.isMuted]);

  // SMTC reports position as an infrequent snapshot, so for a second or two
  // after a seek the app still echoes the OLD position. Without this guard the
  // scrubber visibly snaps back to where the track was before the drag.
  const seekSettleUntil = useRef(0);

  // Sync state with parent updates
  useEffect(() => {
    if (isScrubbing) return;
    if (performance.now() < seekSettleUntil.current) return;
    setLocalPos(media.position);
  }, [media.position, isScrubbing]);

  // Butter-smooth 60fps elapsed time interpolation when playing
  useEffect(() => {
    if (!media.isPlaying || isScrubbing) return;

    const startTimestamp = performance.now();
    const initialPos = media.position;

    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTimestamp) / 1000;
      const nextPos = Math.min(media.duration || 99999, initialPos + elapsed);
      setLocalPos(nextPos);
    }, 200);

    return () => clearInterval(interval);
  }, [media.isPlaying, media.position, media.duration, isScrubbing]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const totalSecs = Math.floor(seconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setIsScrubbing(true);
    setScrubVal(val);
  };

  const handleSeekCommit = () => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    setLocalPos(scrubVal);
    // Hold our own position until the OS catches up with the new one.
    seekSettleUntil.current = performance.now() + 2500;
    onCommand({ type: 'seek', position: scrubVal });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setLocalVolume(vol);
    volumeSettleUntil.current = performance.now() + 1500;
    onCommand({ type: 'volume', volume: vol });
  };

  const toggleMute = () => {
    const next = localVolume === 0 ? 70 : 0;
    setLocalVolume(next);
    volumeSettleUntil.current = performance.now() + 1500;
    onCommand({ type: 'volume', volume: next });
  };

  const currentDisplayPos = isScrubbing ? scrubVal : localPos;
  // Only offer the scrubber when the session actually accepts a seek.
  const seekable = media.canSeek !== false && media.duration > 0;
  const progressPercent = media.duration > 0 ? Math.min(100, (currentDisplayPos / media.duration) * 100) : 0;

  if (!media.title && !media.artist) {
    return (
      <div className="flex flex-col justify-between w-full h-full p-4 select-none text-white">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-neutral-500" />
            <span className="text-[10.5px] font-medium text-neutral-300 tracking-tight">
              Waiting for Spotify...
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onTogglePin}
              title={isPinned ? "Unpin Island" : "Pin Island Open"}
              className={`p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 interactive-btn ${
                isPinned ? 'text-spotify-green bg-spotify-green/15' : ''
              }`}
            >
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </button>
          </div>
        </div>

        {/* Center: Spotify Idle state */}
        <div className="flex items-center gap-3.5 my-1">
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-md">
            <Music className="w-6 h-6 text-spotify-green" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-white tracking-tight">
              No Music Playing
            </h3>
            <p className="text-[11.5px] text-neutral-400 leading-snug">
              Play any track on Spotify Desktop, Chrome, Edge, or Brave.
            </p>
          </div>
        </div>

        {/* Bottom action: launch Spotify Web */}
        <div className="flex items-center pt-1">
          <button
            onClick={() => window.dynamicIsland?.openSpotifyWeb()}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-spotify-green hover:bg-spotify-light text-black text-[11.5px] font-semibold rounded-xl transition-all interactive-btn shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Spotify Web
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between w-full h-full p-4 select-none text-white">
      {/* Top Bar: Source info & Quick Controls */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
          <span className={`w-2 h-2 rounded-full ${media.isPlaying ? 'bg-spotify-green animate-pulse' : 'bg-neutral-500'}`} />
          <span className="text-[10.5px] font-medium text-neutral-300 tracking-tight">
            {media.sourceApp || 'Spotify Dynamic Island'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Pin open toggle */}
          <button
            onClick={onTogglePin}
            title={isPinned ? "Unpin Island" : "Pin Island Open"}
            className={`p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 interactive-btn ${
              isPinned ? 'text-spotify-green bg-spotify-green/15' : ''
            }`}
          >
            <Pin className="w-3.5 h-3.5 rotate-45" />
          </button>
        </div>
      </div>

      {/* Middle Row: Album Artwork + Metadata */}
      <div className="flex items-center gap-3.5 my-1">
        {/* Cover Art with subtle glow */}
        <div className="relative group flex-shrink-0">
          <div 
            className="absolute -inset-1 rounded-2xl bg-spotify-green/30 blur-md opacity-40 group-hover:opacity-70 transition-opacity duration-300 pointer-events-none"
            style={{
              backgroundImage: media.artworkUrl ? `url(${media.artworkUrl})` : undefined,
              backgroundSize: 'cover'
            }}
          />
          <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/15 bg-neutral-900 shadow-md">
            {media.artworkUrl ? (
              <img
                src={media.artworkUrl}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                <Music className="w-6 h-6 text-spotify-green" />
              </div>
            )}
          </div>
        </div>

        {/* Track Title, Artist, Album */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className="overflow-hidden">
            <h2 className="text-[14.5px] font-bold text-white tracking-tight truncate hover:text-spotify-light transition-colors">
              {media.title || 'No Media Playing'}
            </h2>
          </div>
          <p className="text-[12px] font-medium text-neutral-400 truncate">
            {media.artist || 'Connect Spotify app or browser'}
          </p>
          {media.album && (
            <p className="text-[10.5px] text-neutral-500 truncate">
              {media.album}
            </p>
          )}
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="w-full px-0.5 mt-1">
        <div
          className={`island-scrubber group ${seekable ? '' : 'is-disabled'}`}
          title={seekable ? 'Drag to seek' : 'This app does not allow seeking'}
        >
          {/* Track + played portion */}
          <div className="island-scrubber-track">
            <div
              className="island-scrubber-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Visible handle - the old scrubber had none, so there was nothing
              to grab and no feedback that it was draggable at all. */}
          <div
            className="island-scrubber-thumb"
            style={{ left: `${progressPercent}%` }}
          />

          {/* Interactive range input, stretched over the whole row */}
          <input
            type="range"
            min={0}
            max={media.duration || 100}
            step={0.5}
            value={currentDisplayPos}
            disabled={!seekable}
            aria-label="Seek"
            onChange={handleSeekChange}
            onPointerUp={handleSeekCommit}
            onKeyUp={handleSeekCommit}
            onBlur={handleSeekCommit}
            className="island-scrubber-input"
          />
        </div>

        {/* Time Counters */}
        <div className="flex items-center justify-between text-[10.5px] text-neutral-400 font-mono tracking-wider pt-0.5">
          <span>{formatTime(currentDisplayPos)}</span>
          <span>{media.duration > 0 ? formatTime(media.duration) : '0:00'}</span>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-between pt-1">
        {/* Shuffle Button */}
        <button
          onClick={() => onCommand('toggleShuffle')}
          className={`relative p-2 rounded-full interactive-btn ${
            media.shuffle ? 'text-spotify-green' : 'text-neutral-400 hover:text-white'
          }`}
          title="Shuffle"
        >
          <Shuffle className="w-4 h-4" />
          {media.shuffle && (
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-spotify-green rounded-full" />
          )}
        </button>

        {/* Playback Cluster (Prev, Play/Pause, Next) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onCommand('previous')}
            className="p-2 text-neutral-300 hover:text-white interactive-btn"
            title="Previous Track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => onCommand('toggle')}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center interactive-btn shadow-lg hover:scale-105 active:scale-95"
            title={media.isPlaying ? "Pause" : "Play"}
          >
            {media.isPlaying ? (
              <Pause className="w-5 h-5 fill-current text-black" />
            ) : (
              <Play className="w-5 h-5 fill-current text-black translate-x-0.5" />
            )}
          </button>

          <button
            onClick={() => onCommand('next')}
            className="p-2 text-neutral-300 hover:text-white interactive-btn"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Repeat & Volume controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCommand('toggleRepeat')}
            className={`relative p-2 rounded-full interactive-btn ${
              media.repeat && media.repeat !== 'off' ? 'text-spotify-green' : 'text-neutral-400 hover:text-white'
            }`}
            title="Repeat"
          >
            <Repeat className="w-4 h-4" />
            {media.repeat && media.repeat !== 'off' && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-spotify-green rounded-full" />
            )}
          </button>

          {/* Volume: icon toggles mute, the slider sets the level */}
          {/* Click opens the slider, moving away dismisses it. Opening on hover
              as well would fight the click and toggle it straight back shut. */}
          <div className="island-volume" onPointerLeave={() => setShowVolume(false)}>
            <button
              onClick={() => setShowVolume((v) => !v)}
              onDoubleClick={toggleMute}
              className="p-2 text-neutral-400 hover:text-white interactive-btn"
              title="Volume (double-click to mute)"
            >
              {localVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-neutral-500" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <div className="island-volume-panel" data-open={showVolume}>
              <div className="island-volume-card">
              <div className="island-volume-slider group">
                <div className="island-volume-track">
                  <div
                    className="island-volume-fill"
                    style={{ width: `${localVolume}%` }}
                  />
                </div>
                <div
                  className="island-volume-thumb"
                  style={{ left: `${localVolume}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={localVolume}
                  aria-label="Volume"
                  onChange={handleVolumeChange}
                  className="island-volume-input"
                />
              </div>
              <span className="island-volume-value">{localVolume}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
