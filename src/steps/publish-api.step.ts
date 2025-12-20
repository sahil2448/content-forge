import { z } from "zod";
import type { ApiRouteConfig, Handlers } from "motia";

const Body = z.object({
    requestId: z.string().min(1),
    handles: z.object({
        devto: z.string().optional(),
        x: z.string().optional(),
        linkedin: z.string().optional(),
    }),
});

export const config: ApiRouteConfig = {
    name: "TriggerPublish",
    type: "api",
    path: "/publish",
    method: "POST",
    bodySchema: Body,
    emits: ["content.publish"],
    flows: ["content-forge"],
};

export const handler: Handlers["TriggerPublish"] = async (req, { emit, state }) => {
    const parsed = Body.safeParse(req.body ?? {});
    if (!parsed.success) return { status: 400, body: { success: false, error: "Invalid body" } };

    const { requestId, handles } = parsed.data;
    const content: any = await state.get("content", requestId);
    if (!content) return { status: 404, body: { success: false, error: "Request not found" } };

    if (content.status !== "approved") {
        return { status: 409, body: { success: false, error: `Not approved (status=${content.status})` } };
    }

    await state.set("content", requestId, { ...content, status: "publishing", handles });

    await emit({
        topic: "content.publish",
        data: { requestId, userEmail: content.userEmail, handles },
    } as any);

    return { status: 202, body: { success: true, requestId } };
};
