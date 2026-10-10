export class AudioAnalyzer {
  private analyser: AnalyserNode;
  private freqBuffer: Uint8Array;
  private timeBuffer: Uint8Array;

  constructor(context: AudioContext, fftSize: number = 2048) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = 0.8;

    this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.timeBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
  }

  public getNode(): AnalyserNode {
    return this.analyser;
  }

  public getFrequencyData(): Uint8Array {
    this.analyser.getByteFrequencyData(this.freqBuffer as any);
    return this.freqBuffer;
  }

  public getWaveformData(): Uint8Array {
    this.analyser.getByteTimeDomainData(this.timeBuffer as any);
    return this.timeBuffer;
  }

  /**
   * Calculates live instantaneous RMS amplitude (0.0 to 1.0).
   */
  public getRmsLevel(): number {
    this.analyser.getByteTimeDomainData(this.timeBuffer as any);
    let sum = 0;
    for (let i = 0; i < this.timeBuffer.length; i++) {
      // Byte values range from 0 to 255 with silence at 128
      const normalized = (this.timeBuffer[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / this.timeBuffer.length);
  }
}
