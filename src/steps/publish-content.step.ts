import { z } from 'zod';
import type { EventConfig, Handlers } from 'motia';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export const config: EventConfig = {
    name: 'PublishContent',
    type: 'event',
    subscribes: ['content.publish'],
    input: z.object({
        requestId: z.string(),
        userEmail: z.string(),
        blogPost: z.string(),
        tweet: z.string(),
        linkedinPost: z.string(),
    }),
    emits: [],
    flows: ['content-forge'],
};

export const handler: Handlers['PublishContent'] = async (event, { logger, state }) => {
    const { requestId, userEmail } = event;

    logger.info('Loading approved content from state...', { requestId });

    const content = await state.get('content', requestId) as {
        blogPost: string;
        tweet: string;
        linkedinPost: string;
        [key: string]: any;
    } | null;

    if (!content) {
        logger.error('❌ Content not found in state', { requestId });
        throw new Error('Content not found or expired');
    }

    const { blogPost, tweet, linkedinPost } = content;

    logger.info('📤 Publishing content to platforms...', { requestId });

    try {
        // Mock publishing results (in production: integrate Dev.to API, Twitter API, LinkedIn API)
        const publishResults = {
            blog: {
                platform: 'Dev.to',
                url: `https://dev.to/contentforge/article-${requestId}`,
                published: true,
                publishedAt: new Date().toISOString(),
            },
            tweet: {
                platform: 'Twitter',
                url: `https://twitter.com/contentforge/status/${requestId}`,
                published: true,
                publishedAt: new Date().toISOString(),
            },
            linkedin: {
                platform: 'LinkedIn',
                url: `https://linkedin.com/feed/update/urn:li:share:${requestId}`,
                published: true,
                publishedAt: new Date().toISOString(),
            },
        };

        // Update state with publish results
        await state.set('content', requestId, {
            ...content,
            status: 'published',
            publishedAt: new Date().toISOString(),
            results: publishResults,
        });

        logger.info('✅ Content published successfully!', { requestId, publishResults });

        // Send success email with all links
        await sendSuccessEmail(userEmail, requestId, publishResults, {
            blogPost,
            tweet,
            linkedinPost,
        });

        logger.info('📧 Success email sent to user', { requestId, userEmail });

    } catch (error: any) {
        logger.error('❌ Publication failed', { error: error.message, requestId });

        await state.set('content', requestId, {
            ...content,
            status: 'publish_failed',
            error: error.message,
            failedAt: new Date().toISOString(),
        });

        throw error;
    }
};

// Send success email with published links
async function sendSuccessEmail(
    email: string,
    requestId: string,
    results: any,
    content: { blogPost: string; tweet: string; linkedinPost: string }
) {
    await resend.emails.send({
        from: 'ContentForge <onboarding@resend.dev>',
        to: email,
        subject: '🎉 Your Content is Live!',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ContentForge - Published Successfully!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">🎉 Success!</h1>
        <p style="color: #f0f0f0; margin: 10px 0 0 0;">Your content has been published</p>
    </div>
    
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #4CAF50;">📝 Your Content is Now Live</h2>
        <p>Great news! Your AI-generated content has been successfully published to all platforms.</p>
        
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">📚 Blog Post</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Published on ${results.blog.platform}</p>
            <a href="${results.blog.url}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Blog Post →
            </a>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1DA1F2;">🐦 Tweet</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Published on ${results.tweet.platform}</p>
            <a href="${results.tweet.url}" style="background: #1DA1F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Tweet →
            </a>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0077B5;">💼 LinkedIn Post</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Published on ${results.linkedin.platform}</p>
            <a href="${results.linkedin.url}" style="background: #0077B5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View LinkedIn Post →
            </a>
        </div>
        
        <div style="background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 15px; margin-top: 30px; border-radius: 5px;">
            <p style="margin: 0; color: #2e7d32;">
                <strong>✨ Pro Tip:</strong> Track engagement on each platform and see what resonates best with your audience!
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">Request ID: <code>${requestId}</code></p>
        </div>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>Powered by ContentForge | Built with Motia</p>
        <p>Want to create more content? Just send another video URL!</p>
    </div>
</body>
</html>
        `,
    });
}
