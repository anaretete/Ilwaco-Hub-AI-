import { EQBandConfig, EqualizerPreset } from '../types/audio-dsp.js';
export declare const DEFAULT_EQ_FREQUENCIES: number[];
export declare const EQ_PRESETS: Record<string, EqualizerPreset>;
export declare class DynamicEqualizer {
    private context;
    private filters;
    readonly inputNode: GainNode;
    readonly outputNode: GainNode;
    private enabled;
    private currentGains;
    constructor(context: AudioContext, frequencies?: number[]);
    private buildFilterGraph;
    setBandGain(bandIndex: number, gainDb: number): void;
    setPreset(presetName: string): boolean;
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
    getBands(): EQBandConfig[];
}
//# sourceMappingURL=equalizer.d.ts.map