import React from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  barColor?: string;
  size?: 'sm' | 'md';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  barColor = '#1DB954',
  size = 'sm'
}) => {
  const heights = [
    'h-2 sm:h-3',
    'h-3.5 sm:h-4',
    'h-2.5 sm:h-3',
    'h-4 sm:h-4.5'
  ];

  const barWidth = size === 'sm' ? 'w-[2.5px]' : 'w-[3px]';
  const containerHeight = size === 'sm' ? 'h-4' : 'h-5';

  return (
    <div className={`flex items-center gap-[2.5px] ${containerHeight} px-1 justify-center`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            backgroundColor: barColor,
            animationPlayState: isPlaying ? 'running' : 'paused',
            animationDuration: `${0.8 + (i % 3) * 0.25}s`,
            animationDelay: `${i * 0.12}s`,
            transformOrigin: 'bottom'
          }}
          className={`${barWidth} rounded-full transition-all duration-300 ${
            isPlaying
              ? 'animate-wave-bar'
              : 'h-[3px] opacity-60'
          }`}
        />
      ))}
    </div>
  );
};
