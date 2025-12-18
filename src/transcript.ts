import { YoutubeTranscript } from 'youtube-transcript';
import { fetch as undiciFetch } from 'undici';
import { fetchTranscript as fetchTranscriptPlus } from 'youtube-transcript-plus';

if (!globalThis.fetch) {
    // @ts-expect-error undici type mismatch is fine here
    globalThis.fetch = undiciFetch;
}

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

export async function fetchYouTubeTranscript(
    youtubeUrl: string,
    { logger }: { logger: any }
): Promise<string> {
    const videoId = extractVideoIdAny(youtubeUrl);
    if (!videoId) {
        logger.warn('Invalid YouTube URL (could not extract videoId)', { youtubeUrl });
        return '';
    }

    try {
        const items = await YoutubeTranscript.fetchTranscript(videoId as any);
        const transcript = normalize(items);
        if (transcript) {
            logger.info('Transcript fetched via youtube-transcript', { videoId, length: transcript.length });
            return transcript;
        }
        logger.warn('youtube-transcript returned empty transcript', { videoId });
    } catch (e: any) {
        logger.warn('youtube-transcript failed', { videoId, error: e?.message ?? String(e) });
    }

    try {
        const items = await fetchTranscriptPlus(videoId, { userAgent: UA });
        const transcript = normalize(items);
        logger.info('Transcript fetched via youtube-transcript-plus', { videoId, length: transcript.length });
        return transcript;
    } catch (e: any) {
        logger.warn('youtube-transcript-plus failed', { videoId, error: e?.message ?? String(e) });
        return '';
    }
}

function normalize(items: Array<{ text: string }> | undefined | null) {
    return (items ?? [])
        .map((x) => x.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractVideoIdAny(input: string): string | null {
    try {
        const u = new URL(input);

        const v = u.searchParams.get('v');
        if (v) return v;

        if (u.hostname.includes('youtu.be')) {
            const id = u.pathname.split('/').filter(Boolean)[0];
            return id || null;
        }

        const parts = u.pathname.split('/').filter(Boolean);
        const shortsIdx = parts.indexOf('shorts');
        if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
        const embedIdx = parts.indexOf('embed');
        if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];

        return null;
    } catch {
        return null;
    }
}
