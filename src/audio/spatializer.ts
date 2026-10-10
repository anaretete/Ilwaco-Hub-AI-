import { SpatializerOptions } from '../types/audio-dsp.js';

export class StereoSpatializer {
  private context: AudioContext;
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  private pannerNode: StereoPannerNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private delayL: DelayNode;
  private delayR: DelayNode;

  private enabled: boolean = false;
  private pan: number = 0;
  private stereoSpread: number = 1.0;

  constructor(context: AudioContext) {
    this.context = context;
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();

    this.pannerNode = context.createStereoPanner();
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();

    // Create Haas/Binaural cross-feed delay nodes for headphone spatialization
    this.delayL = context.createDelay();
    this.delayR = context.createDelay();
    this.delayL.delayTime.value = 0.0004; // 0.4ms cross-feed delay mimicking human interaural time difference (ITD)
    this.delayR.delayTime.value = 0.0004;

    this.setupGraph();
    this.updateGains();
  }

  private setupGraph(): void {
    // Input -> PannerNode
    this.inputNode.connect(this.pannerNode);

    // Dry path
    this.pannerNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // Spatialized wet path (cross-feed)
    this.pannerNode.connect(this.delayL);
    this.pannerNode.connect(this.delayR);
    this.delayL.connect(this.wetGain);
    this.delayR.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  public setPan(pan: number): void {
    this.pan = Math.max(-1, Math.min(1, pan));
    this.pannerNode.pan.setTargetAtTime(this.pan, this.context.currentTime, 0.05);
  }

  public setStereoSpread(spread: number): void {
    this.stereoSpread = Math.max(0, Math.min(2.0, spread));
    this.updateGains();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateGains();
  }

  private updateGains(): void {
    if (!this.enabled) {
      this.dryGain.gain.setTargetAtTime(1.0, this.context.currentTime, 0.05);
      this.wetGain.gain.setTargetAtTime(0.0, this.context.currentTime, 0.05);
    } else {
      // Balance dry and wet cross-feed based on stereo spread
      const wetAmount = (this.stereoSpread - 1.0) * 0.4; // subtle cross-feed expansion
      this.dryGain.gain.setTargetAtTime(1.0, this.context.currentTime, 0.05);
      this.wetGain.gain.setTargetAtTime(Math.max(0, wetAmount), this.context.currentTime, 0.05);
    }
  }

  public getOptions(): SpatializerOptions {
    return {
      enabled: this.enabled,
      pan: this.pan,
      stereoSpread: this.stereoSpread,
    };
  }
}
