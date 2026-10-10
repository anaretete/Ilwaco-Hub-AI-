import {
  AudioPlayerService,
  StreamResolutionPipeline,
  InnerTubeResolver,
  CustomSourceResolver,
  JioSaavnResolver,
  Track,
  formatTime,
  DEFAULT_EQ_FREQUENCIES,
} from '../index.js';

// Sample demo playlist mimicking BitChord library items
const DEMO_PLAYLIST: Track[] = [
  {
    id: 'track-1',
    title: 'Midnight City',
    artist: 'M83',
    album: "Hurry Up, We're Dreaming",
    duration: 243,
    sourceType: 'custom_module',
    artwork: [
      { url: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&q=80' },
    ],
  },
  {
    id: 'track-2',
    title: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    album: 'Starboy',
    duration: 230,
    sourceType: 'youtube',
    sourceId: '34Na4j8AVgA',
    artwork: [
      { url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80' },
    ],
  },
  {
    id: 'track-3',
    title: 'Get Lucky',
    artist: 'Daft Punk ft. Pharrell Williams',
    album: 'Random Access Memories',
    duration: 248,
    sourceType: 'jiosaavn',
    artwork: [
      { url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80' },
    ],
  },
];

class BitChordUI {
  private player: AudioPlayerService;
  private pipeline: StreamResolutionPipeline;

  // DOM Elements
  private btnPlayPause = document.getElementById('btnPlayPause') as HTMLButtonElement;
  private iconPlay = document.getElementById('iconPlay') as HTMLElement;
  private iconPause = document.getElementById('iconPause') as HTMLElement;
  private btnPrev = document.getElementById('btnPrev') as HTMLButtonElement;
  private btnNext = document.getElementById('btnNext') as HTMLButtonElement;
  private btnShuffle = document.getElementById('btnShuffle') as HTMLButtonElement;
  private btnRepeat = document.getElementById('btnRepeat') as HTMLButtonElement;
  private btnLike = document.getElementById('btnLike') as HTMLButtonElement;

  private timelineSlider = document.getElementById('timelineSlider') as HTMLInputElement;
  private timeElapsed = document.getElementById('timeElapsed') as HTMLElement;
  private timeRemaining = document.getElementById('timeRemaining') as HTMLElement;
  private volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
  private btnMute = document.getElementById('btnMute') as HTMLElement;

  private trackTitle = document.getElementById('trackTitle') as HTMLElement;
  private trackArtist = document.getElementById('trackArtist') as HTMLElement;
  private artworkImg = document.getElementById('artworkImg') as HTMLImageElement;
  private qualityBadge = document.getElementById('qualityBadge') as HTMLElement;
  private albumLabel = document.getElementById('albumLabel') as HTMLElement;
  private ambientBg = document.getElementById('ambientBg') as HTMLElement;

  // Pipeline flow nodes
  private nodeSourceLabel = document.getElementById('nodeSourceLabel') as HTMLElement;
  private pipelineActiveDeckLabel = document.getElementById('pipelineActiveDeckLabel') as HTMLElement;

  // Modals
  private modalEQ = document.getElementById('modalEQ') as HTMLElement;
  private modalQueue = document.getElementById('modalQueue') as HTMLElement;
  private modalStats = document.getElementById('modalStats') as HTMLElement;
  private queueList = document.getElementById('queueList') as HTMLElement;
  private eqSlidersRow = document.getElementById('eqSlidersRow') as HTMLElement;
  private eqPresetSelect = document.getElementById('eqPresetSelect') as HTMLSelectElement;
  private chkSpatial = document.getElementById('chkSpatial') as HTMLInputElement;
  private chkNormalizer = document.getElementById('chkNormalizer') as HTMLInputElement;
  private crossfadeSlider = document.getElementById('crossfadeSlider') as HTMLInputElement;
  private crossfadeValueLabel = document.getElementById('crossfadeValueLabel') as HTMLElement;

  // Visualizer canvas
  private visualizerCanvas = document.getElementById('visualizerCanvas') as HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    // 1. Initialize Pipeline & Resolvers
    this.pipeline = new StreamResolutionPipeline();

    // Mock Hi-Res lossless resolver for demo track-1
    this.pipeline.registerResolver({
      name: 'Hi-Res Lossless Module',
      priority: 1,
      canHandle: (track) => track.id === 'track-1',
      resolve: async (track) => ({
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        mimeType: 'audio/flac',
        codec: 'flac',
        bitrate: 1411,
        sampleRate: 96000,
        bitDepth: 24,
        channels: 2,
        isLossless: true,
        duration: track.duration,
        loudnessLufs: -14.2,
        sourceName: 'BitChord Lossless Core',
      }),
    });

    // Mock Secondary resolver for demo track-3
    this.pipeline.registerResolver({
      name: 'JioSaavn Provider',
      priority: 5,
      canHandle: (track) => track.id === 'track-3',
      resolve: async (track) => ({
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        mimeType: 'audio/mp4',
        codec: 'aac',
        bitrate: 320,
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        isLossless: false,
        duration: track.duration,
        loudnessLufs: -13.5,
        sourceName: 'JioSaavn',
      }),
    });

    // 2. Initialize Master Player Service
    this.player = new AudioPlayerService(this.pipeline, undefined, {
      crossfadeDurationSeconds: 4.0,
      enableAutoPreload: true,
    });

    this.initCanvas();
    this.buildEqualizerUI();
    this.bindEvents();
    this.subscribeToPlayer();

    // Load initial playlist into queue
    this.player.setQueue(DEMO_PLAYLIST, 0, false).then(() => {
      this.updateTrackDisplay(DEMO_PLAYLIST[0]);
      this.renderQueue();
    });
  }

  private initCanvas(): void {
    if (this.visualizerCanvas) {
      this.canvasCtx = this.visualizerCanvas.getContext('2d');
      this.visualizerCanvas.width = 290;
      this.visualizerCanvas.height = 48;
      this.renderVisualizer();
    }
  }

  private renderVisualizer(): void {
    requestAnimationFrame(() => this.renderVisualizer());
    if (!this.canvasCtx) return;

    const width = this.visualizerCanvas.width;
    const height = this.visualizerCanvas.height;
    this.canvasCtx.clearRect(0, 0, width, height);

    if (this.player.getState() !== 'playing') return;

    const analyzer = this.player.getAudioGraph().analyzer;
    const freqData = analyzer.getFrequencyData();
    const barCount = 32;
    const barWidth = width / barCount - 2;

    for (let i = 0; i < barCount; i++) {
      const value = freqData[i * 2] || 0;
      const barHeight = (value / 255) * height;
      const x = i * (barWidth + 2);
      const y = height - barHeight;

      const gradient = this.canvasCtx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, 'rgba(250, 45, 72, 0.2)');
      gradient.addColorStop(1, 'rgba(250, 45, 72, 0.85)');

      this.canvasCtx.fillStyle = gradient;
      this.canvasCtx.fillRect(x, y, barWidth, barHeight);
    }
  }

  private buildEqualizerUI(): void {
    if (!this.eqSlidersRow) return;
    this.eqSlidersRow.innerHTML = '';
    const eq = this.player.getAudioGraph().equalizer;
    const bands = eq.getBands();

    bands.forEach((band, idx) => {
      const col = document.createElement('div');
      col.className = 'eq-band-col';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'eq-slider';
      slider.min = '-12';
      slider.max = '12';
      slider.value = band.gain.toString();
      slider.step = '0.5';

      slider.addEventListener('input', () => {
        eq.setBandGain(idx, parseFloat(slider.value));
      });

      const label = document.createElement('span');
      label.className = 'eq-band-label';
      label.innerText = band.frequency >= 1000 ? `${band.frequency / 1000}k` : `${band.frequency}`;

      col.appendChild(slider);
      col.appendChild(label);
      this.eqSlidersRow.appendChild(col);
    });
  }

  private bindEvents(): void {
    // Play / Pause
    this.btnPlayPause.addEventListener('click', async () => {
      if (this.player.getState() === 'playing') {
        this.player.pause();
      } else {
        await this.player.resume();
      }
    });

    // Navigation
    this.btnNext.addEventListener('click', () => this.player.skipToNext(true));
    this.btnPrev.addEventListener('click', () => this.player.skipToPrevious());

    // Shuffle & Repeat
    this.btnShuffle.addEventListener('click', () => {
      const isShuffled = this.player.getQueueManager().toggleShuffle();
      this.btnShuffle.classList.toggle('active', isShuffled);
      this.renderQueue();
    });

    this.btnRepeat.addEventListener('click', () => {
      const qm = this.player.getQueueManager();
      const current = qm.getRepeatMode();
      const next = current === 'off' ? 'all' : current === 'all' ? 'one' : 'off';
      qm.setRepeatMode(next);
      this.btnRepeat.classList.toggle('active', next !== 'off');
      this.btnRepeat.title = `Repeat: ${next.toUpperCase()}`;
    });

    // Like button toggle
    this.btnLike.addEventListener('click', () => {
      this.btnLike.classList.toggle('liked');
    });

    // Timeline Scrubbing
    this.timelineSlider.addEventListener('input', () => {
      const seekSec = (parseFloat(this.timelineSlider.value) / 100) * this.player.getDuration();
      this.player.seek(seekSec);
    });

    // Volume
    this.volumeSlider.addEventListener('input', () => {
      this.player.setVolume(parseFloat(this.volumeSlider.value));
    });

    this.btnMute.addEventListener('click', () => {
      const isMuted = this.player.getAudioGraph().getIsMuted();
      this.player.setMuted(!isMuted);
      this.volumeSlider.value = isMuted ? this.player.getVolume().toString() : '0';
    });

    // Tool Drawers
    document.getElementById('btnOpenEQ')?.addEventListener('click', () => this.modalEQ.classList.add('open'));
    document.getElementById('btnCloseEQ')?.addEventListener('click', () => this.modalEQ.classList.remove('open'));

    document.getElementById('btnOpenQueue')?.addEventListener('click', () => {
      this.renderQueue();
      this.modalQueue.classList.add('open');
    });
    document.getElementById('btnCloseQueue')?.addEventListener('click', () => this.modalQueue.classList.remove('open'));

    document.getElementById('btnOpenStats')?.addEventListener('click', () => this.modalStats.classList.add('open'));
    document.getElementById('btnCloseStats')?.addEventListener('click', () => this.modalStats.classList.remove('open'));

    // DSP Presets & Toggles
    this.eqPresetSelect.addEventListener('change', () => {
      this.player.getAudioGraph().equalizer.setPreset(this.eqPresetSelect.value);
      this.buildEqualizerUI();
    });

    this.chkSpatial.addEventListener('change', () => {
      this.player.getAudioGraph().spatializer.setEnabled(this.chkSpatial.checked);
    });

    this.chkNormalizer.addEventListener('change', () => {
      this.player.getAudioGraph().normalizer.setEnabled(this.chkNormalizer.checked);
    });

    this.crossfadeSlider.addEventListener('input', () => {
      const val = parseInt(this.crossfadeSlider.value, 10);
      this.player.setCrossfadeDuration(val);
      this.crossfadeValueLabel.innerText = `${val}s`;
    });
  }

  private subscribeToPlayer(): void {
    this.player.on('stateChange', (state) => {
      const isPlaying = state === 'playing';
      this.iconPlay.style.display = isPlaying ? 'none' : 'block';
      this.iconPause.style.display = isPlaying ? 'block' : 'none';
    });

    this.player.on('trackChange', (track, stream) => {
      if (track) {
        this.updateTrackDisplay(track);
      }
      if (stream) {
        this.updateStreamBadge(stream);
      }
      this.renderQueue();
    });

    this.player.on('progress', (prog) => {
      if (prog.duration > 0) {
        const percent = (prog.currentTime / prog.duration) * 100;
        this.timelineSlider.value = percent.toFixed(2);
        this.timeElapsed.innerText = formatTime(prog.currentTime);
        this.timeRemaining.innerText = `-${formatTime(Math.max(0, prog.duration - prog.currentTime))}`;
      }
    });

    this.player.on('telemetry', (telemetry) => {
      this.updateTelemetryStats(telemetry);
    });
  }

  private updateTrackDisplay(track: Track): void {
    this.trackTitle.innerText = track.title;
    this.trackArtist.innerText = `${track.artist}${track.album ? ` — ${track.album}` : ''}`;
    this.albumLabel.innerText = track.album ? `Album • ${track.album}` : 'Single';

    if (track.artwork && track.artwork.length > 0) {
      this.artworkImg.src = track.artwork[0].url;
    }
  }

  private updateStreamBadge(stream: any): void {
    if (stream.isLossless) {
      this.qualityBadge.className = 'quality-badge lossless';
      this.qualityBadge.innerText = `${stream.codec.toUpperCase()} • ${stream.sampleRate / 1000}kHz/${stream.bitDepth}-bit`;
      this.nodeSourceLabel.innerText = stream.codec.toUpperCase();
    } else {
      this.qualityBadge.className = 'quality-badge';
      this.qualityBadge.innerText = `${stream.codec.toUpperCase()} • ${stream.bitrate} kbps`;
      this.nodeSourceLabel.innerText = stream.codec.toUpperCase();
    }
  }

  private updateTelemetryStats(telemetry: any): void {
    this.pipelineActiveDeckLabel.innerText = `Deck ${telemetry.activeDeck} (${telemetry.dspChainActive ? 'DSP Active' : 'Bypass'})`;

    const setText = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setText('statCodec', `${telemetry.codec.toUpperCase()} ${telemetry.isLossless ? '(Lossless)' : ''}`);
    setText('statBitrate', `${telemetry.bitrateKbps} kbps`);
    setText('statSampleRate', `${telemetry.sampleRateHz.toLocaleString()} Hz / ${telemetry.bitDepthBits}-bit`);
    setText('statChannels', telemetry.channels === 2 ? 'Stereo (2.0)' : `${telemetry.channels} Ch`);
    setText('statSource', telemetry.sourceName);
    setText('statLufs', `${telemetry.currentLufs.toFixed(1)} LUFS`);
    setText('statDeck', `Deck ${telemetry.activeDeck}`);
    setText('statCrossfade', this.player.getAudioGraph().crossfader.getIsCrossfading() ? 'Crossfading' : 'Idle');
    setText('statBuffer', `${telemetry.bufferHealthSeconds.toFixed(1)}s ahead (${(telemetry.bufferHealthRatio * 100).toFixed(0)}%)`);
    setText('statLatency', `${telemetry.latencyMs} ms`);
  }

  private renderQueue(): void {
    if (!this.queueList) return;
    this.queueList.innerHTML = '';

    const current = this.player.getCurrentTrack();
    const upcoming = this.player.getQueueManager().getUpcomingQueue();

    if (current) {
      const item = this.createQueueItem(current, true);
      this.queueList.appendChild(item);
    }

    upcoming.forEach((track) => {
      const item = this.createQueueItem(track, false);
      item.addEventListener('click', () => {
        this.player.playTrack(track);
      });
      this.queueList.appendChild(item);
    });
  }

  private createQueueItem(track: Track, isActive: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = `queue-item ${isActive ? 'active' : ''}`;

    const thumb = document.createElement('img');
    thumb.className = 'queue-thumb';
    thumb.src = track.artwork?.[0]?.url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80';

    const meta = document.createElement('div');
    meta.className = 'queue-meta';

    const title = document.createElement('div');
    title.className = 'queue-item-title';
    title.innerText = track.title;

    const artist = document.createElement('div');
    artist.className = 'queue-item-artist';
    artist.innerText = `${track.artist} ${isActive ? '• Now Playing' : ''}`;

    meta.appendChild(title);
    meta.appendChild(artist);
    el.appendChild(thumb);
    el.appendChild(meta);

    return el;
  }
}

// Instantiate UI upon DOM readiness
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    new BitChordUI();
  });
}
