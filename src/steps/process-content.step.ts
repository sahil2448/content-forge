import { z } from "zod";
import type { EventConfig, Handlers } from "motia";
import { fetchYouTubeTranscript } from "../../src/transcript";
import { pushStatus } from "../streaming";

export const config: EventConfig = {
    name: "ProcessContent",
    type: "event",
    subscribes: ["content.requested"],
    input: z.object({
        requestId: z.string(),
        userEmail: z.string(),
        youtubeUrl: z.string(),
    }),
    emits: ["content.generated"],
    flows: ["content-forge"],
};

const AiOutputSchema = z.object({
    blogPost: z.string().min(1),
    tweet: z.string().min(1),
    linkedinPost: z.string().min(1),
});

export const handler: Handlers["ProcessContent"] = async (
    event,
    { logger, state, emit, streams }
) => {
    const { requestId, userEmail, youtubeUrl } = event;

    await pushStatus(streams, requestId, "transcript", "Transcribing audio…");

    let transcriptRaw = "";
    try {
        transcriptRaw = await fetchYouTubeTranscript(youtubeUrl, { logger });
    } catch (e) {
        logger.warn("ProcessContent transcription failed", {
            requestId,
            error: String(e),
        });
    }

    const transcriptForUi =
        transcriptRaw?.trim() ||
        "Transcript unavailable (transcription failed or returned empty).";

    const meta = await fetchYouTubeOEmbed(youtubeUrl).catch((e) => {
        logger.warn("ProcessContent oEmbed fetch failed", {
            requestId,
            error: String(e),
        });
        return null;
    });

    if (!transcriptRaw?.trim() && !meta?.title) {
        await pushStatus(
            streams,
            requestId,
            "error",
            "Cannot transcribe or fetch metadata. Try again later."
        );

        await state.set("content", requestId, {
            requestId,
            userEmail,
            youtubeUrl,
            transcript: transcriptForUi,
            blogPost: "",
            tweet: "",
            linkedinPost: "",
            status: "error",
            error: "Transcript and metadata unavailable",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

        return;
    }

    await pushStatus(streams, requestId, "generate", "Generating content with AI…");

    const ai = await generateWithOpenRouter({
        youtubeUrl,
        transcript: transcriptRaw?.trim() ? transcriptRaw : undefined,
        title: meta?.title,
        channel: meta?.author_name,
    });

    const validated = AiOutputSchema.parse(ai);

    await state.set("content", requestId, {
        requestId,
        userEmail,
        youtubeUrl,
        transcript: transcriptForUi,
        blogPost: validated.blogPost,
        tweet: validated.tweet,
        linkedinPost: validated.linkedinPost,
        status: "generated",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    await pushStatus(
        streams,
        requestId,
        "generated",
        "Content generated. Review in UI and send approval email."
    );

    const payload = {
        topic: "content.generated",
        data: {
            requestId,
            userEmail,
            youtubeUrl,
            blogPost: validated.blogPost,
            tweet: validated.tweet,
            linkedinPost: validated.linkedinPost,
        },
    } as const;

    await emit(payload as any);
    logger.info("content.generated emitted", { requestId });
};

async function fetchWithTimeout(
    url: string,
    init: RequestInit & { timeoutMs?: number } = {}
) {
    const { timeoutMs = 15_000, ...rest } = init;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...rest, signal: controller.signal });
    } finally {
        clearTimeout(t);
    }
}

async function fetchYouTubeOEmbed(youtubeUrl: string) {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
        youtubeUrl
    )}`;
    const res = await fetchWithTimeout(url, { timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`oEmbed ${res.status}`);
    const json = await res.json();
    return {
        title: String(json?.title || "").trim(),
        author_name: String(json?.author_name || "").trim(),
    };
}

async function generateWithOpenRouter(input: {
    youtubeUrl: string;
    transcript?: string;
    title?: string;
    channel?: string;
}) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

    const model = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";

    const system =
        "You are ContentForge. Return ONLY valid JSON with keys: blogPost, tweet, linkedinPost.";

    const user = [
        `YouTube URL: ${input.youtubeUrl}`,
        input.title ? `Video title: ${input.title}` : "",
        input.channel ? `Channel: ${input.channel}` : "",
        input.transcript ? `Transcript:\n${input.transcript}` : "Transcript: (not available)",
        "",
        "Write:",
        "- blogPost: 150-250 words, 2 short headings, actionable, based on the transcript/context.",
        "- tweet: <= 280 chars, no hashtags, based on the transcript/context.",
        "- linkedinPost: <= 600 chars, professional tone, 3-6 bullets, CTA at end, based on the transcript/context.",
        "",
        "Output JSON only.",
    ]
        .filter(Boolean)
        .join("\n");

    const referer = process.env.OPENROUTER_SITE_URL;
    const appTitle = process.env.OPENROUTER_APP_NAME || "ContentForge";

    const payload = {
        model,
        response_format: { type: "json_object" },
        messages: [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 1200,
    };

    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                timeoutMs: 60_000,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    ...(referer ? { "HTTP-Referer": referer } : {}),
                    ...(appTitle ? { "X-Title": appTitle } : {}),
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`OpenRouter error ${res.status}: ${text}`);
            }

            type OpenRouterResponse = {
                choices?: Array<{ message?: { content?: string } }>;
            };

            const json: OpenRouterResponse = await res.json();
            const completionText = json?.choices?.[0]?.message?.content;

            if (typeof completionText !== "string" || !completionText.trim()) {
                throw new Error("OpenRouter returned empty response");
            }

            const parsed = safeJsonParse(completionText);

            const out = AiOutputSchema.parse({
                blogPost: String(parsed.blogPost ?? "").trim(),
                tweet: String(parsed.tweet ?? "").trim(),
                linkedinPost: String(parsed.linkedinPost ?? "").trim(),
            });

            return out;
        } catch (e) {
            lastErr = e;
            if (attempt < 3) await sleep(400 * attempt);
        }
    }

    throw lastErr;
}

function safeJsonParse(raw: string) {
    const match = raw.match(/``````/i);
    const candidate = (match?.[1] ?? raw).trim();

    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    const jsonText =
        firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
            ? candidate.slice(firstBrace, lastBrace + 1)
            : candidate;

    return JSON.parse(jsonText);
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}
