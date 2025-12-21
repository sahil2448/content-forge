// src/transcript.ts
// import ytdl from "ytdl-core";
// import { createClient } from "@deepgram/sdk";

// const UA =
//     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
import ytdl from "ytdl-core";
import { createClient } from "@deepgram/sdk";

export async function fetchYouTubeTranscript(youtubeUrl: string, { logger }: { logger: any }) {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    const audioStream = ytdl(youtubeUrl, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 24,
    });

    audioStream.on("error", (err) => {
        logger.error("ytdl audio stream error", { error: String(err) });
    });

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioStream,
        { model: "nova-3", smart_format: true, punctuate: true }
    );
    if (error) {
        logger.error("Deepgram error", { error: JSON.stringify(error) });
        throw error;
    }

    const transcript =
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";

    logger.info("Deepgram transcript length", { length: transcript.length });
    return transcript;
}
