export class CustomSourceResolver {
    name;
    priority;
    endpointUrl;
    authToken;
    supportLossless;
    customFetch;
    constructor(config, customFetch) {
        this.name = config.name || 'CustomLosslessModule';
        this.endpointUrl = config.endpointUrl;
        this.authToken = config.authToken;
        this.priority = config.priority ?? 1;
        this.supportLossless = config.supportLossless ?? true;
        this.customFetch = customFetch;
    }
    canHandle(track) {
        // Custom lossless module can attempt resolution for any track if enabled
        return true;
    }
    async resolve(track, options) {
        const fetchFn = this.customFetch || globalThis.fetch;
        if (!fetchFn)
            return null;
        try {
            const url = new URL(this.endpointUrl);
            url.searchParams.set('title', track.title);
            url.searchParams.set('artist', track.artist);
            if (track.album)
                url.searchParams.set('album', track.album);
            if (track.duration)
                url.searchParams.set('duration', track.duration.toString());
            const headers = {
                'Accept': 'application/json',
            };
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            const res = await fetchFn(url.toString(), {
                method: 'GET',
                headers,
            });
            if (!res.ok) {
                return null;
            }
            const data = await res.json();
            if (!data || !data.streamUrl) {
                return null;
            }
            // Length slack check: if returned stream has duration, verify it matches original track
            const slack = options?.lengthSlackSeconds ?? 5.0;
            if (data.duration && track.duration > 0) {
                const diff = Math.abs(data.duration - track.duration);
                if (diff > slack) {
                    console.warn(`[${this.name}] Duration mismatch for "${track.title}": track is ${track.duration}s, stream is ${data.duration}s (delta ${diff}s > slack ${slack}s). Rejecting rendition.`);
                    return null;
                }
            }
            const isLossless = data.isLossless ?? (data.codec === 'flac' || data.codec === 'alac');
            return {
                url: data.streamUrl,
                mimeType: isLossless ? 'audio/flac' : 'audio/mp4',
                codec: data.codec || (isLossless ? 'flac' : 'aac'),
                bitrate: data.bitrate || (isLossless ? 1411 : 320),
                sampleRate: data.sampleRate || (isLossless ? 96000 : 44100),
                bitDepth: data.bitDepth || (isLossless ? 24 : 16),
                channels: data.channels || 2,
                isLossless,
                duration: data.duration || track.duration,
                loudnessLufs: data.loudnessLufs ?? -14.0,
                expiresAt: data.expiresAt || Date.now() + 12 * 3600 * 1000,
                sourceName: this.name,
            };
        }
        catch (err) {
            console.warn(`[${this.name}] Resolution error:`, err);
            return null;
        }
    }
}
//# sourceMappingURL=custom-source-resolver.js.map