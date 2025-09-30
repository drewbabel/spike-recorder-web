export class WavEncoder {
  private sampleRate: number;
  private numberOfChannels: number;
  private recordedBuffers: Float32Array[][] = [];

  constructor(sampleRate: number, numberOfChannels: number) {
    this.sampleRate = sampleRate;
    this.numberOfChannels = numberOfChannels;
  }

  record(channelData: Float32Array[]): void {
    const buffer: Float32Array[] = [];
    for (let i = 0; i < channelData.length; i++) {
      buffer.push(new Float32Array(channelData[i]));
    }
    this.recordedBuffers.push(buffer);
  }

  clear(): void {
    this.recordedBuffers = [];
  }

  exportWAV(): Blob {
    const buffers = this.mergeBuffers();
    const interleaved = this.interleave(buffers);
    const dataView = this.encodeWAV(interleaved);
    return new Blob([dataView], { type: 'audio/wav' });
  }

  private mergeBuffers(): Float32Array[] {
    const result: Float32Array[] = [];
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const length = this.recordedBuffers.reduce(
        (acc, buf) => acc + buf[channel].length,
        0
      );
      const merged = new Float32Array(length);
      let offset = 0;
      for (let i = 0; i < this.recordedBuffers.length; i++) {
        merged.set(this.recordedBuffers[i][channel], offset);
        offset += this.recordedBuffers[i][channel].length;
      }
      result.push(merged);
    }
    return result;
  }

  private interleave(buffers: Float32Array[]): Float32Array {
    if (buffers.length === 1) {
      return buffers[0];
    }

    const length = buffers[0].length;
    const result = new Float32Array(length * this.numberOfChannels);

    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < this.numberOfChannels; channel++) {
        result[i * this.numberOfChannels + channel] = buffers[channel][i];
      }
    }
    return result;
  }

  private encodeWAV(samples: Float32Array): DataView {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
      for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    };

    // WAV header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, this.numberOfChannels, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2 * this.numberOfChannels, true);
    view.setUint16(32, this.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return view;
  }

  static loadWAV(arrayBuffer: ArrayBuffer): {
    sampleRate: number;
    numberOfChannels: number;
    data: Float32Array[];
  } {
    const view = new DataView(arrayBuffer);

    const sampleRate = view.getUint32(24, true);
    const numberOfChannels = view.getUint16(22, true);
    const bitsPerSample = view.getUint16(34, true);
    const dataStart = 44;
    const dataLength = view.getUint32(40, true);

    const samples = dataLength / (bitsPerSample / 8);
    const samplesPerChannel = samples / numberOfChannels;

    const channels: Float32Array[] = [];
    for (let c = 0; c < numberOfChannels; c++) {
      channels.push(new Float32Array(samplesPerChannel));
    }

    let offset = dataStart;
    for (let i = 0; i < samplesPerChannel; i++) {
      for (let c = 0; c < numberOfChannels; c++) {
        const sample = view.getInt16(offset, true);
        channels[c][i] = sample / 32768.0;
        offset += 2;
      }
    }

    return { sampleRate, numberOfChannels, data: channels };
  }
}