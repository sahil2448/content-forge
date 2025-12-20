// filename: steps/process-content.step.ts
import { z } from 'zod';
import type { EventConfig, Handlers } from 'motia';
import { fetchYouTubeTranscript } from '../../src/transcript';

export const config: EventConfig = {
    name: 'ProcessContent',
    type: 'event',
    subscribes: ['content.requested'],
    input: z.object({
        requestId: z.string(),
        userEmail: z.string(),
        youtubeUrl: z.string()
    }),
    emits: ['content.generated'],
    flows: ['content-forge'],
};

const ContentGeneratedSchema = z.object({
    requestId: z.string(),
    userEmail: z.string(),
    youtubeUrl: z.string(),
    blogPost: z.string().min(1),
    tweet: z.string().min(1),
    linkedinPost: z.string().min(1),
});

export const handler: Handlers['ProcessContent'] = async (event, { logger, state, emit }) => {
    const { requestId, userEmail, youtubeUrl } = event;

    logger.info('Generating content via OpenRouter...', { requestId });

    const transcript = await fetchYouTubeTranscript(youtubeUrl, { logger }).catch((e) => {
        logger.warn('Failed to fetch transcript (continuing with URL-only prompt)', { requestId, error: String(e) });
        return '';
    });

    const ai = await generateWithOpenRouter({ youtubeUrl, transcript: transcript || undefined });
    const blogPost = ai.blogPost;
    const tweet = ai.tweet;
    const linkedinPost = ai.linkedinPost;

    await state.set('content', requestId, {
        requestId,
        userEmail,
        youtubeUrl,
        transcript,
        blogPost,
        tweet,
        linkedinPost,
        status: 'generated',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });


    const payload = ContentGeneratedSchema.parse({
        requestId,
        userEmail,
        youtubeUrl,
        blogPost,
        tweet,
        linkedinPost,
    });

    await emit({
        topic: 'content.generated',
        data: payload,
    } as any);

    logger.info('content.generated emitted', { requestId });
};

async function generateWithOpenRouter(input: { youtubeUrl: string; transcript?: string }) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

    const system = `You are ContentForge. Return ONLY valid JSON with keys: blogPost, tweet, linkedinPost.`;
    const user = [
        `YouTube URL: ${input.youtubeUrl}`,
        input.transcript ? `Transcript:\n${input.transcript}` : 'Transcript: (not available)',
        '',
        'Write:',
        '- blogPost: 100-200 words, clear headings, actionable....and ENDED at the last',
        '- tweet: <= 20 chars, include No any hashtags.....and ENDED at the last',
        '- linkedinPost: <= 300 chars, professional tone, 3-6 bullet points, CTA at end.....and ENDED at the last',
        '',
        'Output JSON only.',
    ].join('\n');

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
            'X-Title': process.env.OPENROUTER_APP_NAME || 'ContentForge',
        },
        body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            temperature: 0.2,
        }),

    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`OpenRouter error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || !content.trim()) {
        throw new Error('OpenRouter returned empty response');
    }

    const parsed = safeJsonParse(content);

    function safeJsonParse(raw: string) {
        const fence = raw.match(/``````/i);
        const candidate = (fence?.[1] ?? raw).trim();

        const firstBrace = candidate.indexOf('{');
        const lastBrace = candidate.lastIndexOf('}');
        const jsonText =
            firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
                ? candidate.slice(firstBrace, lastBrace + 1)
                : candidate;

        return JSON.parse(jsonText);
    }

    const blogPost = String(parsed.blogPost ?? '').trim();
    console.log("Generated Blog Post:", blogPost);
    const tweet = String(parsed.tweet ?? '').trim();
    const linkedinPost = String(parsed.linkedinPost ?? '').trim();

    if (!blogPost || !tweet || !linkedinPost) {
        throw new Error('OpenRouter JSON missing required keys');
    }

    return { blogPost, tweet, linkedinPost };
}


function extractVideoId(url: string): string | null {
    try {
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v) return v;
        if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '') || null;
        return null;
    } catch {
        return null;
    }
}
