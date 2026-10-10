export interface CipherAction {
    type: 'reverse' | 'swap' | 'splice';
    param?: number;
}
/**
 * YouTube / Innertube cipher and URL decoding utility.
 * Deciphers streaming signatures and extracts direct stream URLs.
 */
export declare class StreamCipher {
    /**
     * Applies cipher transformations to decipher a protected YouTube signature.
     */
    static decipherSignature(signature: string, actions: CipherAction[]): string;
    /**
     * Decodes a cipher query string (e.g. `s=...&sp=sig&url=...`) into a playable URL.
     */
    static decodeCipherUrl(cipherStr: string, actions?: CipherAction[]): string | null;
    /**
     * Transforms the 'n' parameter in YouTube video URLs (used for throttling).
     */
    static transformNParam(n: string): string;
}
//# sourceMappingURL=cipher.d.ts.map