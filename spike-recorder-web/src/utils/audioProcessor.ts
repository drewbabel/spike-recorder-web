export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  private bufferSize = 4096;
  private sampleRate = 44100;
  private dataCallback: ((data: Float32Array[]) => void) | null = null;

  async initialize(numberOfChannels: number = 2): Promise<void> {
    try {
      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.sampleRate,
          channelCount: numberOfChannels
        }
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.sampleRate
      });

      // Create nodes
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.bufferSize;
      this.analyser.smoothingTimeConstant = 0;

      // Create script processor for raw data access
      this.scriptProcessor = this.audioContext.createScriptProcessor(
        this.bufferSize,
        numberOfChannels,
        numberOfChannels
      );

      this.scriptProcessor.onaudioprocess = (event) => {
        if (this.dataCallback) {
          const channelData: Float32Array[] = [];
          for (let i = 0; i < event.inputBuffer.numberOfChannels; i++) {
            channelData.push(new Float32Array(event.inputBuffer.getChannelData(i)));
          }
          this.dataCallback(channelData);
        }
      };

      // Connect nodes
      this.source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      this.source.connect(this.analyser);
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw error;
    }
  }

  setDataCallback(callback: (data: Float32Array[]) => void): void {
    this.dataCallback = callback;
  }

  getTimeData(): Float32Array {
    if (!this.analyser) return new Float32Array(0);

    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  getSampleRate(): number {
    return this.audioContext?.sampleRate || this.sampleRate;
  }

  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  }

  disconnect(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  mute(shouldMute: boolean): void {
    if (this.scriptProcessor) {
      if (shouldMute) {
        this.scriptProcessor.disconnect(this.audioContext!.destination);
      } else {
        this.scriptProcessor.connect(this.audioContext!.destination);
      }
    }
  }
}