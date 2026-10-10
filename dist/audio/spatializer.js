export class StereoSpatializer {
    context;
    inputNode;
    outputNode;
    pannerNode;
    wetGain;
    dryGain;
    delayL;
    delayR;
    enabled = false;
    pan = 0;
    stereoSpread = 1.0;
    constructor(context) {
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
    setupGraph() {
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
    setPan(pan) {
        this.pan = Math.max(-1, Math.min(1, pan));
        this.pannerNode.pan.setTargetAtTime(this.pan, this.context.currentTime, 0.05);
    }
    setStereoSpread(spread) {
        this.stereoSpread = Math.max(0, Math.min(2.0, spread));
        this.updateGains();
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        this.updateGains();
    }
    updateGains() {
        if (!this.enabled) {
            this.dryGain.gain.setTargetAtTime(1.0, this.context.currentTime, 0.05);
            this.wetGain.gain.setTargetAtTime(0.0, this.context.currentTime, 0.05);
        }
        else {
            // Balance dry and wet cross-feed based on stereo spread
            const wetAmount = (this.stereoSpread - 1.0) * 0.4; // subtle cross-feed expansion
            this.dryGain.gain.setTargetAtTime(1.0, this.context.currentTime, 0.05);
            this.wetGain.gain.setTargetAtTime(Math.max(0, wetAmount), this.context.currentTime, 0.05);
        }
    }
    getOptions() {
        return {
            enabled: this.enabled,
            pan: this.pan,
            stereoSpread: this.stereoSpread,
        };
    }
}
//# sourceMappingURL=spatializer.js.map