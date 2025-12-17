// filename: steps/api-trigger.step.ts
import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

const BodySchema = z.object({
    youtubeUrl: z.string().regex(urlRegex, 'Invalid URL'),
    userEmail: z.string().regex(emailRegex, 'Invalid email'),
});

export const config: ApiRouteConfig = {
    name: 'TriggerContentCreation',
    type: 'api',
    path: '/create-content',
    method: 'POST',
    bodySchema: BodySchema,
    emits: ['content.requested'],
    flows: ['content-forge'],
};

export const handler: Handlers['TriggerContentCreation'] = async (req, { emit, logger }) => {
    const parsed = BodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        logger.warn('Invalid request body', { issues: parsed.error.format() });
        return {
            status: 400,
            body: { success: false, error: 'Invalid request body' },
        };
    }

    const { youtubeUrl, userEmail } = parsed.data;
    const requestId = Date.now().toString();

    logger.info('🎯 ContentForge triggered', { youtubeUrl, userEmail, requestId });

    await emit({
        topic: 'content.requested',
        data: { requestId, youtubeUrl, userEmail },
    } as any);

    return {
        status: 202,
        body: {
            success: true,
            message: 'Content generation started! Check your email for approval.',
            requestId,
        },
    };
};
