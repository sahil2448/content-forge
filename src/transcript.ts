import ytdl from "@distube/ytdl-core";
import { createClient } from "@deepgram/sdk";
import { PassThrough } from "node:stream";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export async function fetchYouTubeTranscript(
    youtubeUrl: string,
    { logger }: { logger: any }
) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPGRAM_API_KEY");

    const deepgram = createClient(apiKey);

    const pass = new PassThrough();

    let ytdlErr: any = null;

    const audio = ytdl(youtubeUrl, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 24,
        requestOptions: {
            headers: {
                "User-Agent": UA,
                "Accept-Language": "en-US,en;q=0.9",
            },
        },
    });

    audio.once("error", (err) => {
        ytdlErr = err;
        logger.error("ytdl audio stream error", { error: String(err) });
        pass.destroy(err);
    });

    audio.once("response", (res) => {
        logger.info("ytdl audio response", {
            statusCode: (res as any)?.statusCode,
            contentType: (res as any)?.headers?.["content-type"],
        });
    });

    audio.pipe(pass);

    const timeoutMs = Number(process.env.TRANSCRIBE_TIMEOUT_MS ?? 180_000);
    const timeout = setTimeout(() => {
        const err = new Error(`Transcription timeout after ${timeoutMs}ms`);
        pass.destroy(err);
    }, timeoutMs);

    try {
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(pass, {
            model: "nova-3",
            smart_format: true,
            punctuate: true,
        });

        if (ytdlErr) throw ytdlErr;
        if (error) throw error;

        const transcript =
            result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";

        logger.info("Deepgram transcript length", { length: transcript.length });
        return transcript;
    } finally {
        clearTimeout(timeout);
        audio.destroy();
        pass.destroy();
    }
}
