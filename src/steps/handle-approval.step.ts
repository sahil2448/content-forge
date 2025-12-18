import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
    name: 'HandleApproval',
    type: 'api',
    path: '/api/approve',
    method: 'GET',
    queryParams: [
        { name: 'id', description: 'Content request ID' },
        { name: 'action', description: 'approve or reject' },
    ],
    emits: ['content.publish'],
    flows: ['content-forge'],
};

const QuerySchema = z.object({
    id: z.string().min(1),
    action: z.enum(['approve', 'reject']),
});

const ContentPublishSchema = z.object({
    requestId: z.string().min(1),
    userEmail: z.string().min(1),
});

type ContentState = {
    requestId: string;
    userEmail: string;
    youtubeUrl?: string;
    blogPost?: string;
    tweet?: string;
    linkedinPost?: string;
    status: string;
    expiresAt?: string;
    [key: string]: any;
};

export const handler: Handlers['HandleApproval'] = async (req, { emit, logger, state }) => {
    const rawId = Array.isArray(req.queryParams.id) ? req.queryParams.id[0] : req.queryParams.id;
    const rawAction = Array.isArray(req.queryParams.action) ? req.queryParams.action[0] : req.queryParams.action;

    const parsed = QuerySchema.safeParse({ id: rawId, action: rawAction });
    if (!parsed.success) {
        return {
            status: 400,
            body: generateHtmlResponse(
                'Invalid Request',
                '⚠️',
                '#ff9800',
                'Missing or invalid query params.',
                'Expected: /api/approve?id=...&action=approve|reject'
            ),
            headers: { 'Content-Type': 'text/html' },
        };
    }

    const { id, action } = parsed.data;

    const content = (await state.get('content', id)) as ContentState | null;
    if (!content) {
        return {
            status: 410,
            body: generateHtmlResponse(
                'Link Expired',
                '❌',
                '#f44336',
                'This approval link has expired or the content was not found.',
                'Please request a new content generation.'
            ),
            headers: { 'Content-Type': 'text/html' },
        };
    }

    if (content.expiresAt && new Date() > new Date(content.expiresAt)) {
        return {
            status: 410,
            body: generateHtmlResponse(
                'Link Expired',
                '⏰',
                '#f44336',
                'This approval link has expired.',
                'Please request a new content generation.'
            ),
            headers: { 'Content-Type': 'text/html' },
        };
    }

    if (content.status !== 'pending_approval') {
        return {
            status: 400,
            body: generateHtmlResponse(
                'Already Processed',
                '⚠️',
                '#ff9800',
                `This content has already been ${content.status}.`,
                'You cannot approve or reject it again.'
            ),
            headers: { 'Content-Type': 'text/html' },
        };
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await state.set('content', id, {
        ...content,
        status: newStatus,
        decidedAt: new Date().toISOString(),
    });

    logger.info('✅ Decision recorded in state', { id, status: newStatus });

    if (action === 'approve') {
        const payload = ContentPublishSchema.parse({
            requestId: id,
            userEmail: content.userEmail,
        });

        await emit({
            topic: 'content.publish',
            data: payload,
        } as any);

        return {
            status: 200,
            body: generateHtmlResponse(
                'Content Approved!',
                '✅',
                '#4CAF50',
                'Your content has been approved and is being published.',
                'You will receive a confirmation email shortly.'
            ),
            headers: { 'Content-Type': 'text/html' },
        };
    }

    return {
        status: 200,
        body: generateHtmlResponse(
            'Content Rejected',
            '❌',
            '#f44336',
            'Your content has been rejected and will not be published.',
            'You can generate new content anytime.'
        ),
        headers: { 'Content-Type': 'text/html' },
    };
};

function generateHtmlResponse(
    title: string,
    emoji: string,
    color: string,
    message: string,
    subMessage: string
): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ContentForge - ${title}</title>
</head>
<body style="font-family: Arial, sans-serif; text-align:center; padding:40px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border:1px solid #eee; padding:30px; border-radius:12px;">
    <div style="font-size:64px; margin-bottom:10px;">${emoji}</div>
    <div style="color:${color}; font-size:28px; font-weight:700; margin-bottom:10px;">${title}</div>
    <div style="font-size:16px; color:#444; margin-bottom:6px;">${message}</div>
    <div style="font-size:13px; color:#777;">${subMessage}</div>
  </div>
</body>
</html>
  `;
}
