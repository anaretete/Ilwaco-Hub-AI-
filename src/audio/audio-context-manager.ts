export class AudioContextManager {
  private context: AudioContext | null = null;
  private isUnlocked: boolean = false;

  public getContext(): AudioContext {
    if (!this.context) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this environment');
      }
      this.context = new AudioCtx({
        latencyHint: 'playback',
      });
    }
    return this.context;
  }

  public async unlock(): Promise<boolean> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this.isUnlocked = true;
        return true;
      } catch (err) {
        console.warn('[AudioContextManager] Failed to resume AudioContext:', err);
        return false;
      }
    }
    this.isUnlocked = ctx.state === 'running';
    return this.isUnlocked;
  }

  public getState(): AudioContextState | 'uninitialized' {
    return this.context ? this.context.state : 'uninitialized';
  }

  public getSampleRate(): number {
    return this.context ? this.context.sampleRate : 48000;
  }

  public async close(): Promise<void> {
    if (this.context && this.context.state !== 'closed') {
      await this.context.close();
      this.context = null;
      this.isUnlocked = false;
    }
  }
}
