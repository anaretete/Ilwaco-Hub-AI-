import { SpatializerOptions } from '../types/audio-dsp.js';
export declare class StereoSpatializer {
    private context;
    readonly inputNode: GainNode;
    readonly outputNode: GainNode;
    private pannerNode;
    private wetGain;
    private dryGain;
    private delayL;
    private delayR;
    private enabled;
    private pan;
    private stereoSpread;
    constructor(context: AudioContext);
    private setupGraph;
    setPan(pan: number): void;
    setStereoSpread(spread: number): void;
    setEnabled(enabled: boolean): void;
    private updateGains;
    getOptions(): SpatializerOptions;
}
//# sourceMappingURL=spatializer.d.ts.map