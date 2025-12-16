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

export const handler: Handlers['HandleApproval'] = async (req, { emit, logger, state }) => {
    const id = Array.isArray(req.queryParams.id) ? req.queryParams.id[0] : req.queryParams.id;
    const action = Array.isArray(req.queryParams.action) ? req.queryParams.action[0] : req.queryParams.action;

    logger.info('🔔 User decision received', { id, action });

    // Load content from state
    const content = await state.get('content', id) as {
        userEmail: string;
        blogPost: string;
        tweet: string;
        linkedinPost: string;
        status: string;
        expiresAt: string;
        [key: string]: any;
    } | null;

    if (!content) {
        logger.warn('⚠️ Content not found in state', { id });
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

    // Check if link expired
    if (new Date() > new Date(content.expiresAt)) {
        logger.warn('⏰ Approval link expired', { id, expiresAt: content.expiresAt });
        return {
            status: 410,
            body: generateHtmlResponse(
                'Link Expired',
                '⏰',
                '#f44336',
                'This approval link has expired (24 hours).',
                'Please request a new content generation.'
            ),
            headers: { 'Content-Type': 'text/html' },
        };
    }

    // Check if already processed
    if (content.status !== 'pending_approval') {
        logger.warn('⚠️ Content already processed', { id, currentStatus: content.status });
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

    // Update state
    const status = action === 'approve' ? 'approved' : 'rejected';
    await state.set('content', id, {
        ...content,
        status,
        decidedAt: new Date().toISOString(),
    });

    logger.info('✅ Decision recorded in state', { id, status });

    // If approved, emit publish event
    if (action === 'approve') {
        await emit({
            topic: 'content.publish',
            data: {
                requestId: id,
                userEmail: content.userEmail,
                blogPost: content.blogPost,
                tweet: content.tweet,
                linkedinPost: content.linkedinPost,
            },
        });
        logger.info('📤 Publish event emitted to queue', { id });

        return {
            status: 200,
            body: generateHtmlResponse(
                'Content Approved!',
                '✅',
                '#4CAF50',
                'Your content has been approved and is being published.',
                'You will receive a confirmation email with links shortly.'
            ),
            headers: { 'Content-Type': 'text/html' },
        };
    } else {
        logger.info('🗑️ Content rejected by user', { id });
        return {
            status: 200,
            body: generateHtmlResponse(
                'Content Rejected',
                '❌',
                '#f44336',
                'Your content has been rejected and will not be published.',
                'The content has been discarded.'
            ),
            headers: { 'Content-Type': 'text/html' },
        };
    }
};

// Helper function to generate consistent HTML responses
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
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 50px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 500px;
        }
        .emoji {
            font-size: 80px;
            margin-bottom: 20px;
        }
        .title {
            color: ${color};
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .message {
            font-size: 18px;
            color: #555;
            margin-bottom: 10px;
        }
        .sub-message {
            font-size: 14px;
            color: #999;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">${emoji}</div>
        <div class="title">${title}</div>
        <div class="message">${message}</div>
        <div class="sub-message">${subMessage}</div>
        <div class="footer">
            Powered by ContentForge<br>
            Built with Motia Framework
        </div>
    </div>
</body>
</html>
    `;
}
