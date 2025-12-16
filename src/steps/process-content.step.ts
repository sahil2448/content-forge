import { z } from 'zod';
import type { EventConfig, Handlers } from 'motia';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export const config: EventConfig = {
    name: 'ProcessContent',
    type: 'event',
    subscribes: ['content.requested'],
    input: z.object({
        youtubeUrl: z.string(),
        userEmail: z.string(),
        requestId: z.string(),
    }),
    emits: [
        {
            topic: 'content.generated',
            label: 'Content generated successfully',
        },
    ],
    flows: ['content-forge'],
};

export const handler: Handlers['ProcessContent'] = async (event: any, { emit, logger, state }: any) => {
    const { youtubeUrl, userEmail, requestId } = event.data;

    try {
        logger.info('📥 Downloading video...', { youtubeUrl });

        const audioPath = path.join('/tmp', `${requestId}.mp3`);
        await downloadAudio(youtubeUrl, audioPath);

        logger.info('🎤 Transcribing with Gemini...');

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const audioFile = await fs.readFile(audioPath);
        const audioBase64 = audioFile.toString('base64');

        const transcriptResult = await model.generateContent([
            {
                inlineData: {
                    mimeType: 'audio/mp3',
                    data: audioBase64,
                },
            },
            { text: 'Transcribe this audio word-for-word. Return only the transcript, no extra commentary.' },
        ]);

        const transcript = transcriptResult.response.text();
        logger.info('Transcription complete', { length: transcript.length });

        logger.info('Generating content with Gemini Pro...');

        const [blogPost, tweet, linkedinPost] = await Promise.all([
            generateBlogPost(transcript, youtubeUrl),
            generateTweet(transcript, youtubeUrl),
            generateLinkedInPost(transcript, youtubeUrl),
        ]);

        await state.set('content', requestId, {
            youtubeUrl,
            userEmail,
            transcript,
            blogPost,
            tweet,
            linkedinPost,
            status: 'pending_approval',
            createdAt: new Date().toISOString(),
        });

        logger.info('Content generated successfully');

        await emit({
            topic: 'content.generated',
            data: { requestId, userEmail, blogPost, tweet, linkedinPost },
        });

        await fs.unlink(audioPath).catch(() => { });
    } catch (error: any) {
        logger.error('Processing failed', { error: error.message });
        throw error;
    }
};

async function downloadAudio(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const stream = ytdl(url, { quality: 'highestaudio', filter: 'audioonly' });
        ffmpeg(stream)
            .audioBitrate(128)
            .format('mp3')
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
}

async function generateBlogPost(transcript: string, videoUrl: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const prompt = `You are a professional blog writer. Convert this video transcript into an engaging blog post with headers, paragraphs, and clear structure.

Video URL: ${videoUrl}

Transcript: ${transcript.substring(0, 4000)}

Write a complete blog post with:
- Engaging title
- Introduction
- 3-4 main sections with headers
- Conclusion
Use Markdown formatting.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

async function generateTweet(transcript: string, videoUrl: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Create an engaging tweet (max 280 characters) for this video.

Video: ${videoUrl}
Content: ${transcript.substring(0, 500)}

Make it viral-worthy with emojis and hashtags.`;

    const result = await model.generateContent(prompt);
    return result.response.text().substring(0, 280);
}

async function generateLinkedInPost(transcript: string, videoUrl: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const prompt = `Create a professional LinkedIn post for this video.

Video: ${videoUrl}
Content: ${transcript.substring(0, 1000)}

Include:
- Hook (first line)
- Key insights (3-4 points)
- Call to action
Use line breaks for readability.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}
