import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
    name: 'TriggerContentCreation',
    type: 'api',
    path: '/create-content',
    method: 'POST',
    bodySchema: z.object({
        youtubeUrl: z.string().url(),
        userEmail: z.string().email(),
    }),
    emits: ['content.requested'],
    flows: ['content-forge'],
};

export const handler: Handlers['TriggerContentCreation'] = async (req, { emit, logger }) => {
    const { youtubeUrl, userEmail } = req.body;

    logger.info('🎯 ContentForge triggered', { youtubeUrl, userEmail });

    await emit({
        topic: 'content.requested',
        data: { youtubeUrl, userEmail, requestId: Date.now().toString() },
    });

    return {
        status: 202,
        body: {
            success: true,
            message: 'Content generation started! Check your email for approval.',
        },
    };
};
