import { NormalizerOptions } from '../types/audio-dsp.js';
import { calculateLoudnessGain, dbToGain } from '../utils/formatters.js';

export class LoudnessNormalizer {
  private context: AudioContext;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  private normalizationGain: GainNode;
  private preAmpGain: GainNode;
  private limiterNode: DynamicsCompressorNode;

  private enabled: boolean = true;
  private targetLufs: number = -14.0;
  private preAmpDb: number = 0;
  private currentTrackLufs: number = -14.0;

  constructor(context: AudioContext, options?: Partial<NormalizerOptions>) {
    this.context = context;
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();

    this.normalizationGain = context.createGain();
    this.preAmpGain = context.createGain();

    // High-ratio fast limiter to prevent digital clipping
    this.limiterNode = context.createDynamicsCompressor();
    this.limiterNode.threshold.value = options?.limiterThresholdDb ?? -0.5; // -0.5 dB ceiling
    this.limiterNode.knee.value = 0; // hard knee
    this.limiterNode.ratio.value = 20; // 20:1 brickwall ratio
    this.limiterNode.attack.value = 0.003; // 3ms attack
    this.limiterNode.release.value = 0.05; // 50ms release

    this.enabled = options?.enabled ?? true;
    this.targetLufs = options?.targetLufs ?? -14.0;
    this.preAmpDb = options?.preAmpDb ?? 0;

    this.setupGraph();
  }

  private setupGraph(): void {
    // Input -> Normalization Gain -> Pre-Amp Gain -> Limiter -> Output
    this.inputNode.connect(this.normalizationGain);
    this.normalizationGain.connect(this.preAmpGain);
    this.preAmpGain.connect(this.limiterNode);
    this.limiterNode.connect(this.outputNode);

    this.updateGains();
  }

  public setTrackLufs(lufs?: number): void {
    this.currentTrackLufs = lufs ?? -14.0;
    this.updateGains();
  }

  public setTargetLufs(targetLufs: number): void {
    this.targetLufs = targetLufs;
    this.updateGains();
  }

  public setPreAmpDb(db: number): void {
    this.preAmpDb = Math.max(-10, Math.min(10, db));
    this.preAmpGain.gain.setTargetAtTime(dbToGain(this.preAmpDb), this.context.currentTime, 0.05);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateGains();
  }

  private updateGains(): void {
    const linearGain = this.enabled ? calculateLoudnessGain(this.currentTrackLufs, this.targetLufs) : 1.0;
    this.normalizationGain.gain.setTargetAtTime(linearGain, this.context.currentTime, 0.05);
    this.preAmpGain.gain.setTargetAtTime(dbToGain(this.preAmpDb), this.context.currentTime, 0.05);
  }

  public getOptions(): NormalizerOptions {
    return {
      enabled: this.enabled,
      targetLufs: this.targetLufs,
      preAmpDb: this.preAmpDb,
      limiterThresholdDb: this.limiterNode.threshold.value,
    };
  }
}
