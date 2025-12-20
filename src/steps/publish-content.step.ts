// filename: steps/publish-content.step.ts
import { z } from "zod";
import type { EventConfig, Handlers } from "motia";
import { Resend } from "resend";
import { pushStatus } from "../streaming";

const resend = new Resend(process.env.RESEND_API_KEY!);

const HandlesSchema = z.object({
    devto: z.string().min(1).optional(),
    x: z.string().min(1).optional(),
    linkedin: z.string().min(1).optional(),
});

export const config: EventConfig = {
    name: "PublishContent",
    type: "event",
    subscribes: ["content.publish"],
    input: z.object({
        requestId: z.string(),
        userEmail: z.string(),
        handles: HandlesSchema.optional(),
    }),
    emits: [],
    flows: ["content-forge"],
};

type ContentState = {
    blogPost?: string;
    tweet?: string;
    linkedinPost?: string;
    youtubeUrl?: string;
    transcript?: string;
    status?: string;
    results?: any;
    handles?: z.infer<typeof HandlesSchema>;
    [key: string]: any;
};

function cleanHandle(s: string) {
    return String(s || "")
        .trim()
        .replace(/^@/, "")
        .replace(/\s+/g, "");
}

export const handler: Handlers["PublishContent"] = async (event, { logger, state, streams }) => {
    const { requestId, userEmail, handles } = config.input.parse(event);

    const existing = (await state.get("content", requestId)) as ContentState | null;
    if (!existing) throw new Error(`Content not found for requestId=${requestId}`);

    const blogPost = String(existing.blogPost ?? "");
    const tweet = String(existing.tweet ?? "");
    const linkedinPost = String(existing.linkedinPost ?? "");

    if (!blogPost || !tweet || !linkedinPost) {
        throw new Error("Generated content missing in state (blogPost/tweet/linkedinPost)");
    }

    const devto = handles?.devto ? cleanHandle(handles.devto) : "contentforge";
    const x = handles?.x ? cleanHandle(handles.x) : "contentforge";
    const li = handles?.linkedin ? cleanHandle(handles.linkedin) : "contentforge";

    const publishResults = {
        blog: {
            platform: "Dev.to",
            handle: devto,
            url: `https://dev.to/${devto}/article-${requestId}`,
            published: true,
            publishedAt: new Date().toISOString(),
        },
        tweet: {
            platform: "X",
            handle: x,
            url: `https://x.com/${x}/status/${requestId}`,
            published: true,
            publishedAt: new Date().toISOString(),
        },
        linkedin: {
            platform: "LinkedIn",
            handle: li,
            url: `https://linkedin.com/in/${li}`,
            published: true,
            publishedAt: new Date().toISOString(),
        },
    };

    await state.set("content", requestId, {
        ...existing,
        status: "published",
        publishedAt: new Date().toISOString(),
        handles: handles ?? existing.handles,
        results: publishResults,
    });

    await pushStatus(streams, requestId, "published", "Published successfully.");

    await resend.emails.send({
        from: "ContentForge <onboarding@resend.dev>",
        to: userEmail,
        subject: "🎉 Your Content is Live!",
        html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2>Published successfully</h2>
        <p>Request ID: <code>${requestId}</code></p>

        <h3>Destinations</h3>
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

        <p>Original video: <a href="${existing.youtubeUrl ?? "#"}">${existing.youtubeUrl ?? "N/A"}</a></p>
      </div>
    `,
    });

    logger.info("PublishContent done", { requestId, userEmail, handles });
};

function escapeHtml(s: string) {
    return String(s ?? "").replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#039;";
            default:
                return ch;
        }
    });
}
