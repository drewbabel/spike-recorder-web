import { useState, useEffect, useRef } from 'react';

function BasicApp() {
  const [timeScale, setTimeScale] = useState(0.001);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [muteSpeakers, setMuteSpeakers] = useState(false);
  const [showThreshold, setShowThreshold] = useState(false);
  const [upperThreshold, setUpperThreshold] = useState(0.5);
  const [lowerThreshold, setLowerThreshold] = useState(-0.5);
  const [detectedSpikes, setDetectedSpikes] = useState<Array<{time: number, amplitude: number}>>([]);
  const [measurements, setMeasurements] = useState<{maxAmplitude: number, minAmplitude: number, period: number, frequency: number} | null>(null);
  const [loadedFile, setLoadedFile] = useState<{name: string, data: Float32Array} | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [channels, setChannels] = useState<Array<{id: string, deviceId: string, color: string}>>([
    { id: '1', deviceId: '', color: '#00FF00' }
  ]);
  const [showIntro, setShowIntro] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 600 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioDataRef = useRef<Float32Array>(new Float32Array(2048));
  const recordedDataRef = useRef<Float32Array[]>([]);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackIntervalRef = useRef<number | null>(null);

  // Enumerate audio devices
  const loadAudioDevices = async () => {
    try {
      // Request permission first to get device labels
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (permError) {
        console.log('User denied microphone permission');
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
    }
  };

  // Initialize audio
  const initializeAudio = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(selectedDeviceId && { deviceId: { exact: selectedDeviceId } })
        }
      };

      streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;

      sourceRef.current.connect(analyserRef.current);

      // Create ScriptProcessor for recording
      scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      sourceRef.current.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(audioContextRef.current.createGain()); // Connect to silent gain node

      if (!muteSpeakers) {
        sourceRef.current.connect(audioContextRef.current.destination);
      }

      setAudioInitialized(true);
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to access microphone: ${errorMessage}. Please check permissions and ensure a device is selected.`);
    }
  };

  // Convert Float32Array to WAV buffer
  const encodeWAV = (samples: Float32Array[], sampleRate: number) => {
    const length = samples.reduce((acc, s) => acc + s.length, 0);
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (const chunk of samples) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  // Parse WAV file
  const parseWAV = (buffer: ArrayBuffer) => {
    const view = new DataView(buffer);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    const dataSize = view.getUint32(40, true);
    const numSamples = dataSize / (bitsPerSample / 8);

    const samples = new Float32Array(numSamples);
    let offset = 44;

    for (let i = 0; i < numSamples; i++) {
      const sample = view.getInt16(offset, true);
      samples[i] = sample / (sample < 0 ? 0x8000 : 0x7FFF);
      offset += 2;
    }

    return { sampleRate, samples };
  };

  // Handle recording
  const handleRecord = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      // Stop recording audio data
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.onaudioprocess = null;
      }

      // Save recording
      if (recordedDataRef.current.length > 0) {
        const sampleRate = audioContextRef.current?.sampleRate || 44100;
        const wavBlob = encodeWAV(recordedDataRef.current, sampleRate);
        const url = URL.createObjectURL(wavBlob);
        const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, -5);
        const filename = `BYB_Recording_${timestamp}.wav`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
        alert(`Recording saved as ${filename}`);
        recordedDataRef.current = [];
      }

      setRecordingTime(0);
    } else {
      // Start recording
      setIsRecording(true);
      recordingStartRef.current = Date.now();
      recordedDataRef.current = [];

      // Start recording audio data
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(inputData);
          recordedDataRef.current.push(copy);
        };
      }

      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime((Date.now() - recordingStartRef.current!) / 1000);
      }, 100);
    }
  };

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Enable anti-aliasing and smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const animate = () => {
      // Clear canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!isPaused) {
        if (loadedFile) {
          // Calculate measurements
          let maxAmp = -Infinity;
          let minAmp = Infinity;
          const peaks: number[] = [];

          for (let i = 0; i < loadedFile.data.length; i++) {
            if (loadedFile.data[i] > maxAmp) maxAmp = loadedFile.data[i];
            if (loadedFile.data[i] < minAmp) minAmp = loadedFile.data[i];

            // Find peaks (local maxima above threshold)
            if (i > 0 && i < loadedFile.data.length - 1) {
              if (loadedFile.data[i] > loadedFile.data[i-1] &&
                  loadedFile.data[i] > loadedFile.data[i+1] &&
                  loadedFile.data[i] > maxAmp * 0.3) {
                peaks.push(i);
              }
            }
          }

          // Calculate average period from peaks
          let avgPeriod = 0;
          let frequency = 0;
          if (peaks.length > 1) {
            let totalPeriod = 0;
            for (let i = 1; i < Math.min(peaks.length, 20); i++) {
              totalPeriod += peaks[i] - peaks[i-1];
            }
            avgPeriod = totalPeriod / Math.min(peaks.length - 1, 19);
            const sampleRate = 44100;
            avgPeriod = avgPeriod / sampleRate; // Convert to seconds
            frequency = avgPeriod > 0 ? 1 / avgPeriod : 0;
          }

          // Draw loaded file waveform - Smooth anti-aliased with cubic interpolation
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();

          const samplesPerPixel = Math.max(1, Math.floor(loadedFile.data.length / canvas.width));
          const startSample = Math.floor(playbackPosition * loadedFile.data.length);

          // Build smoothed points array with averaging
          const points: Array<{x: number, y: number}> = [];
          for (let x = 0; x < canvas.width; x++) {
            const sampleIndex = startSample + x * samplesPerPixel;
            if (sampleIndex < loadedFile.data.length) {
              // Multi-sample averaging with wider window for smoother result
              let sum = 0;
              let count = 0;
              const windowSize = Math.max(1, Math.floor(samplesPerPixel * 1.5));
              for (let s = 0; s < windowSize && sampleIndex + s < loadedFile.data.length; s++) {
                sum += loadedFile.data[sampleIndex + s];
                count++;
              }
              const avgValue = count > 0 ? sum / count : 0;
              const y = canvas.height / 2 - avgValue * canvas.height * 0.4;
              points.push({x, y});
            }
          }

          // Draw using cubic bezier curves for ultra-smooth lines
          if (points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 0; i < points.length - 1; i++) {
              const p0 = points[Math.max(0, i - 1)];
              const p1 = points[i];
              const p2 = points[i + 1];
              const p3 = points[Math.min(points.length - 1, i + 2)];

              // Calculate control points for smooth cubic bezier
              const cp1x = p1.x + (p2.x - p0.x) / 6;
              const cp1y = p1.y + (p2.y - p0.y) / 6;
              const cp2x = p2.x - (p3.x - p1.x) / 6;
              const cp2y = p2.y - (p3.y - p1.y) / 6;

              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          }
          ctx.stroke();

          // Update measurements
          if (!measurements || measurements.maxAmplitude !== maxAmp) {
            setMeasurements({
              maxAmplitude: maxAmp,
              minAmplitude: minAmp,
              period: avgPeriod,
              frequency: frequency
            });
          }

          // Detect spikes in loaded file when threshold mode is on
          if (showThreshold) {
            const spikes: Array<{time: number, amplitude: number}> = [];
            for (let i = 0; i < loadedFile.data.length; i++) {
              const amplitude = loadedFile.data[i];
              if (amplitude > upperThreshold || amplitude < lowerThreshold) {
                spikes.push({ time: i / 44100, amplitude });
              }
            }
            if (JSON.stringify(spikes) !== JSON.stringify(detectedSpikes)) {
              setDetectedSpikes(spikes);
            }
          }
        } else if (audioInitialized && analyserRef.current) {
          // Draw real audio data with cubic smoothing
          analyserRef.current.getFloatTimeDomainData(audioDataRef.current);

          // Channel 1 - Smooth anti-aliased with cubic interpolation
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();

          // Build points array with averaging
          const audioPoints: Array<{x: number, y: number}> = [];
          for (let x = 0; x < canvas.width; x++) {
            const sampleIndex = Math.floor(x * audioDataRef.current.length / canvas.width);
            // Average neighboring samples for smoother display
            let sum = 0;
            let count = 0;
            const avgWindow = 3;
            for (let s = -avgWindow; s <= avgWindow; s++) {
              const idx = Math.max(0, Math.min(audioDataRef.current.length - 1, sampleIndex + s));
              sum += audioDataRef.current[idx];
              count++;
            }
            const avgValue = sum / count;
            const y = canvas.height / 2 - avgValue * canvas.height * 0.4;
            audioPoints.push({x, y});
          }

          // Draw using cubic bezier curves
          if (audioPoints.length > 0) {
            ctx.moveTo(audioPoints[0].x, audioPoints[0].y);

            for (let i = 0; i < audioPoints.length - 1; i++) {
              const p0 = audioPoints[Math.max(0, i - 1)];
              const p1 = audioPoints[i];
              const p2 = audioPoints[i + 1];
              const p3 = audioPoints[Math.min(audioPoints.length - 1, i + 2)];

              const cp1x = p1.x + (p2.x - p0.x) / 6;
              const cp1y = p1.y + (p2.y - p0.y) / 6;
              const cp2x = p2.x - (p3.x - p1.x) / 6;
              const cp2y = p2.y - (p3.y - p1.y) / 6;

              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          }
          ctx.stroke();
        } else {
          // Draw demo waveform
          ctx.strokeStyle = '#CCCC00';
          ctx.lineWidth = 2;
          ctx.beginPath();

          const time = Date.now() / 1000;
          for (let x = 0; x < canvas.width; x++) {
            const y = canvas.height / 2 + Math.sin(time * 10 + x * 0.02) * 50;
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();

          // Draw second channel
          ctx.strokeStyle = '#00CC00';
          ctx.beginPath();
          for (let x = 0; x < canvas.width; x++) {
            const y = canvas.height / 2 + Math.cos(time * 15 + x * 0.02) * 40;
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
      }

      // Draw grid lines
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;

      // Horizontal grid lines
      const numHorizontalLines = 8;
      for (let i = 0; i <= numHorizontalLines; i++) {
        const y = (canvas.height / numHorizontalLines) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Vertical grid lines
      const numVerticalLines = 10;
      for (let i = 0; i <= numVerticalLines; i++) {
        const x = (canvas.width / numVerticalLines) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Draw center axis line (brighter)
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Define info box dimensions first (for adaptive positioning)
      const infoBoxWidth = Math.min(250, canvas.width - 20);
      const infoBoxHeight = measurements ? 160 : 80;
      const infoBoxX = 10;
      const infoBoxY = 10;

      // Draw threshold lines when in threshold mode
      if (showThreshold) {
        // Upper threshold line
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const upperY = canvas.height / 2 - upperThreshold * canvas.height * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, upperY);
        ctx.lineTo(canvas.width, upperY);
        ctx.stroke();

        // Draw upper threshold label
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`Upper: ${upperThreshold.toFixed(3)}`, 10, upperY - 5);

        // Lower threshold line
        ctx.strokeStyle = '#FFA500';
        const lowerY = canvas.height / 2 - lowerThreshold * canvas.height * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, lowerY);
        ctx.lineTo(canvas.width, lowerY);
        ctx.stroke();

        // Draw lower threshold label
        ctx.fillStyle = '#FFA500';
        ctx.fillText(`Lower: ${lowerThreshold.toFixed(3)}`, 10, lowerY + 20);

        ctx.setLineDash([]);

        // Draw spike count (adaptive positioning)
        if (canvas.width > 300) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          const spikeTextWidth = 200;
          const spikeTextX = Math.max(infoBoxWidth + 20, canvas.width - spikeTextWidth - 10);
          ctx.fillRect(spikeTextX, 10, spikeTextWidth, 30);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 14px Arial';
          ctx.fillText(`Spikes: ${detectedSpikes.length}`, spikeTextX + 10, 30);
        }
      }

      // Draw measurements and info overlay (adaptive)
      if (canvas.width > 300 && canvas.height > 200) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight);

        ctx.fillStyle = '#00FF00';
        ctx.font = 'bold 14px Arial';
        let timeText;
        if (timeScale < 0.001) {
          timeText = (timeScale * 1000000).toFixed(1) + ' μs/div';
        } else if (timeScale < 1) {
          timeText = (timeScale * 1000).toFixed(2) + ' ms/div';
        } else {
          timeText = timeScale.toFixed(2) + ' s/div';
        }
        ctx.fillText('Time: ' + timeText, infoBoxX + 10, infoBoxY + 20);

        if (measurements) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '12px Arial';
          ctx.fillText(`Max: ${measurements.maxAmplitude.toFixed(4)}`, infoBoxX + 10, infoBoxY + 45);
          ctx.fillText(`Min: ${measurements.minAmplitude.toFixed(4)}`, infoBoxX + 10, infoBoxY + 65);
          ctx.fillText(`P-P: ${(measurements.maxAmplitude - measurements.minAmplitude).toFixed(4)}`, infoBoxX + 10, infoBoxY + 85);
          if (measurements.period > 0) {
            ctx.fillText(`Period: ${(measurements.period * 1000).toFixed(2)} ms`, infoBoxX + 10, infoBoxY + 105);
            ctx.fillText(`Freq: ${measurements.frequency.toFixed(2)} Hz`, infoBoxX + 10, infoBoxY + 125);
          }
          if (loadedFile) {
            ctx.fillText(`SR: 44100 Hz`, infoBoxX + 10, infoBoxY + 145);
          }
        }
      }

      // Draw zoom hint (adaptive positioning)
      const hintWidth = 170;
      const hintHeight = 20;
      const hintX = Math.max(10, canvas.width - hintWidth - 10);
      const hintY = Math.max(50, canvas.height - hintHeight - 10);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(hintX, hintY, hintWidth, hintHeight);
      ctx.fillStyle = '#CCCCCC';
      ctx.font = '11px Arial';
      ctx.fillText('Scroll to zoom in/out', hintX + 10, hintY + 14);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused, audioInitialized, timeScale, showThreshold, upperThreshold, lowerThreshold, detectedSpikes, loadedFile, playbackPosition, measurements, canvasSize]);

  // Load audio devices on mount and when intro shows
  useEffect(() => {
    if (showIntro) {
      loadAudioDevices();
    }
  }, [showIntro]);

  // Handle window resize with debounce
  useEffect(() => {
    let timeout: number;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        if (canvasRef.current) {
          const container = canvasRef.current.parentElement;
          if (container) {
            const rect = container.getBoundingClientRect();
            setCanvasSize({
              width: Math.floor(rect.width),
              height: Math.floor(rect.height)
            });
          }
        }
      }, 50);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Also handle on mount after a brief delay to ensure proper sizing
    const initialTimeout = window.setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
      clearTimeout(initialTimeout);
    };
  }, []);

  // Handle mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (canvasRef.current && canvasRef.current.contains(e.target as Node)) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1.05 : 0.95; // Finer control
        setTimeScale(prev => Math.max(0.00001, Math.min(100, prev * delta))); // Allow down to 0.01ms
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch(e.key) {
        case ' ':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleRecord();
          }
          break;
        case 't':
          if (loadedFile) {
            setShowThreshold(prev => !prev);
          }
          break;
        case '+':
        case '=':
          setTimeScale(prev => Math.max(0.00001, prev * 0.9));
          break;
        case '-':
          setTimeScale(prev => Math.min(100, prev * 1.1));
          break;
        case 'h':
        case 'H':
        case '?':
          setShowHelp(true);
          break;
        case 'Escape':
          setShowHelp(false);
          setShowThreshold(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadedFile, handleRecord]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      height: '100vh',
      width: '100%',
      backgroundColor: '#e0e0e0',
      color: '#000',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      margin: 0,
      padding: 0,
      position: 'relative'
    }}>
      {/* Intro Screen */}
      {showIntro && !audioInitialized && !loadedFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#2c3e50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: '#34495e',
            padding: '40px',
            border: '3px solid #1a252f',
            borderRadius: '8px',
            textAlign: 'center',
            maxWidth: '400px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
          }}>
            <h1 style={{ color: '#00FF00', marginTop: 0, marginBottom: '20px', fontSize: '28px' }}>
              BYB Spike Recorder
            </h1>
            <p style={{ color: '#fff', marginBottom: '20px', fontSize: '14px' }}>
              Select microphone to begin
            </p>

            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              onFocus={() => {
                if (audioDevices.length === 0) {
                  loadAudioDevices();
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                backgroundColor: '#fff',
                border: '2px solid #1a252f',
                marginBottom: '20px',
                cursor: 'pointer'
              }}
            >
              <option value="">Select microphone...</option>
              {audioDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Audio Input ${index + 1}`}
                </option>
              ))}
            </select>

            <button
              onClick={async () => {
                if (selectedDeviceId) {
                  await initializeAudio();
                  if (audioInitialized) {
                    setShowIntro(false);
                  }
                } else {
                  alert('Please select a microphone first');
                }
              }}
              disabled={!selectedDeviceId}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: selectedDeviceId ? '#4caf50' : '#666',
                color: '#fff',
                border: 'none',
                cursor: selectedDeviceId ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                fontSize: '16px',
                borderRadius: '4px',
                marginBottom: '15px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              Connect Microphone
            </button>

            <button
              onClick={() => setShowIntro(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'transparent',
                color: '#aaa',
                border: '1px solid #666',
                cursor: 'pointer',
                fontSize: '12px',
                borderRadius: '4px'
              }}
            >
              Skip (browse files instead)
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        backgroundColor: '#2c3e50',
        padding: '10px 15px',
        borderBottom: '3px solid #1a252f',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (loadedFile) {
                setShowThreshold(!showThreshold);
              } else {
                alert('Please load a WAV file first to use threshold analysis');
              }
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: showThreshold ? '#e74c3c' : '#34495e',
              color: '#fff',
              border: '2px solid #1a252f',
              cursor: loadedFile ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '13px',
              opacity: loadedFile ? 1 : 0.5
            }}
            title={loadedFile ? 'Open threshold settings' : 'Load a WAV file first'}
          >Threshold</button>

          <button
            onClick={() => setShowHelp(true)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#34495e',
              color: '#fff',
              border: '2px solid #1a252f',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}>Help</button>
        </div>

        <h1 style={{ fontSize: '20px', margin: 0, color: '#fff', fontWeight: 'bold' }}>
          BYB Spike Recorder
        </h1>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleRecord}
            style={{
              padding: '8px 12px',
              backgroundColor: isRecording ? '#e74c3c' : '#34495e',
              color: '#fff',
              border: '2px solid #1a252f',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}>
            {isRecording ? 'Stop' : 'Record'}
          </button>

          <button
            onClick={async () => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.wav';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  try {
                    const buffer = await file.arrayBuffer();
                    const { samples } = parseWAV(buffer);
                    setLoadedFile({ name: file.name, data: samples });
                    setPlaybackPosition(0);
                    setIsPaused(true);

                    // Start playback animation
                    if (playbackIntervalRef.current) {
                      clearInterval(playbackIntervalRef.current);
                    }
                    playbackIntervalRef.current = window.setInterval(() => {
                      setPlaybackPosition(prev => {
                        const next = prev + 0.001;
                        return next >= 1 ? 0 : next;
                      });
                    }, 50);

                    alert(`Loaded: ${file.name}`);
                  } catch (error) {
                    console.error('Failed to load WAV file:', error);
                    alert('Failed to load WAV file. Please ensure it\'s a valid WAV file.');
                  }
                }
              };
              input.click();
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: '#34495e',
              color: '#fff',
              border: '2px solid #1a252f',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}>Browse</button>
        </div>
      </div>

      {/* Status Banner */}
      {!audioInitialized && !loadedFile && (
        <div style={{
          backgroundColor: '#ffc107',
          color: '#000',
          padding: '10px',
          textAlign: 'center',
          fontWeight: 'bold',
          borderBottom: '2px solid #ff9800'
        }}>
          Welcome! Connect microphone or load a WAV file to begin
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div style={{
          backgroundColor: '#e74c3c',
          color: '#fff',
          padding: '10px',
          textAlign: 'center',
          fontWeight: 'bold',
          borderBottom: '2px solid #c0392b'
        }}>
          Recording: {formatTime(recordingTime)}
        </div>
      )}

      {/* Loaded file indicator */}
      {loadedFile && (
        <div style={{
          backgroundColor: '#4caf50',
          color: '#fff',
          padding: '10px',
          textAlign: 'center',
          fontWeight: 'bold',
          borderBottom: '2px solid #388e3c'
        }}>
          Loaded: {loadedFile.name} | Samples: {loadedFile.data.length.toLocaleString()}
        </div>
      )}

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        position: 'relative',
        padding: '10px',
        gap: '10px',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Audio Device Controls */}
        <div style={{
          width: 'min(220px, 25vw)',
          minWidth: '140px',
          backgroundColor: '#f5f5f5',
          border: '2px solid #999',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'auto'
        }}>
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              borderBottom: '1px solid #999',
              paddingBottom: '5px'
            }}>
              <h4 style={{ margin: 0, fontSize: '12px' }}>
                Channels
              </h4>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => {
                    const colors = ['#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FF8800'];
                    const newChannel = {
                      id: Date.now().toString(),
                      deviceId: '',
                      color: colors[channels.length % colors.length]
                    };
                    setChannels([...channels, newChannel]);
                  }}
                  disabled={channels.length >= 5}
                  style={{
                    padding: '2px 8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    backgroundColor: channels.length >= 5 ? '#ccc' : '#4caf50',
                    color: '#fff',
                    border: 'none',
                    cursor: channels.length >= 5 ? 'not-allowed' : 'pointer',
                    borderRadius: '3px'
                  }}
                >
                  +
                </button>
                <button
                  onClick={() => {
                    if (channels.length > 1) {
                      setChannels(channels.slice(0, -1));
                    }
                  }}
                  disabled={channels.length <= 1}
                  style={{
                    padding: '2px 8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    backgroundColor: channels.length <= 1 ? '#ccc' : '#f44336',
                    color: '#fff',
                    border: 'none',
                    cursor: channels.length <= 1 ? 'not-allowed' : 'pointer',
                    borderRadius: '3px'
                  }}
                >
                  -
                </button>
              </div>
            </div>

            {channels.map((channel, index) => (
              <div key={channel.id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: channel.color,
                    border: '2px solid #000',
                    flexShrink: 0
                  }}></div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
                    Ch {index + 1}
                  </span>
                </div>
                <select
                  value={channel.deviceId}
                  onChange={async (e) => {
                    const newChannels = [...channels];
                    newChannels[index].deviceId = e.target.value;
                    setChannels(newChannels);
                    setSelectedDeviceId(e.target.value);
                  }}
                  onFocus={() => {
                    if (audioDevices.length === 0) {
                      loadAudioDevices();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '4px',
                    fontSize: '10px',
                    backgroundColor: '#fff',
                    border: '1px solid #999',
                    cursor: 'pointer',
                    marginBottom: '6px'
                  }}
                >
                  <option value="">Select device...</option>
                  {audioDevices.map((device, idx) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Audio Input ${idx + 1}`}
                    </option>
                  ))}
                </select>
                {channel.deviceId && !audioInitialized && (
                  <button
                    onClick={initializeAudio}
                    style={{
                      width: '100%',
                      padding: '6px',
                      fontSize: '10px',
                      backgroundColor: '#4caf50',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      borderRadius: '3px'
                    }}
                  >
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{
            borderTop: '1px solid #999',
            paddingTop: '10px',
            marginTop: '10px'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={muteSpeakers}
                onChange={(e) => setMuteSpeakers(e.target.checked)}
                style={{ width: '14px', height: '14px' }}
              />
              <span>Mute speakers</span>
            </label>
          </div>
        </div>

        {/* Waveform canvas */}
        <div style={{ flex: 1, position: 'relative', border: '3px solid #333', backgroundColor: '#000', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: 'crosshair'
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div style={{
        backgroundColor: '#34495e',
        padding: '10px 15px',
        borderTop: '3px solid #1a252f',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 -2px 4px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={{
            padding: '8px 16px',
            backgroundColor: '#2c3e50',
            color: '#fff',
            border: '2px solid #1a252f',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '13px'
          }}>Rewind</button>

          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2c3e50',
              color: '#fff',
              border: '2px solid #1a252f',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}>{isPaused ? 'Play' : 'Pause'}</button>

          <button style={{
            padding: '8px 16px',
            backgroundColor: '#2c3e50',
            color: '#fff',
            border: '2px solid #1a252f',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '13px'
          }}>Forward</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#2c3e50', padding: '8px 16px', border: '2px solid #1a252f' }}>
            <span style={{ color: '#00FF00', fontWeight: 'bold', fontSize: '13px' }}>
              {timeScale < 0.001
                ? `${(timeScale * 1000000).toFixed(1)} μs/div`
                : timeScale < 1
                  ? `${(timeScale * 1000).toFixed(2)} ms/div`
                  : `${timeScale.toFixed(2)} s/div`}
            </span>
          </div>
          {loadedFile && (
            <div style={{ backgroundColor: '#2c3e50', padding: '10px 20px', border: '2px solid #1a252f' }}>
              <span style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: '14px' }}>
                Duration: {(loadedFile.data.length / 44100).toFixed(2)}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Threshold Panel */}
      {showThreshold && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          border: '2px solid #333',
          width: 'min(350px, calc(100vw - 40px))',
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'auto',
          zIndex: 900,
          color: '#000',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
            Spike Threshold Settings
          </h3>

          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', border: '1px solid #ccc' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Upper Threshold (Amplitude)
            </label>
            <input
              type="number"
              step="0.001"
              value={upperThreshold}
              onChange={(e) => setUpperThreshold(parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #999',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="range"
              min="-2"
              max="2"
              step="0.001"
              value={upperThreshold}
              onChange={(e) => setUpperThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', marginTop: '10px' }}
            />
          </div>

          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', border: '1px solid #ccc' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Lower Threshold (Amplitude)
            </label>
            <input
              type="number"
              step="0.001"
              value={lowerThreshold}
              onChange={(e) => setLowerThreshold(parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #999',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="range"
              min="-2"
              max="2"
              step="0.001"
              value={lowerThreshold}
              onChange={(e) => setLowerThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', marginTop: '10px' }}
            />
          </div>

          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f5e9', border: '1px solid #4caf50' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '16px', borderBottom: '1px solid #4caf50', paddingBottom: '5px' }}>Waveform Statistics</p>
            <p style={{ margin: '5px 0' }}>Spikes Detected: <strong>{detectedSpikes.length}</strong></p>
            {measurements && (
              <>
                <p style={{ margin: '5px 0' }}>Max Amplitude: <strong>{measurements.maxAmplitude.toFixed(4)}</strong></p>
                <p style={{ margin: '5px 0' }}>Min Amplitude: <strong>{measurements.minAmplitude.toFixed(4)}</strong></p>
                <p style={{ margin: '5px 0' }}>Peak-to-Peak: <strong>{(measurements.maxAmplitude - measurements.minAmplitude).toFixed(4)}</strong></p>
                {measurements.period > 0 && (
                  <>
                    <p style={{ margin: '5px 0' }}>Period: <strong>{(measurements.period * 1000).toFixed(2)} ms</strong></p>
                    <p style={{ margin: '5px 0' }}>Frequency: <strong>{measurements.frequency.toFixed(2)} Hz</strong></p>
                  </>
                )}
              </>
            )}
          </div>

          <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#fff', border: '1px solid #ccc' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Save/Load Threshold Preset</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <button
                onClick={() => {
                  const preset = {
                    upper: upperThreshold,
                    lower: lowerThreshold,
                    timestamp: new Date().toISOString()
                  };
                  const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `threshold_preset_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                Save Preset
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      try {
                        const text = await file.text();
                        const preset = JSON.parse(text);
                        setUpperThreshold(preset.upper);
                        setLowerThreshold(preset.lower);
                        alert('Threshold preset loaded successfully!');
                      } catch (error) {
                        alert('Failed to load preset. Please check the file format.');
                      }
                    }
                  };
                  input.click();
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#4caf50',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                Load Preset
              </button>
            </div>
            <p style={{ margin: '5px 0', fontSize: '11px', color: '#666' }}>
              Current: Upper={upperThreshold.toFixed(3)}, Lower={lowerThreshold.toFixed(3)}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button
              onClick={() => {
                if (detectedSpikes.length === 0) {
                  alert('No spikes detected to export');
                  return;
                }

                let csv = 'Time (s),Amplitude\n';
                detectedSpikes.forEach(spike => {
                  csv += `${spike.time.toFixed(6)},${spike.amplitude.toFixed(6)}\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spikes_${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#9c27b0',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Export Spikes CSV
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                setDetectedSpikes([]);
              }}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#ff9800',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Reset Spikes
            </button>
            <button
              onClick={() => setShowThreshold(false)}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#666',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Close
            </button>
          </div>

          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', fontSize: '12px' }}>
            <strong>Tip:</strong> Type values directly or use sliders. Values persist across file loads.
          </div>
        </div>
      )}


      {/* Help Modal */}
      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#f5f5f5',
            padding: '20px',
            border: '3px solid #333',
            width: 'min(600px, calc(100vw - 40px))',
            maxHeight: 'calc(100vh - 40px)',
            overflow: 'auto',
            color: '#000',
            boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ marginTop: 0, borderBottom: '2px solid #333', paddingBottom: '10px' }}>
              BYB Spike Recorder - Help
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>Keyboard Shortcuts</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>Space</td>
                    <td style={{ padding: '8px' }}>Play/Pause</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>Ctrl+R</td>
                    <td style={{ padding: '8px' }}>Start/Stop Recording</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>T</td>
                    <td style={{ padding: '8px' }}>Toggle Threshold Panel</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>+/=</td>
                    <td style={{ padding: '8px' }}>Zoom In</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>-</td>
                    <td style={{ padding: '8px' }}>Zoom Out</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>Mouse Wheel</td>
                    <td style={{ padding: '8px' }}>Zoom (over waveform)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>H or ?</td>
                    <td style={{ padding: '8px' }}>Show Help</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>Escape</td>
                    <td style={{ padding: '8px' }}>Close Modals</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>Features</h3>
              <ul style={{ lineHeight: '1.8' }}>
                <li><strong>Real-time Recording:</strong> Connect microphone to record live audio</li>
                <li><strong>WAV File Analysis:</strong> Load and analyze WAV files</li>
                <li><strong>Threshold Detection:</strong> Set upper/lower thresholds for spike detection</li>
                <li><strong>Measurements:</strong> View amplitude, period, frequency, and spike count</li>
                <li><strong>Data Export:</strong> Export recordings as WAV, spikes as CSV</li>
                <li><strong>Preset Management:</strong> Save and load threshold presets</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
              <strong>Workflow:</strong>
              <ol style={{ marginTop: '10px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>Connect microphone (Config) or load WAV file (Browse)</li>
                <li>Record or analyze loaded data</li>
                <li>Use Threshold panel to detect spikes</li>
                <li>Export data or save threshold presets</li>
              </ol>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#2c3e50',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                width: '100%'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BasicApp;