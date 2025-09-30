import React from 'react';
import { RecordingState } from '../types';

interface ControlsBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  isRecording: boolean;
  recordingDuration: number;
  timeScale: number;
  onPlayPause: () => void;
  onForward: () => void;
  onBackward: () => void;
  onTimeScaleChange: (scale: number) => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  isPlaying,
  isPaused,
  isRecording,
  recordingDuration,
  timeScale,
  onPlayPause,
  onForward,
  onBackward,
  onTimeScaleChange
}) => {
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-between bg-gray-900 p-2 border-t border-gray-700">
      {/* Playback controls */}
      <div className="flex items-center space-x-2">
        {/* Back 5s button */}
        <button
          onClick={onBackward}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
          title="Go back 5s"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.445 14.832A1 1 0 0010 14v-8a1 1 0 00-1.555-.832L3 9.168v1.664l5.445 4z" />
          </svg>
        </button>

        {/* Play/Pause button */}
        <button
          onClick={onPlayPause}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
        >
          {isPaused ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
            </svg>
          )}
        </button>

        {/* Forward button (return to live) */}
        <button
          onClick={onForward}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
          title="Return to Live Data"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11.555 14.832A1 1 0 0013 14v-8a1 1 0 00-1.555-.832L7 9.168v1.664l4.445 4z" />
          </svg>
        </button>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-500 font-mono">
            Recording {formatDuration(recordingDuration)}
          </span>
        </div>
      )}

      {/* Time scale control */}
      <div className="flex items-center space-x-2">
        <input
          type="range"
          min="-3"
          max="2"
          step="0.1"
          value={Math.log10(timeScale)}
          onChange={(e) => onTimeScaleChange(Math.pow(10, parseFloat(e.target.value)))}
          className="w-32"
        />
        <span className="text-sm font-mono w-16 text-right">
          {timeScale < 1 ? `${(timeScale * 1000).toFixed(1)} ms` : `${timeScale.toFixed(1)} s`}
        </span>
      </div>
    </div>
  );
};