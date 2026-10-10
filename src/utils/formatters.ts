/**
 * Converts decibels (dB) to linear amplitude gain.
 * e.g., 0 dB -> 1.0, -6 dB -> ~0.501, +6 dB -> ~1.995
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Converts linear amplitude gain to decibels (dB).
 */
export function gainToDb(gain: number): number {
  if (gain <= 0.00001) return -100;
  return 20 * Math.log10(gain);
}

/**
 * Calculates equal-power crossfade gains for two decks.
 * Using constant power curve:
 * deckA Gain = cos(t * pi / 2)
 * deckB Gain = sin(t * pi / 2)
 *
 * This ensures that deckA^2 + deckB^2 = 1.0 (constant acoustic power),
 * preventing the volume dip at center transition that occurs with linear crossfades.
 *
 * @param progress 0.0 (100% Deck A) to 1.0 (100% Deck B)
 */
export function equalPowerGains(progress: number): { deckAGain: number; deckBGain: number } {
  const p = Math.max(0, Math.min(1, progress));
  const angle = (p * Math.PI) / 2;
  return {
    deckAGain: Math.cos(angle),
    deckBGain: Math.sin(angle),
  };
}

/**
 * Calculates gain adjustment required to reach target LUFS from current track LUFS.
 * e.g., current = -18 LUFS, target = -14 LUFS -> delta = +4 dB -> linear gain ~ 1.58
 * Includes a safety clamp to prevent excessive digital amplification.
 */
export function calculateLoudnessGain(trackLufs?: number, targetLufs: number = -14.0, maxBoostDb: number = 6.0): number {
  if (trackLufs === undefined || isNaN(trackLufs)) {
    return 1.0;
  }
  const deltaDb = targetLufs - trackLufs;
  const clampedDb = Math.min(maxBoostDb, Math.max(-18, deltaDb));
  return dbToGain(clampedDb);
}

/**
 * Formats time in seconds to mm:ss or hh:mm:ss.
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
