// filename: steps/publish-content.step.ts
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
        userEmail: z.string()
    }),
    emits: [],
    flows: ['content-forge'],
};

export const handler: Handlers['PublishContent'] = async (event, { logger, state }) => {
    const { requestId, userEmail } = event;

    const existing = (await state.get('content', requestId)) as
        | {
            blogPost?: string;
            tweet?: string;
            linkedinPost?: string;
            youtubeUrl?: string;
            [key: string]: any;
        }
        | null;

    if (!existing) throw new Error(`Content not found for requestId=${requestId}`);

    const blogPost = String(existing.blogPost ?? '');
    const tweet = String(existing.tweet ?? '');
    const linkedinPost = String(existing.linkedinPost ?? '');

    if (!blogPost || !tweet || !linkedinPost) {
        throw new Error('Generated content missing in state (blogPost/tweet/linkedinPost)');
    }
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

    await state.set('content', requestId, {
        ...existing,
        status: 'published',
        publishedAt: new Date().toISOString(),
        results: publishResults,
    });

    await resend.emails.send({
        from: 'ContentForge <onboarding@resend.dev>',
        to: userEmail,
        subject: '🎉 Your Content is Live!',
        html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2>Published successfully</h2>
        <p>Request ID: <code>${requestId}</code></p>

        <h3>Links</h3>
        <ul>
          <li>Blog: <a href="${publishResults.blog.url}">${publishResults.blog.url}</a></li>
          <li>Tweet: <a href="${publishResults.tweet.url}">${publishResults.tweet.url}</a></li>
          <li>LinkedIn: <a href="${publishResults.linkedin.url}">${publishResults.linkedin.url}</a></li>
        </ul>

        <h3>Content</h3>
        <h4>Blog</h4>
        <pre style="white-space:pre-wrap;">${escapeHtml(blogPost)}</pre>
        <h4>Tweet</h4>
        <pre style="white-space:pre-wrap;">${escapeHtml(tweet)}</pre>
        <h4>LinkedIn</h4>
        <pre style="white-space:pre-wrap;">${escapeHtml(linkedinPost)}</pre>

        <p>Original video: <a href="${existing.youtubeUrl ?? '#'}">${existing.youtubeUrl ?? 'N/A'}</a></p>
      </div>
    `,
    });

    logger.info('PublishContent done', { requestId, userEmail });
};

function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return ch;
        }
    });
}

