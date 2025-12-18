import { z } from "zod";
import type { ApiRouteConfig, Handlers } from "motia";

export const config: ApiRouteConfig = {
    name: "GetContent",
    type: "api",
    path: "/content",
    method: "GET",
    queryParams: [{ name: "id", description: "requestId" }],
    emits: [],
    flows: ["content-forge"],
};

const Query = z.object({ id: z.string().min(1) });

export const handler: Handlers["GetContent"] = async (req, { state }) => {
    const rawId = Array.isArray(req.queryParams.id) ? req.queryParams.id[0] : req.queryParams.id;
    const parsed = Query.safeParse({ id: rawId });
    if (!parsed.success) return { status: 400, body: { success: false, error: "Missing id" } };

    const content = await state.get("content", parsed.data.id);
    if (!content) return { status: 404, body: { success: false, error: "Not found" } };

    return { status: 200, body: { success: true, data: content } };
};
