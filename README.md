# BitChord TypeScript Audio Engine

A complete, high-fidelity TypeScript rewrite of the **Audio Player Service** and **Stream Resolution Pipeline** from BitChord, utilizing the **Web Audio API** and **HTML5 Audio**.

---

## Architecture Overview

```
                      +-----------------------------------+
                      |      StreamResolutionPipeline     |
                      |  (InnerTubeX, Lossless, JioSaavn) |
                      +-----------------+-----------------+
                                        | (Resolves Stream URL)
                                        v
+-----------------------------------------------------------------------------------+
|                              AudioPlayerService                                   |
|                                                                                   |
|  [QueueManager]        [MediaSessionManager]       [AudioTelemetry / Stats]       |
|                                                                                   |
|  +--------------------+                   +--------------------+                  |
|  |    AudioDeck A     |                   |    AudioDeck B     |                  |
|  | (HTML5 Audio #1)   |                   | (HTML5 Audio #2)   |                  |
|  +---------+----------+                   +---------+----------+                  |
|            | MediaElementSource                      | MediaElementSource         |
|            v                                         v                            |
|       [Deck A Gain]                             [Deck B Gain]                     |
|            \                                         /                            |
|             \                                       /                             |
|              +------------------+------------------+                              |
|                                 | (Equal-Power Crossfader 0–12s)                  |
|                                 v                                                 |
|                  +------------------------------+                                 |
|                  |     DynamicEqualizer         |                                 |
|                  | (10-Band BiquadFilter Graph) |                                 |
|                  +--------------+---------------+                                 |
|                                 v                                                 |
|                  +------------------------------+                                 |
|                  |      StereoSpatializer       |                                 |
|                  | (Panner + Binaural Crossfeed)|                                 |
|                  +--------------+---------------+                                 |
|                                 v                                                 |
|                  +------------------------------+                                 |
|                  |      LoudnessNormalizer      |                                 |
|                  | (LUFS Alignment + Limiter)   |                                 |
|                  +--------------+---------------+                                 |
|                                 v                                                 |
|                  +------------------------------+                                 |
|                  |         Master Gain          |                                 |
|                  +--------------+---------------+                                 |
|                                 v                                                 |
|                  +------------------------------+                                 |
|                  |        AudioAnalyzer         |                                 |
|                  |  (FFT & RMS Visualizer Node) |                                 |
|                  +--------------+---------------+                                 |
|                                 v                                                 |
|                     [AudioContext.destination]                                    |
+-----------------------------------------------------------------------------------+
```

---

## Core Components

### 1. Stream Resolution Pipeline (`src/stream/`)
- **InnerTubeX Resolver (`InnerTubeResolver`)**:
  - Talks directly to `/youtubei/v1/player` using client contexts (`WEB_REMIX`).
  - Extracts and ranks audio streams by quality ceiling (`LOW`, `MEDIUM`, `HIGH`, `LOSSLESS`).
  - Handles signature deciphering transformations (`reverse`, `splice`, `swap`) via `StreamCipher`.
  - Parses format metadata: Opus (itag 251), AAC (itag 140/141), sample rate, bit depth, loudness LUFS, and expiration timestamps.
- **Hi-Res Lossless Module Resolver (`CustomSourceResolver`)**:
  - Resolves bit-perfect FLAC/ALAC streams (24-bit/96kHz) from custom server modules / OpenSubsonic addons.
- **Secondary Source Resolver (`JioSaavnResolver`)**:
  - Alternate streaming source for 320kbps AAC audio.
- **Stream Cache (`StreamCache`)**:
  - $O(1)$ LRU caching with expiration tracking and proactive eviction.
  - Automatic cache invalidation upon HTTP 403/410 playback errors.
- **Duration Slack Validation (`lengthSlackSeconds`)**:
  - Rejects candidate streams whose duration diverges beyond configured tolerance (default 5.0s) from the original track duration, preventing acoustic/live rendition mismatches.

### 2. Audio Player Service (`src/player/`)
- **Dual-Deck Gapless & Equal-Power Crossfade**:
  - Two HTML5 `Audio` elements (`Deck A` and `Deck B`) wrapped with `MediaElementAudioSourceNode`.
  - True equal-power crossfading curve ($A = \cos(\theta), B = \sin(\theta)$ where $A^2 + B^2 = 1.0$), eliminating center-transition volume dips.
  - Adjustable crossfade duration (0 to 12s, BitChord default 4s) that works on both automated track endings and manual skips.
  - Background preloading of upcoming queue tracks on the inactive deck.
- **DSP Signal Flow (`src/audio/`)**:
  - **10-Band Dynamic Equalizer**: ISO bands (32Hz–16kHz) with presets (Bass Boost, Treble Boost, Vocal Boost, Rock, Electronic, Acoustic, Flat).
  - **Stereo Spatializer**: Virtual stereo widening with Haas binaural delay cross-feed mimicking interaural time difference (ITD).
  - **Loudness Normalizer**: Adjusts linear gain based on track LUFS relative to -14.0 LUFS target, with a brickwall `DynamicsCompressorNode` limiter preventing digital clipping.
  - **Audio Analyzer**: Real-time FFT frequency spectrum and waveform analysis for UI visualizers.
- **Queue Manager (`QueueManager`)**:
  - Supports Shuffle mode (Fisher-Yates) and Unshuffle (restoring original track order).
  - Repeat modes: `off`, `all`, `one`.
  - Queue mutations: `addTrack`, `addNext`, `removeTrack`, `moveTrack`, `clear`.
- **System Media Session (`MediaSessionManager`)**:
  - Full synchronization with `navigator.mediaSession` (artwork, title, artist, playbackState, and positionState with hardware media key handling).

---

## Installation & Build

```bash
# Build TypeScript to ES2022 JavaScript + Declaration files
npm run build

# Run unit tests
npm test
```

---

## Quick Start Example

```typescript
import {
  AudioPlayerService,
  StreamResolutionPipeline,
  InnerTubeResolver,
  CustomSourceResolver,
  Track
} from 'bitchord-audio';

// 1. Configure the multi-tier stream resolution pipeline
const pipeline = new StreamResolutionPipeline({
  defaultQualityProfile: {
    wifiCeiling: 'LOSSLESS',
    cellularCeiling: 'HIGH',
    preferLosslessWhenAvailable: true,
    lengthSlackSeconds: 5.0,
  },
});

// Register custom lossless source module with priority 1
pipeline.registerResolver(
  new CustomSourceResolver({
    name: 'HiResLosslessServer',
    endpointUrl: 'https://my-subsonic-or-addon.com/stream',
    priority: 1,
  })
);

// 2. Initialize the Audio Player Service
const player = new AudioPlayerService(pipeline, undefined, {
  crossfadeDurationSeconds: 4.0, // 4-second equal-power crossfade
  enableAutoPreload: true,
});

// 3. Listen to player events
player.on('stateChange', (state) => {
  console.log('Playback state:', state);
});

player.on('trackChange', (track, stream) => {
  console.log(`Now playing: ${track?.title} - ${track?.artist}`);
  console.log(`Stream codec: ${stream?.codec}, Bitrate: ${stream?.bitrate} kbps`);
});

player.on('telemetry', (stats) => {
  console.log(`Active Deck: ${stats.activeDeck}, Buffer health: ${stats.bufferHealthSeconds.toFixed(1)}s`);
});

// 4. Play a playlist
const playlist: Track[] = [
  {
    id: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    duration: 213,
    sourceType: 'youtube',
    sourceId: 'dQw4w9WgXcQ',
  },
  {
    id: 'kJQP7kiw5Fk',
    title: 'Despacito',
    artist: 'Luis Fonsi',
    duration: 228,
    sourceType: 'youtube',
    sourceId: 'kJQP7kiw5Fk',
  },
];

await player.setQueue(playlist, 0, true);
```
