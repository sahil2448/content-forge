import { z } from 'zod';
import type { EventConfig, Handlers } from 'motia';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export const config: EventConfig = {
    name: 'WaitForApproval',
    type: 'event',
    subscribes: ['content.generated'],
    input: z.object({
        requestId: z.string(),
        userEmail: z.string(),
        blogPost: z.string(),
        tweet: z.string(),
        linkedinPost: z.string(),
    }),
    emits: [],  // HandleApproval will emit content.publish
    flows: ['content-forge'],
};

export const handler: Handlers['WaitForApproval'] = async (event, { logger, state }) => {
    const { requestId, userEmail, blogPost, tweet, linkedinPost } = event;

    logger.info('📧 Sending approval email...', { requestId, userEmail });

    // Save full content to state (persisted in Redis)
    await state.set('content', requestId, {
        userEmail,
        blogPost,
        tweet,
        linkedinPost,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const approveUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/approve?id=${requestId}&action=approve`;
    const rejectUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/approve?id=${requestId}&action=reject`;

    try {
        await resend.emails.send({
            from: 'ContentForge <onboarding@resend.dev>',
            to: userEmail,
            subject: '✅ Your AI-Generated Content is Ready!',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ContentForge - Approval Required</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">🎬 ContentForge</h1>
        <p style="color: #f0f0f0; margin: 10px 0 0 0;">Your AI-Generated Content is Ready!</p>
    </div>
    
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #667eea; margin-top: 0;">📝 Blog Post Preview</h2>
        <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #667eea; margin-bottom: 20px;">
            <p style="margin: 0; white-space: pre-wrap;">${blogPost.substring(0, 500)}${blogPost.length > 500 ? '...' : ''}</p>
        </div>
        
        <h2 style="color: #1DA1F2;">🐦 Tweet</h2>
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 0;">${tweet}</p>
        </div>
        
        <h2 style="color: #0077B5;">💼 LinkedIn Post</h2>
        <div style="background: #f3e5f5; padding: 15px; border-radius: 5px; margin-bottom: 30px;">
            <p style="margin: 0; white-space: pre-wrap;">${linkedinPost.substring(0, 300)}${linkedinPost.length > 300 ? '...' : ''}</p>
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
            <a href="${approveUrl}" style="background: #4CAF50; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 10px;">
                ✅ Approve & Publish
            </a>
            <a href="${rejectUrl}" style="background: #f44336; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 10px;">
                ❌ Reject
            </a>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; color: #856404;">
                ⏰ <strong>This link expires in 24 hours.</strong><br>
                Request ID: <code>${requestId}</code>
            </p>
        </div>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>Powered by ContentForge | Built with Motia</p>
    </div>
</body>
</html>
            `,
        });

        logger.info('✅ Approval email sent successfully!', {
            requestId,
            userEmail,
            expiresIn: '24 hours'
        });

        logger.info('⏳ Workflow paused. Waiting for user decision via HandleApproval step...', { requestId });

    } catch (error: any) {
        logger.error('❌ Failed to send approval email', {
            error: error.message,
            requestId,
            userEmail
        });
        throw error;
    }
};
