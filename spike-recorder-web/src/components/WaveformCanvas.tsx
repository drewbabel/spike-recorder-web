import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Channel, MeasurementSelection } from '../types';

interface WaveformCanvasProps {
  channels: Channel[];
  timeScale: number; // seconds to display
  isPaused: boolean;
  threshold?: number;
  showThreshold?: boolean;
  onMeasurement?: (selection: MeasurementSelection) => void;
  spikeMarkers?: number[];
  eventMarkers?: { timestamp: number; key: string }[];
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  channels,
  timeScale,
  isPaused,
  threshold = 0,
  showThreshold = false,
  onMeasurement,
  spikeMarkers = [],
  eventMarkers = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const channelHeight = canvas.height / channels.length;
    const samplesPerPixel = Math.max(1, Math.floor(timeScale * 44100 / canvas.width));

    channels.forEach((channel, index) => {
      if (!channel.enabled) return;

      const yBase = (index + 0.5) * channelHeight + channel.offset;

      // Draw axis line
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      ctx.lineTo(canvas.width, yBase);
      ctx.stroke();

      // Draw waveform
      ctx.strokeStyle = channel.color;
      ctx.lineWidth = 1;
      ctx.beginPath();

      let firstPoint = true;
      for (let x = 0; x < canvas.width; x++) {
        const sampleIndex = x * samplesPerPixel;
        if (sampleIndex < channel.data.length) {
          const sample = channel.data[sampleIndex];
          const y = yBase - sample * channel.gain * channelHeight * 0.4;

          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      // Draw threshold line if enabled
      if (showThreshold) {
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const thresholdY = yBase - threshold * channel.gain * channelHeight * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, thresholdY);
        ctx.lineTo(canvas.width, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw spike markers
      spikeMarkers.forEach(timestamp => {
        const x = (timestamp / timeScale) * canvas.width;
        if (x >= 0 && x <= canvas.width) {
          ctx.strokeStyle = '#FF0000';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, yBase - channelHeight * 0.4);
          ctx.lineTo(x, yBase - channelHeight * 0.3);
          ctx.stroke();
        }
      });
    });

    // Draw event markers
    eventMarkers.forEach(event => {
      const x = (event.timestamp / timeScale) * canvas.width;
      if (x >= 0 && x <= canvas.width) {
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 20);
        ctx.stroke();

        ctx.fillStyle = '#00FFFF';
        ctx.font = '10px monospace';
        ctx.fillText(event.key, x + 2, 15);
      }
    });

    // Draw selection rectangle if selecting
    if (isSelecting) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(
        Math.min(selectionStart.x, selectionEnd.x),
        0,
        Math.abs(selectionEnd.x - selectionStart.x),
        canvas.height
      );

      // Draw measurement info
      const duration = Math.abs(selectionEnd.x - selectionStart.x) * timeScale / canvas.width * 1000;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px monospace';
      ctx.fillText(`${duration.toFixed(2)} ms`, selectionEnd.x + 5, selectionEnd.y);
    }

    // Draw time scale
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px monospace';
    ctx.fillText(`${timeScale.toFixed(2)} s`, canvas.width - 50, canvas.height - 10);
  }, [channels, timeScale, showThreshold, threshold, spikeMarkers, eventMarkers, isSelecting, selectionStart, selectionEnd]);

  useEffect(() => {
    const animate = () => {
      draw();
      if (!isPaused) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (!isPaused) {
      animate();
    } else {
      draw();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, isPaused]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.ctrlKey) { // Right click or Ctrl+click
      e.preventDefault();
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
      setIsSelecting(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionEnd({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && onMeasurement) {
      const canvas = canvasRef.current!;
      const startTime = (selectionStart.x / canvas.width) * timeScale;
      const endTime = (selectionEnd.x / canvas.width) * timeScale;

      // Calculate RMS for selection
      let rms = 0;
      channels.forEach(channel => {
        if (channel.enabled) {
          const startSample = Math.floor(startTime * 44100);
          const endSample = Math.floor(endTime * 44100);
          let sum = 0;
          let count = 0;
          for (let i = startSample; i < endSample && i < channel.data.length; i++) {
            sum += channel.data[i] * channel.data[i];
            count++;
          }
          if (count > 0) {
            rms += Math.sqrt(sum / count);
          }
        }
      });

      onMeasurement({
        startTime,
        endTime,
        startX: selectionStart.x,
        endX: selectionEnd.x,
        rms: rms / channels.filter(c => c.enabled).length
      });
    }
    setIsSelecting(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      width={800}
      height={400}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  );
};