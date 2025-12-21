import { YoutubeTranscript } from "youtube-transcript";
import { fetch as undiciFetch } from "undici";
import { fetchTranscript as fetchTranscriptPlus } from "youtube-transcript-plus";

if (!globalThis.fetch) {
    // @ts-expect-error undici type mismatch is fine here
    globalThis.fetch = undiciFetch;
}

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export async function fetchYouTubeTranscript(
    youtubeUrl: string,
    { logger }: { logger: any }
): Promise<string> {
    const videoId = extractVideoIdAny(youtubeUrl);
    if (!videoId) {
        logger.warn("Invalid YouTube URL (could not extract videoId)", { youtubeUrl });
        return "";
    }

    try {
        const items = await YoutubeTranscript.fetchTranscript(videoId as any);
        const transcript = normalize(items);
        if (transcript) {
            logger.info("Transcript fetched via youtube-transcript", { videoId, length: transcript.length });
            return transcript;
        }
        logger.warn("youtube-transcript returned empty transcript", { videoId });
    } catch (e: any) {
        logger.warn("youtube-transcript failed", { videoId, error: e?.message ?? String(e) });
    }

    try {
        const items = await fetchTranscriptPlus(videoId, { userAgent: UA });
        const transcript = normalize(items);
        if (transcript) {
            logger.info("Transcript fetched via youtube-transcript-plus", { videoId, length: transcript.length });
            return transcript;
        }
        logger.warn("youtube-transcript-plus returned empty transcript", { videoId });
    } catch (e: any) {
        logger.warn("youtube-transcript-plus failed", { videoId, error: e?.message ?? String(e) });
    }

    try {
        const manual = await fetchTimedText(videoId, "en", logger);
        if (manual) {
            logger.info("Transcript fetched via timedtext (manual)", { videoId, length: manual.length });
            return manual;
        }

        const asr = await fetchTimedText(videoId, "en", logger, { kind: "asr" });
        if (asr) {
            logger.info("Transcript fetched via timedtext (asr)", { videoId, length: asr.length });
            return asr;
        }

        logger.warn("timedtext returned empty transcript", { videoId });
    } catch (e: any) {
        logger.warn("timedtext failed", { videoId, error: e?.message ?? String(e) });
    }

    return "";
}

function normalize(items: Array<{ text: string }> | undefined | null) {
    return (items ?? [])
        .map((x) => x.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

async function fetchTimedText(
    videoId: string,
    lang: string,
    logger: any,
    opts?: { kind?: "asr" }
): Promise<string> {
    const base = `https://video.google.com/timedtext?lang=${encodeURIComponent(lang)}&v=${encodeURIComponent(videoId)}`;
    const url = opts?.kind ? `${base}&kind=${opts.kind}` : base;

    const res = await fetch(url, {
        headers: {
            "User-Agent": UA,
            "Accept-Language": "en-US,en;q=0.9",
        },
    });

    if (!res.ok) {
        logger.warn("timedtext non-200", { videoId, status: res.status });
        return "";
    }

    const xml = await res.text();
    if (!xml || !xml.includes("<text")) return "";

    // Extract <text> nodes
    const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
    const chunks: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = re.exec(xml))) {
        chunks.push(decodeBasicEntities(m[1]));
    }

    return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(s: string) {
    return s
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/<br\s*\/?>/gi, " ");
}

function extractVideoIdAny(input: string): string | null {
    try {
        const u = new URL(input);

        const v = u.searchParams.get("v");
        if (v) return v;

        if (u.hostname.includes("youtu.be")) {
            const id = u.pathname.split("/").filter(Boolean)[0];
            return id || null;
        }

        const parts = u.pathname.split("/").filter(Boolean);
        const shortsIdx = parts.indexOf("shorts");
        if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
        const embedIdx = parts.indexOf("embed");
        if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];

        return null;
    } catch {
        return null;
    }
}