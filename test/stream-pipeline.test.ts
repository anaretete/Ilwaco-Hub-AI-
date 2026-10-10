import { assert, strictEqual } from './assert.js';
import {
  StreamResolutionPipeline,
  StreamCache,
  StreamCipher,
  IStreamResolver,
  Track,
  AudioStream,
} from '../dist/index.js';

export async function runStreamPipelineTests(): Promise<void> {
  console.log('--- Testing StreamCipher ---');
  {
    // Test cipher deciphering
    const actions = [
      { type: 'reverse' as const },
      { type: 'splice' as const, param: 2 },
      { type: 'swap' as const, param: 3 },
    ];
    const originalSig = 'abcdefghij';
    // reverse: 'jihgfedcba'
    // splice(2): 'hgfedcba'
    // swap(3): swap index 0 ('h') with index 3 ('e') -> 'egfhdcba'
    const result = StreamCipher.decipherSignature(originalSig, actions);
    strictEqual(result, 'egfhdcba', 'Cipher deciphering transformation should match expected output');

    // Test cipher URL decoding
    const cipherStr = `s=${encodeURIComponent('testSig123')}&sp=sig&url=${encodeURIComponent('https://rr1---sn.googlevideo.com/videoplayback?id=123')}`;
    const decodedUrl = StreamCipher.decodeCipherUrl(cipherStr, [{ type: 'reverse' }]);
    assert(decodedUrl !== null, 'Decoded URL should not be null');
    assert(decodedUrl && decodedUrl.includes('sig=321giStset'), 'Decoded URL should contain deciphered signature');
    console.log('✓ StreamCipher passed');
  }

  console.log('--- Testing StreamCache ---');
  {
    const cache = new StreamCache(2, 3600 * 1000); // max 2 entries, 1 hour TTL
    const mockStream: AudioStream = {
      url: 'https://stream.example.com/audio.opus?expire=' + Math.floor((Date.now() + 3600 * 1000) / 1000),
      mimeType: 'audio/webm; codecs="opus"',
      codec: 'opus',
      bitrate: 160,
      sampleRate: 48000,
      bitDepth: 16,
      channels: 2,
      isLossless: false,
      sourceName: 'InnerTubeX',
    };

    cache.set('track-1', mockStream);
    strictEqual(cache.get('track-1')?.url, mockStream.url, 'Cache should return stored stream');

    // Invalidation
    cache.invalidate('track-1');
    strictEqual(cache.get('track-1'), null, 'Invalidated track should return null');

    // LRU eviction
    cache.set('track-1', mockStream);
    cache.set('track-2', { ...mockStream, url: 'url2' });
    cache.get('track-1'); // access track-1
    cache.set('track-3', { ...mockStream, url: 'url3' }); // should evict track-2

    assert(cache.get('track-1') !== null, 'Recently accessed track-1 should remain');
    strictEqual(cache.get('track-2'), null, 'LRU track-2 should be evicted');
    assert(cache.get('track-3') !== null, 'Newly added track-3 should exist');
    console.log('✓ StreamCache passed');
  }

  console.log('--- Testing StreamResolutionPipeline ---');
  {
    const pipeline = new StreamResolutionPipeline();

    // Mock Hi-Res lossless resolver
    const mockLosslessResolver: IStreamResolver = {
      name: 'MockLosslessModule',
      priority: 1,
      canHandle: () => true,
      resolve: async (track) => {
        if (track.id === 'track-lossless') {
          return {
            url: 'https://lossless.example.com/stream.flac',
            mimeType: 'audio/flac',
            codec: 'flac',
            bitrate: 1411,
            sampleRate: 96000,
            bitDepth: 24,
            channels: 2,
            isLossless: true,
            duration: track.duration,
            sourceName: 'MockLosslessModule',
          };
        }
        return null;
      },
    };

    // Mock Secondary resolver
    const mockSecondaryResolver: IStreamResolver = {
      name: 'MockSecondary',
      priority: 5,
      canHandle: () => true,
      resolve: async (track) => {
        return {
          url: 'https://secondary.example.com/stream.m4a',
          mimeType: 'audio/mp4',
          codec: 'aac',
          bitrate: 320,
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          isLossless: false,
          duration: track.duration,
          sourceName: 'MockSecondary',
        };
      },
    };

    pipeline.registerResolver(mockLosslessResolver);
    pipeline.registerResolver(mockSecondaryResolver);

    // 1. Should prioritize Lossless module for track-lossless
    const trackLossless: Track = {
      id: 'track-lossless',
      title: 'Lossless Symphony',
      artist: 'BitChord Ensemble',
      duration: 240,
      sourceType: 'custom_module',
    };
    const res1 = await pipeline.resolve(trackLossless);
    strictEqual(res1.stream.isLossless, true);
    strictEqual(res1.stream.sourceName, 'MockLosslessModule');
    strictEqual(res1.fromCache, false);

    // 2. Second request should hit cache
    const resCache = await pipeline.resolve(trackLossless);
    strictEqual(resCache.fromCache, true);

    // 3. Fallback when Lossless returns null
    const trackRegular: Track = {
      id: 'track-regular',
      title: 'Standard Song',
      artist: 'Popular Artist',
      duration: 180,
      sourceType: 'youtube',
    };
    const res2 = await pipeline.resolve(trackRegular);
    strictEqual(res2.stream.sourceName, 'MockSecondary', 'Should fall back to MockSecondary');
    strictEqual(res2.stream.codec, 'aac');

    // 4. Length slack rejection: if resolver returns duration diverging > slack, pipeline rejects it
    const mockMismatchedDurationResolver: IStreamResolver = {
      name: 'MismatchedDurationResolver',
      priority: 0, // highest priority
      canHandle: () => true,
      resolve: async (track) => ({
        url: 'https://bad.example.com/acoustic.mp3',
        mimeType: 'audio/mp3',
        codec: 'mp3',
        bitrate: 128,
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        isLossless: false,
        duration: track.duration + 45, // 45 seconds longer (live or acoustic version mismatch)
        sourceName: 'MismatchedDurationResolver',
      }),
    };

    const slackPipeline = new StreamResolutionPipeline();
    slackPipeline.registerResolver(mockMismatchedDurationResolver);
    slackPipeline.registerResolver(mockSecondaryResolver);

    const resSlack = await slackPipeline.resolve(trackRegular, { lengthSlackSeconds: 5.0 });
    // Should reject MismatchedDurationResolver and fall back to MockSecondary
    strictEqual(
      resSlack.stream.sourceName,
      'MockSecondary',
      'Should reject candidate with duration mismatch > slack'
    );

    console.log('✓ StreamResolutionPipeline passed');
  }
}
