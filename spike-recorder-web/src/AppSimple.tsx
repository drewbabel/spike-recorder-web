import { useState, useEffect, useRef } from 'react';
// import './App.css'; // Removed - causing issues
import type {
  Channel,
  AudioConfig,
  SerialConfig,
  RecordingState,
  ViewMode,
  ThresholdConfig,
  PlaybackState,
  EventMarker,
  MeasurementSelection,
  SpikeAnalysisData
} from './types';
import { AudioProcessor } from './utils/audioProcessor';
import { WaveformBuffer } from './utils/waveformBuffer';
import { WavEncoder } from './utils/wavEncoder';
import { SerialHandler } from './utils/serialHandler';
import { SpikeDetector } from './utils/spikeDetection';
import { Toolbar } from './components/Toolbar';
import { ConfigModal } from './components/ConfigModal';
import { WaveformCanvas } from './components/WaveformCanvas';
import { ChannelControls } from './components/ChannelControls';
import { ControlsBar } from './components/ControlsBar';
import { ThresholdView } from './components/ThresholdView';
import { SpikeAnalysisView } from './components/SpikeAnalysisView';

function AppSimple() {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('realtime');
  const [showConfig, setShowConfig] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(0.1); // 100ms default
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Channels state with demo data
  const [channels, setChannels] = useState<Channel[]>([
    {
      id: 'ch1',
      name: 'Demo Channel [Left]',
      color: '#CCCC00',
      enabled: true,
      data: new Float32Array(4096).map(() => Math.sin(Date.now() / 100) * Math.random() * 0.5),
      offset: 0,
      gain: 1
    },
    {
      id: 'ch2',
      name: 'Demo Channel [Right]',
      color: '#00CC00',
      enabled: true,
      data: new Float32Array(4096).map(() => Math.cos(Date.now() / 100) * Math.random() * 0.5),
      offset: 0,
      gain: 1
    }
  ]);

  // Audio configuration
  const [audioConfig, setAudioConfig] = useState<AudioConfig>({
    sampleRate: 44100,
    bufferSize: 4096,
    numberOfChannels: 2,
    muteSpeakers: false
  });

  // Serial configuration
  const [serialConfig, setSerialConfig] = useState<SerialConfig>({
    port: null,
    baudRate: 230400,
    numberOfChannels: 1,
    connected: false
  });

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    startTime: null,
    duration: 0,
    events: []
  });

  // Threshold configuration
  const [thresholdConfig, setThresholdConfig] = useState<ThresholdConfig>({
    enabled: false,
    level: 0.5,
    averageCount: 25
  });

  // Playback state
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    totalDuration: 0,
    audioBuffer: null,
    fileName: null
  });

  // Spike analysis data
  const [spikeAnalysisData, setSpikeAnalysisData] = useState<SpikeAnalysisData>({
    spikes: [],
    filteredSpikes: [],
    minVoltage: -0.5,
    maxVoltage: 0.5
  });

  // Available devices
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [eventMarkers] = useState<EventMarker[]>([]);
  const [spikeMarkers] = useState<number[]>([]);

  // Refs for utilities
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const serialHandlerRef = useRef<SerialHandler | null>(null);
  const waveformBuffersRef = useRef<Map<string, WaveformBuffer>>(new Map());
  const wavEncoderRef = useRef<WavEncoder | null>(null);
  const spikeDetectorRef = useRef<SpikeDetector>(new SpikeDetector());
  const recordingIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Generate demo waveform data
  useEffect(() => {
    if (!audioInitialized && !isPaused) {
      const animate = () => {
        setChannels(prevChannels => {
          const time = Date.now() / 1000;
          return prevChannels.map(channel => ({
            ...channel,
            data: new Float32Array(4096).map((_, i) => {
              const freq = channel.id === 'ch1' ? 10 : 15;
              const noise = (Math.random() - 0.5) * 0.1;
              return Math.sin(time * freq + i * 0.01) * 0.3 + noise;
            })
          }));
        });
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [audioInitialized, isPaused]);

  // Initialize audio system when user clicks config
  const initializeAudio = async () => {
    try {
      setInitError(null);
      const processor = new AudioProcessor();
      await processor.initialize(audioConfig.numberOfChannels);
      audioProcessorRef.current = processor;

      // Set up waveform buffers for each channel
      channels.forEach(channel => {
        waveformBuffersRef.current.set(
          channel.id,
          new WaveformBuffer(audioConfig.sampleRate)
        );
      });

      // Update channels with real names
      setChannels([
        {
          id: 'ch1',
          name: 'Built-In Microphone [Left]',
          color: '#CCCC00',
          enabled: true,
          data: new Float32Array(4096),
          offset: 0,
          gain: 1
        },
        {
          id: 'ch2',
          name: 'Built-In Microphone [Right]',
          color: '#00CC00',
          enabled: true,
          data: new Float32Array(4096),
          offset: 0,
          gain: 1
        }
      ]);

      // Set up data callback
      processor.setDataCallback((data: Float32Array[]) => {
        if (isPaused) return;

        setChannels(prevChannels => {
          const newChannels = [...prevChannels];
          data.forEach((channelData, index) => {
            if (index < newChannels.length) {
              newChannels[index].data = channelData;
            }
          });
          return newChannels;
        });
      });

      // Get available audio devices
      const devices = await processor.getAudioDevices();
      setAvailableDevices(devices);

      // Apply mute setting
      processor.mute(audioConfig.muteSpeakers);

      setAudioInitialized(true);

      // Stop demo animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      setInitError('Failed to initialize audio. Please check microphone permissions.');
    }
  };

  // Handle serial connection
  const handleSerialConnect = async () => {
    if (serialConfig.connected) {
      if (serialHandlerRef.current) {
        await serialHandlerRef.current.disconnect();
        serialHandlerRef.current = null;
      }
      setSerialConfig(prev => ({ ...prev, connected: false }));
    } else {
      try {
        const handler = new SerialHandler();
        await handler.connect(serialConfig.baudRate, serialConfig.numberOfChannels);
        serialHandlerRef.current = handler;
        setSerialConfig(prev => ({ ...prev, connected: true }));
      } catch (error) {
        console.error('Failed to connect serial:', error);
        alert('Failed to connect to serial port. Make sure the device is connected and try again.');
      }
    }
  };

  // Handle recording
  const handleRecord = () => {
    if (recordingState.isRecording) {
      // Stop recording
      if (wavEncoderRef.current) {
        const blob = wavEncoderRef.current.exportWAV();
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, -5);
        const filename = `BYB_Recording_${timestamp}.wav`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        alert(`Recording saved as ${filename}`);
        wavEncoderRef.current = null;
      }

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      setRecordingState({
        isRecording: false,
        startTime: null,
        duration: 0,
        events: []
      });
    } else {
      // Start recording
      const sampleRate = audioProcessorRef.current?.getSampleRate() || 44100;

      wavEncoderRef.current = new WavEncoder(
        sampleRate,
        channels.filter(c => c.enabled).length
      );

      const startTime = Date.now();
      setRecordingState({
        isRecording: true,
        startTime,
        duration: 0,
        events: []
      });

      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: (Date.now() - startTime) / 1000
        }));
      }, 100);
    }
  };

  // Handle file browse
  const handleBrowse = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav';

    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const arrayBuffer = await file.arrayBuffer();
      const { sampleRate, numberOfChannels, data } = WavEncoder.loadWAV(arrayBuffer);

      const newChannels: Channel[] = [];
      for (let i = 0; i < numberOfChannels; i++) {
        newChannels.push({
          id: `file_ch${i + 1}`,
          name: `Channel ${i + 1}`,
          color: ['#CCCC00', '#00CC00', '#FF9933'][i % 3],
          enabled: true,
          data: data[i],
          offset: 0,
          gain: 1
        });
      }

      setChannels(newChannels);
      setPlaybackState({
        isPlaying: false,
        isPaused: true,
        currentTime: 0,
        totalDuration: data[0].length / sampleRate,
        audioBuffer: null,
        fileName: file.name
      });
      setViewMode('playback');
      setIsPaused(true);
    };

    input.click();
  };

  // Handle threshold mode toggle
  const handleThresholdToggle = () => {
    if (viewMode === 'threshold') {
      setViewMode('realtime');
      setThresholdConfig(prev => ({ ...prev, enabled: false }));
    } else {
      setViewMode('threshold');
      setThresholdConfig(prev => ({ ...prev, enabled: true }));
    }
  };

  // Handle spike analysis
  const handleAnalysisToggle = () => {
    if (viewMode === 'analysis') {
      setViewMode('playback');
    } else {
      setViewMode('analysis');
    }
  };

  // Update channel
  const updateChannel = (updatedChannel: Channel) => {
    setChannels(prev => prev.map(ch =>
      ch.id === updatedChannel.id ? updatedChannel : ch
    ));
  };

  // Update audio config
  const updateAudioConfig = (config: AudioConfig) => {
    setAudioConfig(config);
    if (audioProcessorRef.current) {
      audioProcessorRef.current.mute(config.muteSpeakers);
    }
  };

  const handleConfigOpen = () => {
    setShowConfig(true);
    if (!audioInitialized) {
      initializeAudio();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Welcome message if audio not initialized */}
      {!audioInitialized && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-black px-4 py-2 rounded z-50">
          Demo Mode - Click Config (⚙️) to connect microphone
        </div>
      )}

      {initError && (
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded z-50">
          {initError}
        </div>
      )}

      {/* Toolbar */}
      <Toolbar
        viewMode={viewMode}
        isRecording={recordingState.isRecording}
        onConfigClick={handleConfigOpen}
        onThresholdClick={handleThresholdToggle}
        onRecordClick={handleRecord}
        onBrowseClick={handleBrowse}
        onAnalysisClick={playbackState.fileName ? handleAnalysisToggle : undefined}
        showAnalysis={!!playbackState.fileName}
      />

      {/* Threshold view (when active) */}
      {viewMode === 'threshold' && (
        <ThresholdView
          config={thresholdConfig}
          averageSpike={spikeDetectorRef.current.getAverageSpike()}
          onConfigChange={setThresholdConfig}
          onClose={() => {
            setViewMode('realtime');
            setThresholdConfig(prev => ({ ...prev, enabled: false }));
          }}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Channel controls */}
        <div className="w-16 bg-gray-900 border-r border-gray-700">
          {channels.map(channel => (
            <ChannelControls
              key={channel.id}
              channel={channel}
              onUpdate={updateChannel}
            />
          ))}
        </div>

        {/* Waveform display */}
        <div className="flex-1 relative">
          <WaveformCanvas
            channels={channels}
            timeScale={timeScale}
            isPaused={isPaused}
            threshold={thresholdConfig.level}
            showThreshold={viewMode === 'threshold'}
            spikeMarkers={spikeMarkers}
            eventMarkers={eventMarkers}
            onMeasurement={(selection: MeasurementSelection) => {
              console.log('Measurement:', selection);
            }}
          />
        </div>
      </div>

      {/* Controls bar */}
      <ControlsBar
        isPlaying={playbackState.isPlaying}
        isPaused={isPaused}
        isRecording={recordingState.isRecording}
        recordingDuration={recordingState.duration}
        timeScale={timeScale}
        onPlayPause={() => setIsPaused(!isPaused)}
        onForward={() => {
          setIsPaused(false);
          setViewMode('realtime');
        }}
        onBackward={() => {}}
        onTimeScaleChange={setTimeScale}
      />

      {/* Config modal */}
      <ConfigModal
        isOpen={showConfig}
        channels={channels}
        audioConfig={audioConfig}
        serialConfig={serialConfig}
        onClose={() => setShowConfig(false)}
        onUpdateChannel={updateChannel}
        onUpdateAudioConfig={updateAudioConfig}
        onUpdateSerialConfig={setSerialConfig}
        onConnectSerial={handleSerialConnect}
        availableDevices={availableDevices}
      />

      {/* Spike analysis view */}
      {viewMode === 'analysis' && (
        <SpikeAnalysisView
          data={spikeAnalysisData}
          onUpdateFilter={(min, max) => {
            setSpikeAnalysisData(prev => ({
              ...prev,
              minVoltage: min,
              maxVoltage: max
            }));
          }}
          onSave={() => {
            setViewMode('playback');
          }}
          onClose={() => setViewMode('playback')}
        />
      )}
    </div>
  );
}

export default AppSimple;