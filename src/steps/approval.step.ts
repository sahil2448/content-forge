import { z } from "zod";
import type { EventConfig, Handlers } from "motia";
import { Resend } from "resend";
import { pushStatus } from "../streaming";

const ResendApiKey = process.env.RESEND_API_KEY || "";
const resend = ResendApiKey ? new Resend(ResendApiKey) : null;

const Input = z.object({ requestId: z.string().min(1) });

type ContentState = {
  requestId: string;
  userEmail: string;
  blogPost?: string;
  tweet?: string;
  linkedinPost?: string;
  status: string;
  expiresAt?: string;
  [k: string]: any;
};

export const config: EventConfig = {
  name: "WaitForApproval",
  type: "event",
  subscribes: ["content.email_requested"],
  input: Input,
  emits: [],
  flows: ["content-forge"],
};

export const handler: Handlers["WaitForApproval"] = async (event, { logger, state, streams }) => {
  const { requestId } = Input.parse(event);

  const content = (await state.get("content", requestId)) as ContentState | null;
  if (!content) {
    logger.warn("No content found for approval email", { requestId });
    return;
  }

  const base = process.env.BASE_URL || "http://localhost:3001";
  const approveUrl = `${base}/api/approve?id=${encodeURIComponent(requestId)}&action=approve`;
  const rejectUrl = `${base}/api/approve?id=${encodeURIComponent(requestId)}&action=reject`;

  if (!resend) {
    logger.warn("RESEND_API_KEY missing — skipping email send.", { requestId });
    await state.set("content", requestId, { ...content, status: "pending_approval", emailSkipped: true });
    return;
  }

  try {
    await resend.emails.send({
      from: "ContentForge <onboarding@resend.dev>",
      to: content.userEmail,
      subject: "✅ Approve your AI-generated content",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:640px;margin:0 auto;padding:20px">
          <h2 style="margin:0 0 8px 0;">Your content is ready</h2>
          <p style="margin:0 0 16px 0;color:#555">Approve to unlock publishing in the dashboard.</p>

          <div style="display:flex;gap:12px;margin:18px 0;">
            <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px;font-weight:600;">Approve</a>
            <a href="${rejectUrl}" style="background:#dc2626;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px;font-weight:600;">Reject</a>
          </div>

          <p style="color:#666;font-size:12px;margin-top:18px">Request ID: <code>${requestId}</code></p>
        </div>
      `,
    });

    await state.set("content", requestId, {
      ...content,
      status: "pending_approval",
      emailSentAt: new Date().toISOString(),
    });
    await pushStatus(streams, requestId, "pending_approval", "Approval email sent. Waiting for approval…");


    logger.info("Approval email sent", { requestId, userEmail: content.userEmail });
  } catch (err: any) {
    logger.error("Failed sending approval email", { requestId, error: err?.message ?? err });
    await state.set("content", requestId, {
      ...content,
      status: "generated",
      emailError: err?.message ?? String(err),
    });
  }
};


// function escapeHtml(s: string) {
//   return String(s ?? '').replace(/[&<>"']/g, (ch) => {
//     switch (ch) {
//       case '&': return '&amp;';
//       case '<': return '&lt;';
//       case '>': return '&gt;';
//       case '"': return '&quot;';
//       case "'": return '&#039;';
//       default: return ch;
//     }
//   });
// }
