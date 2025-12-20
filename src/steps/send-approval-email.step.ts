import { z } from "zod";
import type { ApiRouteConfig, Handlers } from "motia";

const Body = z.object({ requestId: z.string().min(1) });

export const config: ApiRouteConfig = {
    name: "SendApprovalEmail",
    type: "api",
    path: "/send-approval-email",
    method: "POST",
    bodySchema: Body,
    emits: ["content.email_requested"],
    flows: ["content-forge"],
};

export const handler: Handlers["SendApprovalEmail"] = async (req, { emit, state, logger }) => {
    const parsed = Body.safeParse(req.body ?? {});
    if (!parsed.success) return { status: 400, body: { success: false, error: "Invalid body" } };

    const { requestId } = parsed.data;
    const content = await state.get("content", requestId);

    if (!content) return { status: 404, body: { success: false, error: "Request not found" } };

    await emit({ topic: "content.email_requested", data: { requestId } } as any);
    logger.info("content.email_requested emitted", { requestId });

    return { status: 202, body: { success: true, requestId } };
};
