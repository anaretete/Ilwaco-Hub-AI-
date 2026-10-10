import { NormalizerOptions } from '../types/audio-dsp.js';
export declare class LoudnessNormalizer {
    private context;
    readonly inputNode: GainNode;
    readonly outputNode: GainNode;
    private normalizationGain;
    private preAmpGain;
    private limiterNode;
    private enabled;
    private targetLufs;
    private preAmpDb;
    private currentTrackLufs;
    constructor(context: AudioContext, options?: Partial<NormalizerOptions>);
    private setupGraph;
    setTrackLufs(lufs?: number): void;
    setTargetLufs(targetLufs: number): void;
    setPreAmpDb(db: number): void;
    setEnabled(enabled: boolean): void;
    private updateGains;
    getOptions(): NormalizerOptions;
}
//# sourceMappingURL=loudness-normalizer.d.ts.map