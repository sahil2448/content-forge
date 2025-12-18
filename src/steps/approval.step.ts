// filename: steps/approval.step.ts
import { z } from 'zod';
import type { EventConfig, Handlers } from 'motia';
import { Resend } from 'resend';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ResendApiKey = process.env.RESEND_API_KEY || '';
const resend = ResendApiKey ? new Resend(ResendApiKey) : null;

export const ApprovalInputSchema = z.object({
  requestId: z.string(),
  userEmail: z.string().regex(emailRegex, 'Invalid email'),
  blogPost: z.string(),
  tweet: z.string(),
  linkedinPost: z.string(),
});

export const config: EventConfig = {
  name: 'WaitForApproval',
  type: 'event',
  subscribes: ['content.generated'],
  input: ApprovalInputSchema,
  emits: [],
  flows: ['content-forge'],
};

export const handler: Handlers['WaitForApproval'] = async (event, { logger, state }) => {
  const { requestId, userEmail, blogPost, tweet, linkedinPost } = ApprovalInputSchema.parse(event);

  logger.info('📧 Preparing approval email', { requestId, userEmail });

  await state.set('content', requestId, {
    requestId,
    userEmail,
    blogPost,
    tweet,
    linkedinPost,
    status: 'pending_approval',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  const base = process.env.BASE_URL || 'http://localhost:3000';
  const approveUrl = `${base}/api/approve?id=${encodeURIComponent(requestId)}&action=approve`;
  const rejectUrl = `${base}/api/approve?id=${encodeURIComponent(requestId)}&action=reject`;

  if (!resend) {
    logger.warn('RESEND_API_KEY missing — skipping email send. Provide RESEND_API_KEY to enable emails.');
    return;
  }

  try {
    await resend.emails.send({
      from: 'ContentForge <onboarding@resend.dev>',
      to: userEmail,
      subject: '✅ Your AI-Generated Content is Ready!',
      html: `
        <!doctype html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial, sans-serif; line-height:1.6; max-width:600px; margin:0 auto; padding:20px;">
          <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); padding:30px; border-radius:10px 10px 0 0; text-align:center;">
            <h1 style="color:#fff;margin:0;">🎬 ContentForge</h1>
            <p style="color:#f0f0f0;margin:10px 0 0 0;">Your AI-Generated Content is Ready!</p>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;">
            <h2 style="color:#667eea;margin-top:0;">📝 Blog Post Preview</h2>
            <div style="background:#fff;padding:20px;border-radius:5px;border-left:4px solid #667eea;margin-bottom:20px;">
              <p style="margin:0; white-space:pre-wrap;">${escapeHtml(blogPost).substring(0, 500)}${blogPost.length > 500 ? '...' : ''}</p>
            </div>
            <h2 style="color:#1DA1F2;">🐦 Tweet</h2>
            <div style="background:#e3f2fd;padding:15px;border-radius:5px;margin-bottom:20px;">
              <p style="margin:0;">${escapeHtml(tweet)}</p>
            </div>
            <h2 style="color:#0077B5;">💼 LinkedIn Post</h2>
            <div style="background:#f3e5f5;padding:15px;border-radius:5px;margin-bottom:30px;">
              <p style="margin:0; white-space:pre-wrap;">${escapeHtml(linkedinPost).substring(0, 300)}${linkedinPost.length > 300 ? '...' : ''}</p>
            </div>
            <div style="text-align:center;margin:40px 0;">
              <a href="${approveUrl}" style="background:#4CAF50;color:#fff;padding:15px 40px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;margin:10px;">✅ Approve & Publish</a>
              <a href="${rejectUrl}" style="background:#f44336;color:#fff;padding:15px 40px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;margin:10px;">❌ Reject</a>
            </div>
            <div style="background:#fff3cd;border:1px solid #ffc107;padding:15px;border-radius:5px;margin-top:20px;">
              <p style="margin:0;color:#856404;">⏰ <strong>This link expires in 24 hours.</strong><br>Request ID: <code>${requestId}</code></p>
            </div>
          </div>
          <div style="text-align:center;padding:20px;color:#999;font-size:12px;">Powered by ContentForge | Built with Motia</div>
        </body></html>
      `,
    });

    logger.info('✅ Approval email sent', { requestId, userEmail });
  } catch (err: any) {
    logger.error('❌ Failed sending approval email', { requestId, userEmail, error: err?.message ?? err });
  }
};

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
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
