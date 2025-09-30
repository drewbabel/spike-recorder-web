import React, { useRef, useEffect, useState } from 'react';
import { SpikeAnalysisData } from '../types';

interface SpikeAnalysisViewProps {
  data: SpikeAnalysisData;
  onUpdateFilter: (minVoltage: number, maxVoltage: number) => void;
  onSave: () => void;
  onClose: () => void;
}

export const SpikeAnalysisView: React.FC<SpikeAnalysisViewProps> = ({
  data,
  onUpdateFilter,
  onSave,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [minVoltage, setMinVoltage] = useState(data.minVoltage);
  const [maxVoltage, setMaxVoltage] = useState(data.maxVoltage);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all spikes as white dots
    ctx.fillStyle = '#FFFFFF';
    data.spikes.forEach(spike => {
      const x = (spike.timestamp / 10) * canvas.width; // Assuming 10 second window
      const y = canvas.height - (spike.amplitude + 1) * canvas.height / 2;
      ctx.fillRect(x, y, 1, 1);
    });

    // Draw filtered spikes as yellow dots
    ctx.fillStyle = '#FFFF00';
    data.filteredSpikes.forEach(spike => {
      const x = (spike.timestamp / 10) * canvas.width;
      const y = canvas.height - (spike.amplitude + 1) * canvas.height / 2;
      ctx.fillRect(x - 1, y - 1, 3, 3);
    });

    // Draw filter boundaries
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Min voltage line
    const minY = canvas.height - (minVoltage + 1) * canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(0, minY);
    ctx.lineTo(canvas.width, minY);
    ctx.stroke();

    // Max voltage line
    const maxY = canvas.height - (maxVoltage + 1) * canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(0, maxY);
    ctx.lineTo(canvas.width, maxY);
    ctx.stroke();

    ctx.setLineDash([]);
  }, [data, minVoltage, maxVoltage]);

  const handleFilterChange = () => {
    onUpdateFilter(minVoltage, maxVoltage);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gray-900 p-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100 4h2a1 1 0 100 2 2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
          </svg>
          <h2 className="text-xl font-bold">Spike Analysis</h2>
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-2"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          width={1200}
          height={600}
          className="w-full h-full"
        />

        {/* Filter controls */}
        <div className="absolute right-4 top-4 bottom-4 w-12 flex flex-col justify-between">
          {/* Max voltage handle */}
          <div
            className="cursor-ns-resize p-1 bg-red-600 rounded-full"
            style={{ position: 'absolute', top: `${(1 - (maxVoltage + 1) / 2) * 100}%` }}
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startVoltage = maxVoltage;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const deltaVoltage = (deltaY / 600) * 2;
                const newVoltage = Math.max(minVoltage + 0.1, Math.min(1, startVoltage - deltaVoltage));
                setMaxVoltage(newVoltage);
                handleFilterChange();
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="w-4 h-4 bg-red-400 rounded-full" />
          </div>

          {/* Min voltage handle */}
          <div
            className="cursor-ns-resize p-1 bg-red-600 rounded-full"
            style={{ position: 'absolute', top: `${(1 - (minVoltage + 1) / 2) * 100}%` }}
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startVoltage = minVoltage;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const deltaVoltage = (deltaY / 600) * 2;
                const newVoltage = Math.max(-1, Math.min(maxVoltage - 0.1, startVoltage - deltaVoltage));
                setMinVoltage(newVoltage);
                handleFilterChange();
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="w-4 h-4 bg-red-400 rounded-full" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 p-4 border-t border-gray-700 flex justify-between items-center">
        <div className="text-sm text-gray-400">
          Detected: {data.spikes.length} spikes | Filtered: {data.filteredSpikes.length} spikes
        </div>

        <button
          onClick={onSave}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7.707 2.293a1 1 0 00-1.414 0l-4 4A1 1 0 002 7v6a1 1 0 00.293.707l4 4a1 1 0 001.414 0L14 11.414A2 2 0 0014.586 10H16a2 2 0 012 2v5a1 1 0 11-2 0v-5H14.586L8 18.586 3.414 14H5a1 1 0 110 2H2.414L1 14.586V5.414L2.414 4H5a1 1 0 010 2H3.414L8 1.414 14.586 8H16V3a1 1 0 112 0v5a2 2 0 01-2 2h-1.414L7.707 2.293z" />
          </svg>
          <span>Save</span>
        </button>
      </div>
    </div>
  );
};