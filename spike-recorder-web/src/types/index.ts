export type Channel = {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  data: Float32Array;
  offset: number;
  gain: number;
}

export type AudioConfig = {
  sampleRate: number;
  bufferSize: number;
  numberOfChannels: number;
  muteSpeakers: boolean;
}

export type SerialConfig = {
  port: string | null;
  baudRate: number;
  numberOfChannels: number;
  connected: boolean;
}

export type RecordingState = {
  isRecording: boolean;
  startTime: number | null;
  duration: number;
  events: EventMarker[];
}

export type EventMarker = {
  timestamp: number;
  key: string;
}

export type ThresholdConfig = {
  enabled: boolean;
  level: number;
  averageCount: number;
}

export type SpikeAnalysisData = {
  spikes: Spike[];
  filteredSpikes: Spike[];
  minVoltage: number;
  maxVoltage: number;
}

export type Spike = {
  timestamp: number;
  amplitude: number;
  channel: string;
}

export type MeasurementSelection = {
  startTime: number;
  endTime: number;
  startX: number;
  endX: number;
  rms: number;
}

export type PlaybackState = {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  totalDuration: number;
  audioBuffer: AudioBuffer | null;
  fileName: string | null;
}

export type ViewMode = 'realtime' | 'threshold' | 'analysis' | 'playback';