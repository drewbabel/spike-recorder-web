export class WaveformBuffer {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private maxSize: number;
  private sampleRate: number;

  constructor(sampleRate: number, durationSeconds: number = 60) {
    this.sampleRate = sampleRate;
    this.maxSize = Math.floor(sampleRate * durationSeconds);
    this.buffer = new Float32Array(this.maxSize);
  }

  push(data: Float32Array): void {
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.writeIndex] = data[i];
      this.writeIndex = (this.writeIndex + 1) % this.maxSize;
    }
  }

  getRange(_startTime: number, duration: number): Float32Array {
    const numSamples = Math.floor(duration * this.sampleRate);

    const result = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const idx = (this.writeIndex - numSamples + i + this.maxSize) % this.maxSize;
      result[i] = this.buffer[idx];
    }

    return result;
  }

  getLatest(duration: number): Float32Array {
    return this.getRange(0, duration);
  }

  clear(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
  }

  getRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }
}