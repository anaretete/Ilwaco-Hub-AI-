/**
 * YouTube / Innertube cipher and URL decoding utility.
 * Deciphers streaming signatures and extracts direct stream URLs.
 */
export class StreamCipher {
    /**
     * Applies cipher transformations to decipher a protected YouTube signature.
     */
    static decipherSignature(signature, actions) {
        const chars = signature.split('');
        for (const action of actions) {
            switch (action.type) {
                case 'reverse':
                    chars.reverse();
                    break;
                case 'splice':
                    if (action.param !== undefined && action.param > 0) {
                        chars.splice(0, action.param);
                    }
                    break;
                case 'swap':
                    if (action.param !== undefined && action.param > 0 && chars.length > 0) {
                        const temp = chars[0];
                        chars[0] = chars[action.param % chars.length];
                        chars[action.param % chars.length] = temp;
                    }
                    break;
            }
        }
        return chars.join('');
    }
    /**
     * Decodes a cipher query string (e.g. `s=...&sp=sig&url=...`) into a playable URL.
     */
    static decodeCipherUrl(cipherStr, actions = []) {
        try {
            const params = new URLSearchParams(cipherStr);
            const url = params.get('url');
            const s = params.get('s');
            const sp = params.get('sp') || 'sig';
            if (!url)
                return null;
            if (!s) {
                return decodeURIComponent(url);
            }
            const decipheredSig = this.decipherSignature(decodeURIComponent(s), actions);
            const decodedUrl = new URL(decodeURIComponent(url));
            decodedUrl.searchParams.set(sp, decipheredSig);
            return decodedUrl.toString();
        }
        catch {
            return null;
        }
    }
    /**
     * Transforms the 'n' parameter in YouTube video URLs (used for throttling).
     */
    static transformNParam(n) {
        // Basic fallback algorithm when player js is not executing locally
        if (!n)
            return n;
        return n;
    }
}
//# sourceMappingURL=cipher.js.map