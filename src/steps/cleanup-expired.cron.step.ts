import type { CronConfig, Handlers } from "motia";

export const config: CronConfig = {
    type: "cron",
    name: "CleanupExpiredContent",
    description: "Marks expired requests and prunes index",
    cron: "*/10 * * * *",
    emits: [],
    flows: ["content-forge"],
};

type ContentState = { expiresAt?: string; status?: string;[k: string]: any };

export const handler: Handlers["CleanupExpiredContent"] = async (_input, { state, logger, streams }) => {
    const ids = ((await state.get("content_index", "all")) as string[] | null) ?? [];
    if (!ids.length) return;

    const now = Date.now();
    const keep: string[] = [];

    for (const id of ids) {
        const content = (await state.get("content", id)) as ContentState | null;
        if (!content) continue;

        const exp = content.expiresAt ? new Date(content.expiresAt).getTime() : 0;
        const isExpired = exp && exp < now;

        if (isExpired && content.status !== "expired" && content.status !== "published") {
            await state.set("content", id, { ...content, status: "expired", expiredAt: new Date().toISOString() });
            if (streams?.contentStatus) {
                await streams.contentStatus.set("requests", id, {
                    requestId: id,
                    stage: "expired",
                    message: "Request expired (24h). Please generate again.",
                    ts: new Date().toISOString(),
                });
            }
            continue;
        }

        keep.push(id);
    }

    if (keep.length !== ids.length) {
        await state.set("content_index", "all", keep);
        logger.info("CleanupExpiredContent pruned index", { before: ids.length, after: keep.length });
    }
};
