import { EQBandConfig, EqualizerPreset } from '../types/audio-dsp.js';

export const DEFAULT_EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: Record<string, EqualizerPreset> = {
  flat: {
    name: 'Flat',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  bassBoost: {
    name: 'Bass Boost',
    gains: [6, 5.5, 4.5, 3, 1, 0, 0, 0, 0, 0],
  },
  trebleBoost: {
    name: 'Treble Boost',
    gains: [0, 0, 0, 0, 0, 1, 2.5, 4, 5.5, 6],
  },
  vocalBoost: {
    name: 'Vocal Boost',
    gains: [-2, -2, -1, 1, 3.5, 4, 3, 1, 0, -1],
  },
  electronic: {
    name: 'Electronic',
    gains: [5, 4.5, 2, 0, -1.5, 2, 1, 2.5, 4, 4.5],
  },
  rock: {
    name: 'Rock',
    gains: [4.5, 3.5, -1, -2, -0.5, 2, 3.5, 4, 4.5, 4.5],
  },
  acoustic: {
    name: 'Acoustic',
    gains: [3, 2.5, 1, 1, 1.5, 1.5, 2.5, 3, 2.5, 2],
  },
};

export class DynamicEqualizer {
  private context: AudioContext;
  private filters: BiquadFilterNode[] = [];
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;
  private enabled: boolean = true;
  private currentGains: number[];

  constructor(context: AudioContext, frequencies: number[] = DEFAULT_EQ_FREQUENCIES) {
    this.context = context;
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();
    this.currentGains = new Array(frequencies.length).fill(0);

    this.buildFilterGraph(frequencies);
  }

  private buildFilterGraph(frequencies: number[]): void {
    let prevNode: AudioNode = this.inputNode;

    this.filters = frequencies.map((freq, index) => {
      const filter = this.context.createBiquadFilter();
      filter.frequency.value = freq;

      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === frequencies.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.4; // standard octave band Q
      }

      filter.gain.value = 0;

      prevNode.connect(filter);
      prevNode = filter;

      return filter;
    });

    prevNode.connect(this.outputNode);
  }

  public setBandGain(bandIndex: number, gainDb: number): void {
    if (bandIndex < 0 || bandIndex >= this.filters.length) return;
    const clampedGain = Math.max(-12, Math.min(12, gainDb));
    this.currentGains[bandIndex] = clampedGain;

    if (this.enabled) {
      const filter = this.filters[bandIndex];
      filter.gain.setTargetAtTime(clampedGain, this.context.currentTime, 0.05);
    }
  }

  public setPreset(presetName: string): boolean {
    const preset = EQ_PRESETS[presetName];
    if (!preset) return false;

    preset.gains.forEach((gain, idx) => {
      this.setBandGain(idx, gain);
    });
    return true;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.filters.forEach((filter, idx) => {
      const targetGain = enabled ? this.currentGains[idx] : 0;
      filter.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.05);
    });
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getBands(): EQBandConfig[] {
    return this.filters.map((f, idx) => ({
      frequency: f.frequency.value,
      gain: this.currentGains[idx],
      q: f.Q.value,
      type: f.type,
    }));
  }
}
