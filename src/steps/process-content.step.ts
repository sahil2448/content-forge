// import { z } from 'zod';
// import type { EventConfig, Handlers } from 'motia';
// import { GoogleGenerativeAI } from '@google/generative-ai';
// import { YoutubeTranscript } from 'youtube-transcript';

// const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// export const config: EventConfig = {
//     name: 'ProcessContent',
//     type: 'event',
//     subscribes: ['content.requested'],
//     input: z.object({
//         youtubeUrl: z.string().url(),
//         userEmail: z.string().email(),
//         requestId: z.string(),
//     }),
//     emits: ['content.generated'],
//     flows: ['content-forge'],
// };

// export const handler: Handlers['ProcessContent'] = async (event, { emit, logger, state }) => {
//     const { youtubeUrl, userEmail, requestId } = event;

//     try {
//         logger.info('📥 Fetching YouTube transcript...', { youtubeUrl });

//         // Extract video ID from URL
//         const videoId = extractVideoId(youtubeUrl);
//         if (!videoId) {
//             throw new Error('Invalid YouTube URL');
//         }

//         // Fetch transcript directly from YouTube (no download!)
//         const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
//         const transcript = transcriptData.map((item: any) => item.text).join(' ');

//         logger.info('✅ Transcript fetched successfully', {
//             videoId,
//             length: transcript.length,
//             duration: `${Math.floor(transcriptData.length / 60)} minutes`
//         });

//         // Step 2: Generate content (Parallel with Gemini Pro!)
//         logger.info('🤖 Generating content with Gemini Pro...', { videoId });

//         const [blogPost, tweet, linkedinPost] = await Promise.all([
//             generateBlogPost(transcript, youtubeUrl, videoId),
//             generateTweet(transcript, youtubeUrl, videoId),
//             generateLinkedInPost(transcript, youtubeUrl, videoId),
//         ]);

//         // Save to state
//         await state.set('content', requestId, {
//             youtubeUrl,
//             videoId,
//             userEmail,
//             transcript,
//             blogPost,
//             tweet,
//             linkedinPost,
//             status: 'pending_approval',
//             createdAt: new Date().toISOString(),
//         });

//         logger.info('✅ Content generated successfully', { requestId, videoId });

//         // Emit to approval step
//         await emit({
//             topic: 'content.generated',
//             data: { requestId, userEmail, blogPost, tweet, linkedinPost },
//         });

//     } catch (error: any) {
//         logger.error('❌ Processing failed', {
//             error: error.message,
//             youtubeUrl,
//             requestId,
//             stack: error.stack
//         });

//         // Save failure to state for debugging
//         await state.set('content', requestId, {
//             status: 'failed',
//             error: error.message,
//             failedAt: new Date().toISOString(),
//         });

//         throw error;
//     }
// };

// // Extract video ID from various YouTube URL formats
// function extractVideoId(url: string): string | null {
//     const patterns = [
//         /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
//         /youtube\.com\/embed\/([^&\n?#]+)/,
//         /youtube\.com\/v\/([^&\n?#]+)/,
//     ];

//     for (const pattern of patterns) {
//         const match = url.match(pattern);
//         if (match && match[1]) {
//             return match[1];
//         }
//     }
//     return null;
// }

// // Generate blog with Gemini
// async function generateBlogPost(transcript: string, videoUrl: string, videoId: string): Promise<string> {
//     const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
//     const prompt = `You are a professional tech blog writer. Convert this YouTube video transcript into an engaging, well-structured blog post.

// Video URL: ${videoUrl}
// Video ID: ${videoId}

// Transcript:
// ${transcript.substring(0, 6000)}

// Requirements:
// - Create an attention-grabbing title
// - Write an engaging introduction (2-3 sentences)
// - Organize content into 3-5 main sections with clear headers
// - Use bullet points for key takeaways
// - Add a conclusion with call-to-action
// - Use Markdown formatting
// - Keep it between 800-1200 words

// Write in a conversational, informative tone. Make it SEO-friendly.`;

//     const result = await model.generateContent(prompt);
//     return result.response.text();
// }

// // Generate tweet
// async function generateTweet(transcript: string, videoUrl: string, videoId: string): Promise<string> {
//     const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
//     const prompt = `Create a viral-worthy tweet (MAX 280 characters) for this YouTube video.

// Video: ${videoUrl}
// Content: ${transcript.substring(0, 800)}

// Requirements:
// - Hook readers in first 5 words
// - Include 2-3 relevant emojis
// - Add 2-3 hashtags
// - Make it shareable
// - MAX 280 characters (strict limit!)

// Focus on the most interesting insight from the video.`;

//     const result = await model.generateContent(prompt);
//     let tweet = result.response.text().trim();

//     // Ensure it's under 280 characters
//     if (tweet.length > 280) {
//         tweet = tweet.substring(0, 277) + '...';
//     }

//     return tweet;
// }

// // Generate LinkedIn post
// async function generateLinkedInPost(transcript: string, videoUrl: string, videoId: string): Promise<string> {
//     const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
//     const prompt = `Create a professional LinkedIn post for this YouTube video.

// Video: ${videoUrl}
// Content: ${transcript.substring(0, 2000)}

// Requirements:
// - Start with a strong hook (question or bold statement)
// - Share 3-4 key insights with line breaks
// - Use professional but conversational tone
// - Include relevant emojis (sparingly)
// - End with a call-to-action
// - Add video link at the end
// - Keep it 150-300 words

// Make it valuable for professionals in tech/business.`;

//     const result = await model.generateContent(prompt);
//     return result.response.text();
// }



import { z } from 'zod';
import type { EventConfig, Handlers } from 'motia';
import { YoutubeTranscript } from 'youtube-transcript';

export const config: EventConfig = {
    name: 'ProcessContent',
    type: 'event',
    subscribes: ['content.requested'],
    emits: ['content.generated'],
    flows: ['content-forge'],
};

export const handler: Handlers['ProcessContent'] = async (event, { emit, logger, state }) => {
    const { youtubeUrl, userEmail, requestId } = event;

    try {
        logger.info('📥 Fetching YouTube transcript...', { youtubeUrl });

        const videoId = extractVideoId(youtubeUrl);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        // Fetch transcript
        const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
        const transcript = transcriptData.map((item: any) => item.text).join(' ');

        logger.info('✅ Transcript fetched', {
            videoId,
            transcriptLength: transcript.length,
            wordCount: transcript.split(' ').length
        });

        // MOCK CONTENT (No AI needed - works offline!)
        logger.info('🤖 Generating content (MOCK - no API calls)...', { videoId });

        const blogPost = generateMockBlog(transcript, youtubeUrl, videoId);
        const tweet = generateMockTweet(transcript, youtubeUrl);
        const linkedinPost = generateMockLinkedIn(transcript, youtubeUrl);

        await state.set('content', requestId, {
            youtubeUrl,
            videoId,
            userEmail,
            transcript: transcript.substring(0, 1000), // Store preview
            blogPost,
            tweet,
            linkedinPost,
            status: 'pending_approval',
            createdAt: new Date().toISOString(),
        });

        logger.info('✅ Content generated successfully (MOCK)', { requestId, videoId });

        await emit({
            topic: 'content.generated',
            data: { requestId, userEmail, blogPost, tweet, linkedinPost },
        });

    } catch (error: any) {
        logger.error('❌ Processing failed', {
            error: error.message,
            requestId,
            youtubeUrl
        });
        throw error;
    }
};

function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
}

// MOCK generators - fast, reliable, no API calls
function generateMockBlog(transcript: string, url: string, videoId: string): string {
    const words = transcript.split(' ');
    const title = words.slice(0, 8).join(' ');
    const intro = words.slice(0, 50).join(' ');
    const body = words.slice(50, 200).join(' ');

    return `# ${title}

## Introduction

${intro}...

## Key Takeaways

${body}...

### Main Points

- **Insight 1**: ${words.slice(10, 25).join(' ')}
- **Insight 2**: ${words.slice(30, 45).join(' ')}
- **Insight 3**: ${words.slice(60, 75).join(' ')}

## Conclusion

This content was automatically extracted from the video. For the complete experience, watch the full video at ${url}

---

*Video ID: ${videoId}*  
*Generated by ContentForge • Powered by Motia*`;
}

function generateMockTweet(transcript: string, url: string): string {
    const words = transcript.split(' ').slice(0, 20).join(' ');
    return `🚀 Just watched this: ${words}...

Must-watch! 🔥

${url}

#ContentCreation #Automation #AI`;
}

function generateMockLinkedIn(transcript: string, url: string): string {
    const words = transcript.split(' ');
    const hook = words.slice(0, 15).join(' ');
    const insight1 = words.slice(20, 40).join(' ');
    const insight2 = words.slice(50, 70).join(' ');

    return `💡 ${hook}...

I just came across this insightful video and wanted to share my key takeaways:

✅ ${insight1}
✅ ${insight2}

This is particularly relevant for anyone working in tech, content creation, or automation.

What are your thoughts on this approach?

Watch the full video: ${url}

#Technology #Innovation #ContentMarketing #Automation`;
}
