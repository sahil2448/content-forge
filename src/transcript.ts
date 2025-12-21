// src/transcript.ts
import ytdl from "ytdl-core";
import { createClient } from "@deepgram/sdk";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export async function fetchYouTubeTranscript(
    youtubeUrl: string,
    { logger }: { logger: any }
): Promise<string> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPGRAM_API_KEY");

    const audioStream = ytdl(youtubeUrl, {
        filter: "audioonly",
        quality: "highestaudio",
        requestOptions: {
            headers: {
                "User-Agent": UA,
                "Accept-Language": "en-US,en;q=0.9",
            },
        },
        highWaterMark: 1 << 24,
    });

    const deepgram = createClient(apiKey);

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioStream,
        {
            model: "nova-3",
            smart_format: true,
            punctuate: true,
        }
    );

    if (error) throw error;

    const transcript =
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";

    if (!transcript) {
        logger.warn("Deepgram returned empty transcript");
    } else {
        logger.info("Deepgram transcript OK", { length: transcript.length });
    }

    return transcript;
}
