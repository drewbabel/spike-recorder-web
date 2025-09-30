import React, { useRef, useEffect } from 'react';
import type { ThresholdConfig } from '../types';

interface ThresholdViewProps {
  config: ThresholdConfig;
  averageSpike: Float32Array;
  onConfigChange: (config: ThresholdConfig) => void;
  onClose: () => void;
}

export const ThresholdView: React.FC<ThresholdViewProps> = ({
  config,
  averageSpike,
  onConfigChange,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw axis
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Draw threshold line
    const thresholdY = canvas.height / 2 - config.level * canvas.height * 0.3;
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(canvas.width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw average spike
    if (averageSpike && averageSpike.length > 0) {
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < averageSpike.length; i++) {
        const x = (i / averageSpike.length) * canvas.width;
        const y = canvas.height / 2 - averageSpike[i] * canvas.height * 0.3;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Draw time scale
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px monospace';
    ctx.fillText('1 ms', canvas.width - 30, canvas.height - 5);
  }, [config, averageSpike]);

  return (
    <div className="absolute top-12 left-0 right-0 bg-gray-900 border-b border-gray-700 p-4 z-40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          {/* Exit threshold mode */}
          <button
            onClick={onClose}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
            title="Exit Threshold Mode"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>

          {/* Bell icon */}
          <div className="text-yellow-500">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </div>

          {/* Average count slider */}
          <div className="flex items-center space-x-2">
            <label className="text-sm">Spikes to Average:</label>
            <input
              type="range"
              min="1"
              max="100"
              value={config.averageCount}
              onChange={(e) => onConfigChange({
                ...config,
                averageCount: parseInt(e.target.value)
              })}
              className="w-32"
            />
            <span className="text-sm font-mono w-10">{config.averageCount}</span>
          </div>
        </div>
      </div>

      {/* Spike display canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-48 bg-black rounded"
        />

        {/* Threshold level handle */}
        <div
          className="absolute right-0 top-0 h-full w-8 flex items-center"
          style={{ top: `${(1 - config.level) * 50}%` }}
        >
          <div
            className="cursor-ns-resize p-1 bg-yellow-600 rounded-full"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startLevel = config.level;
              const canvas = canvasRef.current!;
              const rect = canvas.getBoundingClientRect();

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const deltaLevel = (deltaY / rect.height) * 2;
                const newLevel = Math.max(-1, Math.min(1, startLevel - deltaLevel));

                onConfigChange({
                  ...config,
                  level: newLevel
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
            <div className="w-4 h-4 bg-yellow-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};