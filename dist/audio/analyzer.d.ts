export declare class AudioAnalyzer {
    private analyser;
    private freqBuffer;
    private timeBuffer;
    constructor(context: AudioContext, fftSize?: number);
    getNode(): AnalyserNode;
    getFrequencyData(): Uint8Array;
    getWaveformData(): Uint8Array;
    /**
     * Calculates live instantaneous RMS amplitude (0.0 to 1.0).
     */
    getRmsLevel(): number;
}
//# sourceMappingURL=analyzer.d.ts.map