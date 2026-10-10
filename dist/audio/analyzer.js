export class AudioAnalyzer {
    analyser;
    freqBuffer;
    timeBuffer;
    constructor(context, fftSize = 2048) {
        this.analyser = context.createAnalyser();
        this.analyser.fftSize = fftSize;
        this.analyser.smoothingTimeConstant = 0.8;
        this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
        this.timeBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    }
    getNode() {
        return this.analyser;
    }
    getFrequencyData() {
        this.analyser.getByteFrequencyData(this.freqBuffer);
        return this.freqBuffer;
    }
    getWaveformData() {
        this.analyser.getByteTimeDomainData(this.timeBuffer);
        return this.timeBuffer;
    }
    /**
     * Calculates live instantaneous RMS amplitude (0.0 to 1.0).
     */
    getRmsLevel() {
        this.analyser.getByteTimeDomainData(this.timeBuffer);
        let sum = 0;
        for (let i = 0; i < this.timeBuffer.length; i++) {
            // Byte values range from 0 to 255 with silence at 128
            const normalized = (this.timeBuffer[i] - 128) / 128;
            sum += normalized * normalized;
        }
        return Math.sqrt(sum / this.timeBuffer.length);
    }
}
//# sourceMappingURL=analyzer.js.map