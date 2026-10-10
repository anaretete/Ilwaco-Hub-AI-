/**
 * Converts decibels (dB) to linear amplitude gain.
 * e.g., 0 dB -> 1.0, -6 dB -> ~0.501, +6 dB -> ~1.995
 */
export declare function dbToGain(db: number): number;
/**
 * Converts linear amplitude gain to decibels (dB).
 */
export declare function gainToDb(gain: number): number;
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
export declare function equalPowerGains(progress: number): {
    deckAGain: number;
    deckBGain: number;
};
/**
 * Calculates gain adjustment required to reach target LUFS from current track LUFS.
 * e.g., current = -18 LUFS, target = -14 LUFS -> delta = +4 dB -> linear gain ~ 1.58
 * Includes a safety clamp to prevent excessive digital amplification.
 */
export declare function calculateLoudnessGain(trackLufs?: number, targetLufs?: number, maxBoostDb?: number): number;
/**
 * Formats time in seconds to mm:ss or hh:mm:ss.
 */
export declare function formatTime(seconds: number): string;
//# sourceMappingURL=formatters.d.ts.map