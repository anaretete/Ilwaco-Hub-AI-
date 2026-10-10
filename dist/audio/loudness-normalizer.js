import { calculateLoudnessGain, dbToGain } from '../utils/formatters.js';
export class LoudnessNormalizer {
    context;
    inputNode;
    outputNode;
    normalizationGain;
    preAmpGain;
    limiterNode;
    enabled = true;
    targetLufs = -14.0;
    preAmpDb = 0;
    currentTrackLufs = -14.0;
    constructor(context, options) {
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
    setupGraph() {
        // Input -> Normalization Gain -> Pre-Amp Gain -> Limiter -> Output
        this.inputNode.connect(this.normalizationGain);
        this.normalizationGain.connect(this.preAmpGain);
        this.preAmpGain.connect(this.limiterNode);
        this.limiterNode.connect(this.outputNode);
        this.updateGains();
    }
    setTrackLufs(lufs) {
        this.currentTrackLufs = lufs ?? -14.0;
        this.updateGains();
    }
    setTargetLufs(targetLufs) {
        this.targetLufs = targetLufs;
        this.updateGains();
    }
    setPreAmpDb(db) {
        this.preAmpDb = Math.max(-10, Math.min(10, db));
        this.preAmpGain.gain.setTargetAtTime(dbToGain(this.preAmpDb), this.context.currentTime, 0.05);
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        this.updateGains();
    }
    updateGains() {
        const linearGain = this.enabled ? calculateLoudnessGain(this.currentTrackLufs, this.targetLufs) : 1.0;
        this.normalizationGain.gain.setTargetAtTime(linearGain, this.context.currentTime, 0.05);
        this.preAmpGain.gain.setTargetAtTime(dbToGain(this.preAmpDb), this.context.currentTime, 0.05);
    }
    getOptions() {
        return {
            enabled: this.enabled,
            targetLufs: this.targetLufs,
            preAmpDb: this.preAmpDb,
            limiterThresholdDb: this.limiterNode.threshold.value,
        };
    }
}
//# sourceMappingURL=loudness-normalizer.js.map