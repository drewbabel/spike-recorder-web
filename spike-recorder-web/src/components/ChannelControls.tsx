import React from 'react';
import type { Channel } from '../types';

interface ChannelControlsProps {
  channel: Channel;
  onUpdate: (channel: Channel) => void;
}

export const ChannelControls: React.FC<ChannelControlsProps> = ({
  channel,
  onUpdate
}) => {
  const handleGainChange = (delta: number) => {
    onUpdate({
      ...channel,
      gain: Math.max(0.1, Math.min(10, channel.gain + delta))
    });
  };

  // const handleOffsetChange = (delta: number) => {
  //   onUpdate({
  //     ...channel,
  //     offset: channel.offset + delta
  //   });
  // };

  return (
    <div className="flex items-center space-x-2 p-2 border-b border-gray-700">
      {/* Drag handle for vertical positioning */}
      <div
        className="cursor-move p-1 bg-gray-700 rounded"
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startOffset = channel.offset;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            onUpdate({
              ...channel,
              offset: startOffset + deltaY * 0.5
            });
          };

          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </div>

      {/* Zoom controls */}
      <div className="flex flex-col space-y-1">
        <button
          onClick={() => handleGainChange(0.5)}
          className="px-2 py-0 text-xs bg-gray-700 hover:bg-gray-600 rounded"
        >
          +
        </button>
        <button
          onClick={() => handleGainChange(-0.5)}
          className="px-2 py-0 text-xs bg-gray-700 hover:bg-gray-600 rounded"
        >
          -
        </button>
      </div>

      {/* Channel indicator */}
      <div
        className="w-4 h-4 rounded"
        style={{ backgroundColor: channel.color }}
      />
    </div>
  );
};