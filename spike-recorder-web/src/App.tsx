import { useState, useEffect, useRef } from 'react';
import './App.css';
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

function App() {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('realtime');
  const [showConfig, setShowConfig] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(0.1); // 100ms default

  // Channels state
  const [channels, setChannels] = useState<Channel[]>([
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
      color: '#000000',
      enabled: false,
      data: new Float32Array(4096),
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
  const [eventMarkers, setEventMarkers] = useState<EventMarker[]>([]);
  const [spikeMarkers, setSpikeMarkers] = useState<number[]>([]);

  // Refs for utilities
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const serialHandlerRef = useRef<SerialHandler | null>(null);
  const waveformBuffersRef = useRef<Map<string, WaveformBuffer>>(new Map());
  const wavEncoderRef = useRef<WavEncoder | null>(null);
  const spikeDetectorRef = useRef<SpikeDetector>(new SpikeDetector());
  const recordingIntervalRef = useRef<number | null>(null);

  // Initialize audio on mount
  useEffect(() => {
    initializeAudio();

    // Keyboard event handler for event marking
    const handleKeyPress = (e: KeyboardEvent) => {
      if (recordingState.isRecording && e.key >= '0' && e.key <= '9') {
        const timestamp = (Date.now() - recordingState.startTime!) / 1000;
        setEventMarkers(prev => [...prev, { timestamp, key: e.key }]);
      }
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
      }
      if (serialHandlerRef.current) {
        serialHandlerRef.current.disconnect();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Initialize audio system
  const initializeAudio = async () => {
    try {
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

      // Set up data callback
      processor.setDataCallback((data: Float32Array[]) => {
        if (isPaused) return;

        setChannels(prevChannels => {
          const newChannels = [...prevChannels];
          data.forEach((channelData, index) => {
            if (index < newChannels.length) {
              // Update channel data
              newChannels[index].data = channelData;

              // Add to buffer
              const buffer = waveformBuffersRef.current.get(newChannels[index].id);
              if (buffer) {
                buffer.push(channelData);
              }

              // Record if recording
              if (recordingState.isRecording && wavEncoderRef.current) {
                wavEncoderRef.current.record(data);
              }

              // Detect spikes if in threshold mode
              if (viewMode === 'threshold' && thresholdConfig.enabled) {
                const spikes = spikeDetectorRef.current.detect(
                  channelData,
                  audioConfig.sampleRate,
                  Date.now() / 1000,
                  newChannels[index].id
                );
                if (spikes.length > 0) {
                  setSpikeMarkers(prev => [...prev, ...spikes.map(s => s.timestamp)]);
                }
              }
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
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  };

  // Handle serial connection
  const handleSerialConnect = async () => {
    if (serialConfig.connected) {
      // Disconnect
      if (serialHandlerRef.current) {
        await serialHandlerRef.current.disconnect();
        serialHandlerRef.current = null;
      }
      setSerialConfig(prev => ({ ...prev, connected: false }));
    } else {
      // Connect
      try {
        const handler = new SerialHandler();
        await handler.connect(serialConfig.baudRate, serialConfig.numberOfChannels);
        serialHandlerRef.current = handler;

        // Set up serial data callback
        handler.setDataCallback((data: Float32Array[]) => {
          if (isPaused) return;

          setChannels(prevChannels => {
            const newChannels = [...prevChannels];
            data.forEach((channelData, index) => {
              const channelId = `serial_ch${index + 1}`;
              let channel = newChannels.find(c => c.id === channelId);

              if (!channel) {
                // Create new channel for serial data
                channel = {
                  id: channelId,
                  name: `Serial channel ${index + 1}`,
                  color: ['#CCCC00', '#00CC00', '#FF9933'][index % 3],
                  enabled: true,
                  data: channelData,
                  offset: 0,
                  gain: 1
                };
                newChannels.push(channel);

                // Create buffer for new channel
                waveformBuffersRef.current.set(
                  channelId,
                  new WaveformBuffer(handler.getSampleRate())
                );
              } else {
                channel.data = channelData;
              }

              // Add to buffer
              const buffer = waveformBuffersRef.current.get(channelId);
              if (buffer) {
                buffer.push(channelData);
              }
            });
            return newChannels;
          });
        });

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

        // Download file
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        // Save events if any
        if (eventMarkers.length > 0) {
          const eventsText = eventMarkers
            .map(e => `${e.timestamp}\t${e.key}`)
            .join('\n');
          const eventsBlob = new Blob([eventsText], { type: 'text/plain' });
          const eventsUrl = URL.createObjectURL(eventsBlob);
          const eventsFilename = filename.replace('.wav', '-events.txt');

          const eventsLink = document.createElement('a');
          eventsLink.href = eventsUrl;
          eventsLink.download = eventsFilename;
          eventsLink.click();
        }

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
      setEventMarkers([]);
    } else {
      // Start recording
      const sampleRate = audioProcessorRef.current?.getSampleRate() ||
                        serialHandlerRef.current?.getSampleRate() ||
                        44100;

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

      // Update duration every 100ms
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

      // Update channels with loaded data
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

        // Create buffer for channel
        const buffer = new WaveformBuffer(sampleRate);
        buffer.push(data[i]);
        waveformBuffersRef.current.set(`file_ch${i + 1}`, buffer);
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

      // Load events file if exists
      // const eventsFileName = file.name.replace('.wav', '-events.txt');
      // Would need to implement events file loading logic here
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
      spikeDetectorRef.current.setThreshold(thresholdConfig.level);
      spikeDetectorRef.current.setAverageCount(thresholdConfig.averageCount);
    }
  };

  // Handle spike analysis
  const handleAnalysisToggle = () => {
    if (viewMode === 'analysis') {
      setViewMode('playback');
    } else {
      // Detect all spikes in current data
      const allSpikes: any[] = [];
      channels.forEach(channel => {
        if (channel.enabled) {
          const detector = new SpikeDetector();
          detector.setThreshold(0.1);
          const spikes = detector.detect(
            channel.data,
            audioConfig.sampleRate,
            0,
            channel.id
          );
          allSpikes.push(...spikes);
        }
      });

      setSpikeAnalysisData({
        spikes: allSpikes,
        filteredSpikes: allSpikes,
        minVoltage: -0.5,
        maxVoltage: 0.5
      });
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

  // Handle playback controls
  const handlePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const handleForward = () => {
    setIsPaused(false);
    setViewMode('realtime');
  };

  const handleBackward = () => {
    // Go back 5 seconds in buffer
    // Implementation would depend on buffer management
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Toolbar */}
      <Toolbar
        viewMode={viewMode}
        isRecording={recordingState.isRecording}
        onConfigClick={() => setShowConfig(true)}
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
        onPlayPause={handlePlayPause}
        onForward={handleForward}
        onBackward={handleBackward}
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
            const filtered = spikeDetectorRef.current.filterSpikes(
              spikeAnalysisData.spikes,
              min,
              max
            );
            setSpikeAnalysisData(prev => ({
              ...prev,
              filteredSpikes: filtered,
              minVoltage: min,
              maxVoltage: max
            }));
          }}
          onSave={() => {
            // Save filtered spike data
            const spikeData = spikeAnalysisData.filteredSpikes
              .map(s => `${s.timestamp}\t${s.amplitude}\t${s.channel}`)
              .join('\n');
            const blob = new Blob([spikeData], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const filename = `${playbackState.fileName?.replace('.wav', '')}-spikes.txt`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();

            setSpikeMarkers(spikeAnalysisData.filteredSpikes.map(s => s.timestamp));
            setViewMode('playback');
          }}
          onClose={() => setViewMode('playback')}
        />
      )}
    </div>
  );
}

export default App;