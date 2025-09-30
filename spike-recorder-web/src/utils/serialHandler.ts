export class SerialHandler {
  private port: any = null; // SerialPort type
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private isConnected = false;
  private dataCallback: ((data: Float32Array[]) => void) | null = null;
  private numberOfChannels = 1;
  private sampleRate = 10000; // 10kHz base rate

  async connect(baudRate: number = 230400, channels: number = 1): Promise<void> {
    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API is not supported in this browser');
      }

      this.numberOfChannels = channels;
      this.sampleRate = Math.floor(10000 / channels); // Adjust sample rate based on channels

      // Request port access
      this.port = await (navigator as any).serial.requestPort();

      await this.port.open({ baudRate });

      this.isConnected = true;

      // Set up reader
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      // Start reading data
      this.readLoop();

      // Set up writer
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();

    } catch (error) {
      console.error('Failed to connect to serial port:', error);
      throw error;
    }
  }

  private async readLoop(): Promise<void> {
    const buffer: number[] = [];
    const channelData: Float32Array[] = Array(this.numberOfChannels)
      .fill(null)
      .map(() => new Float32Array(256));
    let sampleIndex = 0;

    while (this.isConnected && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;

        // Parse incoming data (assuming Arduino sends comma-separated values)
        const lines = value.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          const values = line.split(',').map(v => parseFloat(v.trim()));

          if (values.length === this.numberOfChannels && values.every(v => !isNaN(v))) {
            // Store samples for each channel
            for (let ch = 0; ch < this.numberOfChannels; ch++) {
              // Convert to normalized float (-1 to 1)
              channelData[ch][sampleIndex] = values[ch] / 512 - 1;
            }

            sampleIndex++;

            // When buffer is full, send to callback
            if (sampleIndex >= 256) {
              if (this.dataCallback) {
                const dataToSend = channelData.map(ch => new Float32Array(ch.slice(0, sampleIndex)));
                this.dataCallback(dataToSend);
              }
              sampleIndex = 0;
            }
          }
        }
      } catch (error) {
        console.error('Error reading serial data:', error);
        break;
      }
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;

    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }

    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  setDataCallback(callback: (data: Float32Array[]) => void): void {
    this.dataCallback = callback;
  }

  async sendCommand(command: string): Promise<void> {
    if (this.writer) {
      await this.writer.write(command + '\n');
    }
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  static async getAvailablePorts(): Promise<any[]> {
    if (!('serial' in navigator)) {
      return [];
    }

    try {
      const ports = await (navigator as any).serial.getPorts();
      return ports;
    } catch (error) {
      console.error('Failed to get serial ports:', error);
      return [];
    }
  }
}