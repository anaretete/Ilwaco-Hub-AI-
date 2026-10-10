export class AudioContextManager {
    context = null;
    isUnlocked = false;
    getContext() {
        if (!this.context) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) {
                throw new Error('Web Audio API is not supported in this environment');
            }
            this.context = new AudioCtx({
                latencyHint: 'playback',
            });
        }
        return this.context;
    }
    async unlock() {
        const ctx = this.getContext();
        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
                this.isUnlocked = true;
                return true;
            }
            catch (err) {
                console.warn('[AudioContextManager] Failed to resume AudioContext:', err);
                return false;
            }
        }
        this.isUnlocked = ctx.state === 'running';
        return this.isUnlocked;
    }
    getState() {
        return this.context ? this.context.state : 'uninitialized';
    }
    getSampleRate() {
        return this.context ? this.context.sampleRate : 48000;
    }
    async close() {
        if (this.context && this.context.state !== 'closed') {
            await this.context.close();
            this.context = null;
            this.isUnlocked = false;
        }
    }
}
//# sourceMappingURL=audio-context-manager.js.map