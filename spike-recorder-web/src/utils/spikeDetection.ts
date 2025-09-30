import type { Spike } from '../types';

export class SpikeDetector {
  private threshold: number = 0.5;
  private refractory: number = 0.001; // 1ms refractory period
  private lastSpikeTime: number = 0;
  private averageWindow: Float32Array[] = [];
  private maxAverageCount: number = 25;

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  setAverageCount(count: number): void {
    this.maxAverageCount = count;
    if (this.averageWindow.length > count) {
      this.averageWindow = this.averageWindow.slice(-count);
    }
  }

  detect(data: Float32Array, sampleRate: number, timestamp: number, channelId: string): Spike[] {
    const spikes: Spike[] = [];
    const dt = 1 / sampleRate;

    for (let i = 1; i < data.length - 1; i++) {
      const currentTime = timestamp + i * dt;

      // Check refractory period
      if (currentTime - this.lastSpikeTime < this.refractory) {
        continue;
      }

      // Detect threshold crossing (positive going)
      if (data[i - 1] < this.threshold && data[i] >= this.threshold) {
        // Find peak
        let peakIndex = i;
        let peakValue = data[i];

        // Look ahead for the peak
        for (let j = i + 1; j < Math.min(i + 20, data.length); j++) {
          if (data[j] > peakValue) {
            peakIndex = j;
            peakValue = data[j];
          } else if (data[j] < peakValue * 0.8) {
            break; // Peak found
          }
        }

        spikes.push({
          timestamp: timestamp + peakIndex * dt,
          amplitude: peakValue,
          channel: channelId
        });

        this.lastSpikeTime = currentTime;

        // Extract spike waveform for averaging
        const spikeStart = Math.max(0, peakIndex - 20);
        const spikeEnd = Math.min(data.length, peakIndex + 40);
        const spikeWaveform = new Float32Array(60);

        for (let k = 0; k < spikeEnd - spikeStart; k++) {
          spikeWaveform[k] = data[spikeStart + k];
        }

        this.addToAverage(spikeWaveform);
      }
    }

    return spikes;
  }

  private addToAverage(waveform: Float32Array): void {
    this.averageWindow.push(waveform);
    if (this.averageWindow.length > this.maxAverageCount) {
      this.averageWindow.shift();
    }
  }

  getAverageSpike(): Float32Array {
    if (this.averageWindow.length === 0) {
      return new Float32Array(60);
    }

    const average = new Float32Array(60);

    for (const waveform of this.averageWindow) {
      for (let i = 0; i < waveform.length; i++) {
        average[i] += waveform[i];
      }
    }

    for (let i = 0; i < average.length; i++) {
      average[i] /= this.averageWindow.length;
    }

    return average;
  }

  filterSpikes(spikes: Spike[], minVoltage: number, maxVoltage: number): Spike[] {
    return spikes.filter(spike =>
      spike.amplitude >= minVoltage && spike.amplitude <= maxVoltage
    );
  }

  calculateISI(spikes: Spike[]): number[] {
    const intervals: number[] = [];

    for (let i = 1; i < spikes.length; i++) {
      intervals.push(spikes[i].timestamp - spikes[i - 1].timestamp);
    }

    return intervals;
  }

  calculateFiringRate(spikes: Spike[], windowSize: number = 1.0): number[] {
    if (spikes.length === 0) return [];

    const startTime = spikes[0].timestamp;
    const endTime = spikes[spikes.length - 1].timestamp;
    const duration = endTime - startTime;
    const numWindows = Math.ceil(duration / windowSize);

    const rates: number[] = new Array(numWindows).fill(0);

    for (const spike of spikes) {
      const windowIndex = Math.floor((spike.timestamp - startTime) / windowSize);
      if (windowIndex < rates.length) {
        rates[windowIndex]++;
      }
    }

    // Convert to Hz
    for (let i = 0; i < rates.length; i++) {
      rates[i] = rates[i] / windowSize;
    }

    return rates;
  }
}