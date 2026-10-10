import { assert, strictEqual } from './assert.js';
import {
  equalPowerGains,
  dbToGain,
  gainToDb,
  calculateLoudnessGain,
  formatTime,
  EQ_PRESETS,
  DEFAULT_EQ_FREQUENCIES,
} from '../dist/index.js';

export function runAudioDspTests(): void {
  console.log('--- Testing Audio DSP Utilities ---');

  // 1. Equal-power crossfade curve verification
  for (let step = 0; step <= 10; step++) {
    const progress = step / 10;
    const { deckAGain, deckBGain } = equalPowerGains(progress);

    // Constant power property: A^2 + B^2 == 1.0
    const power = deckAGain * deckAGain + deckBGain * deckBGain;
    assert(
      Math.abs(power - 1.0) < 0.0001,
      `Equal-power curve power sum should equal 1.0 at progress ${progress}, got ${power}`
    );
  }

  // Boundary conditions
  const atStart = equalPowerGains(0.0);
  assert(Math.abs(atStart.deckAGain - 1.0) < 0.0001, 'At start, Deck A should be 1.0');
  assert(Math.abs(atStart.deckBGain - 0.0) < 0.0001, 'At start, Deck B should be 0.0');

  const atCenter = equalPowerGains(0.5);
  // At center, cos(pi/4) = sin(pi/4) = 1/sqrt(2) ≈ 0.7071
  assert(Math.abs(atCenter.deckAGain - Math.SQRT1_2) < 0.0001, 'At center, Deck A should be ~0.7071');
  assert(Math.abs(atCenter.deckBGain - Math.SQRT1_2) < 0.0001, 'At center, Deck B should be ~0.7071');

  const atEnd = equalPowerGains(1.0);
  assert(Math.abs(atEnd.deckAGain - 0.0) < 0.0001, 'At end, Deck A should be 0.0');
  assert(Math.abs(atEnd.deckBGain - 1.0) < 0.0001, 'At end, Deck B should be 1.0');

  console.log('✓ Equal-power crossfade curve math verified');

  // 2. dB to Linear Gain and Gain to dB
  assert(Math.abs(dbToGain(0) - 1.0) < 0.0001, '0 dB should equal linear gain 1.0');
  assert(Math.abs(dbToGain(6) - 1.99526) < 0.001, '+6 dB should equal linear gain ~1.995');
  assert(Math.abs(dbToGain(-6) - 0.50118) < 0.001, '-6 dB should equal linear gain ~0.501');
  assert(Math.abs(gainToDb(1.0) - 0) < 0.0001, 'Linear gain 1.0 should equal 0 dB');
  console.log('✓ dB and Gain conversion verified');

  // 3. Loudness LUFS Normalization Calculation
  // Target: -14 LUFS
  // If track is -18 LUFS (quieter by 4dB) -> should boost by +4dB (gain ~1.58)
  const boostGain = calculateLoudnessGain(-18.0, -14.0);
  assert(boostGain > 1.5 && boostGain < 1.6, `Should boost quieter track, got gain ${boostGain}`);

  // If track is -10 LUFS (louder by 4dB) -> should attenuate by -4dB (gain ~0.63)
  const cutGain = calculateLoudnessGain(-10.0, -14.0);
  assert(cutGain > 0.6 && cutGain < 0.7, `Should attenuate louder track, got gain ${cutGain}`);
  console.log('✓ LUFS normalization math verified');

  // 4. Time formatting
  strictEqual(formatTime(0), '0:00');
  strictEqual(formatTime(65), '1:05');
  strictEqual(formatTime(3605), '1:00:05');
  console.log('✓ Time formatting verified');

  // 5. Presets validation
  strictEqual(DEFAULT_EQ_FREQUENCIES.length, 10);
  assert(EQ_PRESETS.bassBoost.gains[0] > 0);
  assert(EQ_PRESETS.trebleBoost.gains[9] > 0);
  console.log('✓ EQ Presets verified');
}
