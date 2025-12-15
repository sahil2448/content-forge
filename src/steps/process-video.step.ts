import { z } from 'zod';

export const config = {
    name: 'ProcessVideo',
    type: 'api',
    path: '/process-video',
    method: 'POST',
    bodySchema: z.object({
        youtubeUrl: z.string().url(),
        userEmail: z.string().email(),
    }),
    emits: [],
};

export const handler = async (req: any, { logger, state, emit }: any) => {
    const { youtubeUrl, userEmail } = req.body;

    logger.info('🎬 ContentForge Started', { youtubeUrl, userEmail });

    const transcript = "This is a mock transcript about AI and coding tools.";

    const blogPost = `## Blog Post\n\nSummary of: ${youtubeUrl}\n\n${transcript}`;
    const tweet = `Just watched this! 🚀 ${youtubeUrl} #AI #Coding`;

    logger.info('✅ Content generated');

    return {
        status: 200,
        body: {
            success: true,
            blogPost,
            tweet,
            message: 'Content generated successfully!',
        },
    };
};
